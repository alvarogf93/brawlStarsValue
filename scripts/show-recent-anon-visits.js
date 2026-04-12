#!/usr/bin/env node
/**
 * Lists rows in anonymous_visits. Read-only.
 */
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

async function main() {
  const { data, error } = await admin
    .from('anonymous_visits')
    .select('tag, locale, visit_count, first_visit_at, last_visit_at')
    .order('first_visit_at', { ascending: false })
    .limit(20)
  if (error) {
    console.error('✗', error.message)
    process.exit(1)
  }
  console.log(`\n── anonymous_visits: ${data.length} rows (newest first) ──\n`)
  for (const row of data) {
    console.log(`  ${row.tag.padEnd(12)}  ${row.locale.padEnd(4)}  count=${row.visit_count}  first=${row.first_visit_at}`)
  }
  console.log()
}

main().catch((err) => {
  console.error('✗', err)
  process.exit(1)
})
