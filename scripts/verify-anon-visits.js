#!/usr/bin/env node
/**
 * Task 8 verification helper for anonymous_visits.
 *
 * Loads .env.local, creates a service-role Supabase client, and runs:
 *   1. Table existence probe (SELECT with COUNT)
 *   2. RPC dry run (insert + re-entry) with #TESTTAG1
 *   3. Cleanup of the test row
 *
 * Never prints secrets. Never leaves test data behind.
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// ── Load .env.local (Node scripts don't auto-load Next.js env files) ──
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const TEST_TAG = '#TESTTAG1'

async function cleanupTestRow(label) {
  const { error } = await admin
    .from('anonymous_visits')
    .delete()
    .eq('tag', TEST_TAG)
  if (error) {
    console.error(`✗ ${label}: cleanup failed →`, error.message)
    return false
  }
  console.log(`✓ ${label}: cleanup ok`)
  return true
}

async function main() {
  console.log('\n── Task 8 — step 1: schema verification ──\n')

  // 1a. Table exists (SELECT with count)
  const { count: initialCount, error: e1 } = await admin
    .from('anonymous_visits')
    .select('*', { count: 'exact', head: true })
  if (e1) {
    console.error('✗ anonymous_visits table query failed →', e1.message)
    process.exit(1)
  }
  console.log(`✓ anonymous_visits table reachable — current row count: ${initialCount ?? '?'}`)

  // 1b. Pre-emptive cleanup in case a previous run left #TESTTAG1 behind
  await cleanupTestRow('pre-cleanup')

  // 2a. First RPC call — expect true (INSERT)
  const { data: first, error: e2 } = await admin.rpc('track_anonymous_visit', {
    p_tag: TEST_TAG,
    p_locale: 'es',
  })
  if (e2) {
    console.error('✗ RPC first call failed →', e2.message)
    process.exit(1)
  }
  if (first !== true) {
    console.error(`✗ Expected RPC first call to return true, got: ${JSON.stringify(first)}`)
    await cleanupTestRow('abort-cleanup')
    process.exit(1)
  }
  console.log('✓ RPC first call returned true (INSERT path)')

  // 2b. Second RPC call — expect false (UPDATE)
  const { data: second, error: e3 } = await admin.rpc('track_anonymous_visit', {
    p_tag: TEST_TAG,
    p_locale: 'es',
  })
  if (e3) {
    console.error('✗ RPC second call failed →', e3.message)
    await cleanupTestRow('abort-cleanup')
    process.exit(1)
  }
  if (second !== false) {
    console.error(`✗ Expected RPC second call to return false, got: ${JSON.stringify(second)}`)
    await cleanupTestRow('abort-cleanup')
    process.exit(1)
  }
  console.log('✓ RPC second call returned false (UPDATE path)')

  // 2c. Verify visit_count = 2
  const { data: row, error: e4 } = await admin
    .from('anonymous_visits')
    .select('tag, locale, visit_count, first_visit_at, last_visit_at')
    .eq('tag', TEST_TAG)
    .maybeSingle()
  if (e4 || !row) {
    console.error('✗ Could not read test row →', e4?.message ?? 'no row')
    await cleanupTestRow('abort-cleanup')
    process.exit(1)
  }
  if (row.visit_count !== 2) {
    console.error(`✗ Expected visit_count=2, got ${row.visit_count}`)
    await cleanupTestRow('abort-cleanup')
    process.exit(1)
  }
  console.log(`✓ Row state: tag=${row.tag} locale=${row.locale} visit_count=${row.visit_count}`)
  console.log(`  first_visit_at=${row.first_visit_at}`)
  console.log(`  last_visit_at =${row.last_visit_at}`)

  // 3. Cleanup
  await cleanupTestRow('post-cleanup')

  console.log('\n✓ Schema verification PASSED — migration is live and the RPC works correctly.\n')
}

main().catch((err) => {
  console.error('✗ Unexpected error:', err)
  process.exit(1)
})
