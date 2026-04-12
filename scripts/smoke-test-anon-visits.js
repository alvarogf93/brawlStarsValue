#!/usr/bin/env node
/**
 * End-to-end smoke test for anonymous visit tracking against PRODUCTION.
 *
 * Uses a fixed test tag that already appears in the repo test fixtures
 * (`#YJU282PV`). Probes /api/calculate with different bodies and verifies
 * the effect on the `anonymous_visits` table via the service-role client.
 *
 * Steps:
 *   A. Pre-cleanup — ensure the test tag is not in anonymous_visits (leftover)
 *   B. Confirm the test tag is NOT in profiles (otherwise Guard 2 would skip it)
 *   C. Happy path  — POST {fromLanding:true, locale:'es'} → expect INSERT + Telegram
 *   D. Re-entry    — POST same body             → expect UPDATE, visit_count=2
 *   E. No landing  — POST {fromLanding:false}   → expect no new row, visit_count stays 2
 *   F. Injection   — POST {locale:'<b>evil</b>'} → expect no new row, visit_count stays 2
 *   G. Final state read for reporting
 *   H. Post-cleanup — delete the test row
 *
 * The Telegram message visibility must be confirmed by the human out of band.
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

const PROD_URL = 'https://www.brawlvision.com'
// Picked by scripts/pick-unregistered-tag.js — top-200 player not in profiles.
const TEST_TAG = '#LGVY0QGP9'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function postCalculate(body, label) {
  const res = await fetch(`${PROD_URL}/api/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = text }
  console.log(`  POST /api/calculate [${label}] → ${res.status}`)
  if (res.status >= 400) {
    console.log(`    body:`, typeof parsed === 'string' ? parsed.slice(0, 200) : JSON.stringify(parsed).slice(0, 200))
  }
  return { status: res.status, body: parsed }
}

async function getRow() {
  const { data, error } = await admin
    .from('anonymous_visits')
    .select('tag, locale, visit_count, first_visit_at, last_visit_at')
    .eq('tag', TEST_TAG)
    .maybeSingle()
  if (error) throw error
  return data
}

async function main() {
  console.log('\n── Task 8 — step 3: end-to-end smoke test against PRODUCTION ──\n')
  console.log(`  test tag: ${TEST_TAG}`)
  console.log(`  target:   ${PROD_URL}\n`)

  // ── A. Pre-cleanup ──
  console.log('A. Pre-cleanup anonymous_visits')
  const { error: eA } = await admin.from('anonymous_visits').delete().eq('tag', TEST_TAG)
  if (eA) { console.error('  ✗ failed:', eA.message); process.exit(1) }
  console.log('  ✓ any stale row removed\n')

  // ── B. Confirm tag is NOT in profiles (Guard 2) ──
  console.log('B. Verify test tag is not in profiles (Guard 2 would skip it)')
  const { data: profileHit, error: eB } = await admin
    .from('profiles')
    .select('id')
    .eq('player_tag', TEST_TAG)
    .maybeSingle()
  if (eB) { console.error('  ✗ profiles query failed:', eB.message); process.exit(1) }
  if (profileHit) {
    console.error(`  ✗ test tag ${TEST_TAG} is already a registered profile — Guard 2 would block tracking`)
    console.error('    Pick a different test tag and re-run.')
    process.exit(1)
  }
  console.log('  ✓ tag is not registered in profiles\n')

  // ── C. Happy path ──
  console.log('C. Happy path — fromLanding:true, anonymous, whitelisted locale')
  const { status: statusC } = await postCalculate(
    { playerTag: TEST_TAG, fromLanding: true, locale: 'es' },
    'happy',
  )
  if (statusC !== 200) {
    console.error(`  ✗ expected 200, got ${statusC} — aborting`)
    process.exit(1)
  }
  console.log('  ⏳ waiting 3s for after() callback to execute post-response...')
  await sleep(3000)
  const rowC = await getRow()
  if (!rowC) {
    console.error('  ✗ expected a row to be INSERTED but none found')
    console.error('    Possible causes: Supercell returned 404, after() did not fire, or notify() crashed.')
    process.exit(1)
  }
  if (rowC.visit_count !== 1) {
    console.error(`  ✗ expected visit_count=1, got ${rowC.visit_count}`)
    process.exit(1)
  }
  console.log(`  ✓ row inserted — visit_count=1, locale=${rowC.locale}`)
  console.log(`    first_visit_at=${rowC.first_visit_at}`)
  console.log(`  ✓ Telegram notify() should have fired — HUMAN CONFIRMATION NEEDED LATER\n`)

  // ── D. Re-entry ──
  console.log('D. Re-entry — same tag, fromLanding:true')
  const { status: statusD } = await postCalculate(
    { playerTag: TEST_TAG, fromLanding: true, locale: 'es' },
    're-entry',
  )
  if (statusD !== 200) {
    console.error(`  ✗ expected 200, got ${statusD}`)
    process.exit(1)
  }
  await sleep(3000)
  const rowD = await getRow()
  if (!rowD || rowD.visit_count !== 2) {
    console.error(`  ✗ expected visit_count=2, got ${rowD?.visit_count}`)
    process.exit(1)
  }
  console.log(`  ✓ row updated — visit_count=2 (NO second Telegram expected)\n`)

  // ── E. No landing flag ──
  console.log('E. No landing flag — fromLanding:false')
  const { status: statusE } = await postCalculate(
    { playerTag: TEST_TAG, fromLanding: false, locale: 'es' },
    'no-landing',
  )
  if (statusE !== 200) {
    console.error(`  ✗ expected 200, got ${statusE}`)
    process.exit(1)
  }
  await sleep(2000)
  const rowE = await getRow()
  if (!rowE || rowE.visit_count !== 2) {
    console.error(`  ✗ visit_count changed unexpectedly: ${rowE?.visit_count}`)
    process.exit(1)
  }
  console.log(`  ✓ visit_count still 2 — no tracking without fromLanding\n`)

  // ── F. Injection attempt ──
  console.log('F. Injection attempt — locale:"<b>evil</b>"')
  const { status: statusF } = await postCalculate(
    { playerTag: TEST_TAG, fromLanding: true, locale: '<b>evil</b>' },
    'injection',
  )
  if (statusF !== 200) {
    console.error(`  ✗ expected 200, got ${statusF}`)
    process.exit(1)
  }
  await sleep(2000)
  const rowF = await getRow()
  if (!rowF || rowF.visit_count !== 2) {
    console.error(`  ✗ visit_count changed unexpectedly: ${rowF?.visit_count}`)
    process.exit(1)
  }
  console.log(`  ✓ visit_count still 2 — whitelist rejected the bad locale\n`)

  // ── G. Final state ──
  console.log('G. Final state of test row:')
  console.log(`    tag            = ${rowF.tag}`)
  console.log(`    locale         = ${rowF.locale}`)
  console.log(`    visit_count    = ${rowF.visit_count}`)
  console.log(`    first_visit_at = ${rowF.first_visit_at}`)
  console.log(`    last_visit_at  = ${rowF.last_visit_at}\n`)

  // ── H. Post-cleanup ──
  console.log('H. Post-cleanup')
  const { error: eH } = await admin.from('anonymous_visits').delete().eq('tag', TEST_TAG)
  if (eH) { console.error('  ✗ cleanup failed:', eH.message); process.exit(1) }
  const remaining = await getRow()
  if (remaining) {
    console.error('  ✗ cleanup DELETE succeeded but row still present?')
    process.exit(1)
  }
  console.log('  ✓ test row deleted — production anonymous_visits is clean\n')

  console.log('═════════════════════════════════════════════════════════')
  console.log(' SMOKE TEST PASSED — all 4 scenarios behaved correctly.')
  console.log(' Waiting on ONE human confirmation: Telegram message received.')
  console.log('═════════════════════════════════════════════════════════\n')
}

main().catch((err) => {
  console.error('\n✗ Unexpected error:', err)
  process.exit(1)
})
