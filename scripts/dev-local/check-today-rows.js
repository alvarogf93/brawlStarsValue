#!/usr/bin/env node
/**
 * Quick check: are there rows in meta_stats with date = today?
 * Uses an explicit filter instead of ordering the whole table (which
 * hits the PostgREST 1000-row cap and gives a false-negative).
 */

const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const { createClient } = require('@supabase/supabase-js')
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

;(async () => {
  const today = new Date().toISOString().slice(0, 10)
  console.log(`Today: ${today}\n`)

  // Probe each recent date with an exact filter + COUNT
  for (const offset of [0, 1, 2, 3, 4, 5, 6]) {
    const d = new Date(Date.now() - offset * 86400_000).toISOString().slice(0, 10)
    const { count } = await admin
      .from('meta_stats')
      .select('*', { count: 'exact', head: true })
      .eq('date', d)
      .eq('source', 'global')
    console.log(`  ${d} (global): ${count} rows`)
  }
  console.log('')

  // Sum of `total` for today across all brawlers/maps/modes in global
  // This is the post-017 value so divide by nothing — it's already
  // per-row battle-agnostic, but sum/6 gives us the battle count.
  const { data: todayRows } = await admin
    .from('meta_stats')
    .select('total')
    .eq('date', today)
    .eq('source', 'global')

  if (todayRows && todayRows.length > 0) {
    const sum = todayRows.reduce((s, r) => s + Number(r.total), 0)
    console.log(`Today row-total SUM: ${sum}`)
    console.log(`Today battles estimate (sum/6): ${Math.round(sum / 6)}`)
  } else {
    console.log(`No rows for today (${today}).`)
  }
})().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
