#!/usr/bin/env node
/**
 * Probe `bulk_upsert_meta_stats` RPC with one test row.
 *
 * Writes ONE row with source='probe' (never read by the UI or cron).
 * Reads it back to confirm. Deletes it. If the RPC is broken, the
 * error comes back here loud.
 *
 * NON-MUTATING beyond a single throwaway row that is cleaned up at
 * the end. If cleanup fails, delete manually:
 *   DELETE FROM meta_stats WHERE source = 'probe';
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
  const testRow = {
    brawler_id: 99999999,  // fake ID, unlikely to collide
    map: '__probe_map__',
    mode: 'brawlBall',
    source: 'probe',
    date: today,
    wins: 1,
    losses: 0,
    total: 1,
  }

  console.log('=== bulk_upsert_meta_stats probe ===')
  console.log(`Today: ${today}`)
  console.log(`Test row: ${JSON.stringify(testRow)}`)
  console.log('')

  console.log('1. Calling bulk_upsert_meta_stats...')
  const { data: upsertData, error: upsertErr } = await admin.rpc(
    'bulk_upsert_meta_stats',
    { rows: [testRow] },
  )
  if (upsertErr) {
    console.error(`   FAILED: ${upsertErr.message}`)
    console.error(`   details:`, upsertErr)
  } else {
    console.log(`   OK — returned:`, upsertData)
  }
  console.log('')

  console.log('2. Reading back the probe row...')
  const { data: readData, error: readErr } = await admin
    .from('meta_stats')
    .select('*')
    .eq('source', 'probe')
    .eq('brawler_id', 99999999)
  if (readErr) {
    console.error(`   READ FAILED: ${readErr.message}`)
  } else {
    console.log(`   rows found: ${readData?.length ?? 0}`)
    if (readData && readData.length > 0) {
      console.log(`   row contents:`, readData[0])
    }
  }
  console.log('')

  console.log('3. Cleanup — deleting probe rows...')
  const { error: delErr } = await admin
    .from('meta_stats')
    .delete()
    .eq('source', 'probe')
  if (delErr) {
    console.error(`   CLEANUP FAILED: ${delErr.message}`)
    console.error(`   Manual fix: DELETE FROM meta_stats WHERE source = 'probe';`)
  } else {
    console.log(`   OK`)
  }
})().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
