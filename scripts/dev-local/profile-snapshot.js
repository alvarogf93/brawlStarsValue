#!/usr/bin/env node
/**
 * Local-only profile snapshot + verify tool.
 *
 * Usage:
 *   node scripts/dev-local/profile-snapshot.js snapshot #YJU282PV
 *   node scripts/dev-local/profile-snapshot.js verify #YJU282PV
 *
 * `snapshot` dumps the full `profiles` row + a summary of `battles`
 * for the given player tag to `.profile-snapshot-<tag>.json` in the
 * project root. The snapshot file is gitignored via `/.profile-*`.
 *
 * `verify` reads the snapshot back and compares every field. Reports
 * any drift so you can tell whether OAuth testing corrupted anything.
 *
 * NEVER MUTATES. Read-only against `profiles` and `battles`.
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

const [, , action, rawTag] = process.argv

if (!action || !rawTag) {
  console.error('Usage: node scripts/dev-local/profile-snapshot.js [snapshot|verify] #PLAYERTAG')
  process.exit(1)
}

const tag = rawTag.startsWith('#') ? rawTag : `#${rawTag}`
const snapshotPath = path.join(
  __dirname,
  '..',
  '..',
  `.profile-snapshot-${tag.replace('#', '')}.json`,
)

async function fetchState(playerTag) {
  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('*')
    .eq('player_tag', playerTag)
    .maybeSingle()
  if (pErr) throw pErr

  const { count: battleCount } = await admin
    .from('battles')
    .select('*', { count: 'exact', head: true })
    .eq('player_tag', playerTag)

  const { data: newestBattle } = await admin
    .from('battles')
    .select('battle_time')
    .eq('player_tag', playerTag)
    .order('battle_time', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    capturedAt: new Date().toISOString(),
    playerTag,
    profile,
    battles: {
      count: battleCount ?? 0,
      newestBattleTime: newestBattle?.battle_time ?? null,
    },
  }
}

async function snapshot() {
  console.log(`→ Capturing snapshot for ${tag}...`)
  const state = await fetchState(tag)
  if (!state.profile) {
    console.error(`✗ No profile found for ${tag}`)
    process.exit(1)
  }
  fs.writeFileSync(snapshotPath, JSON.stringify(state, null, 2) + '\n')
  console.log(`✓ Snapshot written to ${path.relative(process.cwd(), snapshotPath)}`)
  console.log('\nKey fields for your reference:')
  console.log(`  player_tag:             ${state.profile.player_tag}`)
  console.log(`  tier:                   ${state.profile.tier}`)
  console.log(`  trial_ends_at:          ${state.profile.trial_ends_at ?? '(null)'}`)
  console.log(`  ls_subscription_status: ${state.profile.ls_subscription_status ?? '(null)'}`)
  console.log(`  referral_code:          ${state.profile.referral_code ?? '(null)'}`)
  console.log(`  referral_count:         ${state.profile.referral_count ?? 0}`)
  console.log(`  last_sync:              ${state.profile.last_sync ?? '(never)'}`)
  console.log(`  battles total:          ${state.battles.count}`)
  console.log(`  newest battle:          ${state.battles.newestBattleTime ?? '(none)'}`)
  console.log('\nReady to test. When done, run:')
  console.log(`  node scripts/dev-local/profile-snapshot.js verify ${tag}`)
}

// Fields that legitimately change during testing and are NOT drift:
// - updated_at: touched every profile query with ?onConflict; expected
// - last_sync: changes on any manual sync; expected
// - battles.count + battles.newestBattleTime: grow as new battles sync; expected
//   (we report them as INFO, not as drift)
const EXPECTED_CHANGES = new Set(['updated_at', 'last_sync'])

async function verify() {
  if (!fs.existsSync(snapshotPath)) {
    console.error(`✗ No snapshot found at ${snapshotPath}. Run 'snapshot' first.`)
    process.exit(1)
  }
  const before = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'))
  console.log(`→ Loaded snapshot from ${before.capturedAt}`)
  console.log(`→ Fetching current state for ${tag}...`)
  const after = await fetchState(tag)

  if (!after.profile) {
    console.error(`✗ DRIFT: profile row no longer exists for ${tag}!`)
    console.error('  This is a SERIOUS regression — your profile was deleted somehow.')
    console.error('  Restore from the snapshot file manually via Supabase SQL editor.')
    process.exit(2)
  }

  // Compare profile fields
  const drift = []
  const info = []
  const allKeys = new Set([
    ...Object.keys(before.profile ?? {}),
    ...Object.keys(after.profile),
  ])
  for (const key of allKeys) {
    const b = before.profile?.[key]
    const a = after.profile[key]
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      if (EXPECTED_CHANGES.has(key)) {
        info.push({ key, before: b, after: a })
      } else {
        drift.push({ key, before: b, after: a })
      }
    }
  }

  // Battles: we only care about DECREASES. Increases are normal (cron sync).
  const battleDrift = []
  if (after.battles.count < before.battles.count) {
    battleDrift.push({
      key: 'battles.count',
      before: before.battles.count,
      after: after.battles.count,
      note: `Lost ${before.battles.count - after.battles.count} battles`,
    })
  }

  console.log('')
  if (info.length > 0) {
    console.log('ℹ  Expected changes (not drift):')
    for (const i of info) console.log(`   ${i.key}: ${JSON.stringify(i.before)} → ${JSON.stringify(i.after)}`)
    console.log('')
  }

  if (drift.length === 0 && battleDrift.length === 0) {
    console.log('✓ NO DRIFT — all critical profile + battles fields intact.')
    console.log('')
    console.log(`  Profile tier:        ${after.profile.tier}`)
    console.log(`  Trial ends:          ${after.profile.trial_ends_at ?? '(null)'}`)
    console.log(`  Battles now:         ${after.battles.count} (was ${before.battles.count})`)
    if (after.battles.count > before.battles.count) {
      console.log(`  (+${after.battles.count - before.battles.count} new battles from cron sync, expected)`)
    }
    process.exit(0)
  }

  console.log('✗ DRIFT DETECTED:')
  for (const d of drift) {
    console.log(`   ${d.key}:`)
    console.log(`     before: ${JSON.stringify(d.before)}`)
    console.log(`     after:  ${JSON.stringify(d.after)}`)
  }
  for (const d of battleDrift) {
    console.log(`   ${d.key}: ${d.note}`)
    console.log(`     before: ${d.before}`)
    console.log(`     after:  ${d.after}`)
  }
  console.log('')
  console.log('⚠  Review the drift above. If any field changed unexpectedly,')
  console.log('   you can restore it manually from the snapshot file:')
  console.log(`   ${path.relative(process.cwd(), snapshotPath)}`)
  process.exit(3)
}

;(async () => {
  try {
    if (action === 'snapshot') await snapshot()
    else if (action === 'verify') await verify()
    else {
      console.error(`Unknown action: ${action}. Use 'snapshot' or 'verify'.`)
      process.exit(1)
    }
  } catch (err) {
    console.error('✗ Fatal:', err)
    process.exit(1)
  }
})()
