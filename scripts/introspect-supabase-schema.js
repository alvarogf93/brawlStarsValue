#!/usr/bin/env node
/**
 * Introspect the Supabase schema via PostgREST OpenAPI and emit table-by-table
 * column reports. Used during ARQ-01 to ground the hand-written types in
 * src/lib/supabase/types.ts in real production schema.
 *
 * Output is whitespace-stable — diff against `git show` to detect drift.
 *
 * Usage: node scripts/introspect-supabase-schema.js > /tmp/schema.txt
 */

const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

;(async () => {
  // PostgREST exposes an OpenAPI 2.0 spec at the base URL when called with
  // the service-role key (anon would only see public-readable tables).
  const res = await fetch(`${URL.replace(/\/$/, '')}/rest/v1/`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  if (!res.ok) {
    console.error(`PostgREST root returned ${res.status}`)
    process.exit(2)
  }
  const spec = await res.json()
  const defs = spec.definitions || {}

  // Tables we care about for ARQ-01 (the 7 currently typed as `any` plus the
  // 4 already-typed ones, for cross-validation).
  const TARGET_TABLES = [
    'profiles', 'battles', 'sync_queue', 'webhook_events',
    'meta_stats', 'meta_matchups', 'meta_trios',
    'cron_heartbeats', 'brawler_trends', 'meta_poll_cursors',
    'anonymous_visits',
  ]

  for (const tableName of TARGET_TABLES) {
    const def = defs[tableName]
    console.log(`\n=== ${tableName} ===`)
    if (!def) {
      console.log('  (not found in OpenAPI spec)')
      continue
    }
    const required = new Set(def.required || [])
    const props = def.properties || {}
    for (const [col, prop] of Object.entries(props)) {
      const isRequired = required.has(col)
      const tsType = mapPostgresToTs(prop)
      const nullable = prop.format && /timestamp|date/.test(prop.format) ? '' : ''
      const nullSuffix = isRequired ? '' : ' | null'
      console.log(`  ${col}: ${tsType}${nullSuffix}  // ${prop.format || prop.type}${isRequired ? ' [required]' : ''}`)
    }
  }
})().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})

function mapPostgresToTs(prop) {
  // PostgREST OpenAPI gives format hints (e.g. format: 'integer', 'bigint',
  // 'timestamp with time zone', 'text', 'uuid', 'jsonb', 'date', 'boolean').
  const format = prop.format || ''
  const type = prop.type || ''
  if (type === 'integer' || /^(integer|bigint|smallint|numeric|double|real)/.test(format)) {
    return 'number'
  }
  if (type === 'boolean' || format === 'boolean') return 'boolean'
  if (format === 'uuid' || format === 'text' || format === 'character varying' || format === 'character') {
    return 'string'
  }
  if (format === 'date' || format.startsWith('timestamp')) return 'string'
  if (format === 'jsonb' || format === 'json') return 'unknown'
  if (type === 'array') return 'unknown[]'
  if (type === 'object') return 'Record<string, unknown>'
  return 'unknown'
}
