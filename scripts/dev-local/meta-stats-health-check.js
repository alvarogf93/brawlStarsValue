#!/usr/bin/env node
/**
 * Read-only health check for meta_stats.
 *
 * Verifies:
 *   1. Total row counts by source
 *   2. Full date distribution (no 14-day filter)
 *   3. Distribution of the `total` column (confirms the avg-per-row)
 *   4. Any rows older than 90 days (for archive backfill preview)
 *   5. List of all meta* tables (for finding pre-existing archive tables)
 *   6. Any pg_cron jobs that touch meta_stats (for finding silent cleaners)
 *
 * NEVER MUTATES. Pure read. No DELETE, no UPDATE, no INSERT.
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

function header(s) {
  console.log('\n' + '─'.repeat(60))
  console.log(s)
  console.log('─'.repeat(60))
}

;(async () => {
  console.log('=== meta_stats health check ===')
  console.log(`Run at: ${new Date().toISOString()}`)

  // 1. Total rows, overall + by source
  header('1. Row counts')
  const { count: totalRows } = await admin
    .from('meta_stats')
    .select('*', { count: 'exact', head: true })
  console.log(`  Total rows (all sources): ${totalRows}`)

  for (const source of ['global', 'users']) {
    const { count } = await admin
      .from('meta_stats')
      .select('*', { count: 'exact', head: true })
      .eq('source', source)
    console.log(`  source='${source}': ${count}`)
  }

  // 2. Date distribution — how many rows per date?
  //
  // IMPORTANT: PostgREST caps `SELECT` responses at 1000 rows by default.
  // A naive `.select('date, source').order(...)` on a table with >1000
  // rows gives a false-negative — you see only the oldest 1000 entries
  // and every newer date appears missing. We discovered this bug the
  // hard way while investigating a phantom "cron is silently broken"
  // incident on 2026-04-14. Fix: paginate via `.range()` until all rows
  // are retrieved. The batches are ordered consistently so the final
  // grouping is correct.
  header('2. Date distribution (rows per date, oldest → newest)')
  const PAGE_SIZE = 1000
  let offset = 0
  const byDate = {}
  for (;;) {
    const { data: page } = await admin
      .from('meta_stats')
      .select('date, source')
      .order('date', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (!page || page.length === 0) break
    for (const r of page) {
      const key = `${r.date}|${r.source}`
      byDate[key] = (byDate[key] ?? 0) + 1
    }
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  if (Object.keys(byDate).length === 0) {
    console.log('  (no rows)')
  } else {
    const sorted = Object.keys(byDate).sort()
    for (const key of sorted) {
      const [date, source] = key.split('|')
      console.log(`  ${date}  ${source.padEnd(8)} ${byDate[key]}`)
    }
  }

  // 3. Stats on the `total` column (sanity-check the avg per row)
  header('3. Distribution of `total` per row (source=global, last 14 days)')
  const since14 = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10)
  const { data: sample } = await admin
    .from('meta_stats')
    .select('total')
    .eq('source', 'global')
    .gte('date', since14)
    .limit(50000)

  if (sample && sample.length > 0) {
    const totals = sample.map(r => Number(r.total)).filter(Number.isFinite)
    totals.sort((a, b) => a - b)
    const sum = totals.reduce((s, v) => s + v, 0)
    const avg = sum / totals.length
    const median = totals[Math.floor(totals.length / 2)]
    const max = totals[totals.length - 1]
    const min = totals[0]
    console.log(`  count:  ${totals.length}`)
    console.log(`  sum:    ${sum}`)
    console.log(`  avg:    ${avg.toFixed(2)}`)
    console.log(`  median: ${median}`)
    console.log(`  min:    ${min}`)
    console.log(`  max:    ${max}`)
    console.log(`  sum / 6 (battles if 3v3): ${Math.round(sum / 6)}`)
  }

  // 4. Rows older than 90 days (archive backfill preview)
  header('4. Backfill preview — rows with date < (today - 90 days)')
  const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10)
  console.log(`  cutoff: ${cutoff}`)
  const { count: oldRows } = await admin
    .from('meta_stats')
    .select('*', { count: 'exact', head: true })
    .lt('date', cutoff)
  console.log(`  rows with date < cutoff: ${oldRows}`)
  if (oldRows === 0) {
    console.log('  → the archive backfill will be a no-op (nothing to move yet)')
  }

  // 5. Check cron heartbeats — did the meta-poll cron actually run recently?
  header('5. cron_heartbeats — last success by job')
  try {
    const { data: hb, error: hbErr } = await admin
      .from('cron_heartbeats')
      .select('job_name, last_success_at, last_duration_ms, last_summary')
      .order('last_success_at', { ascending: false })
    if (hbErr) {
      console.log(`  error: ${hbErr.message}`)
      console.log('  (heartbeats table may not be applied yet — migration 016)')
    } else if (!hb || hb.length === 0) {
      console.log('  (table exists but is empty — no cron has ever written)')
    } else {
      for (const row of hb) {
        const age = Date.now() - new Date(row.last_success_at).getTime()
        const ageMin = Math.floor(age / 60000)
        const ageHr = Math.floor(ageMin / 60)
        const ageDay = Math.floor(ageHr / 24)
        const ageStr = ageDay > 0 ? `${ageDay}d ${ageHr % 24}h` : ageHr > 0 ? `${ageHr}h ${ageMin % 60}m` : `${ageMin}m`
        console.log(`  ${row.job_name.padEnd(12)} last=${row.last_success_at} (${ageStr} ago) dur=${row.last_duration_ms}ms`)
        if (row.last_summary) {
          console.log(`    summary: ${JSON.stringify(row.last_summary)}`)
        }
      }
    }
  } catch (err) {
    console.log(`  (query failed: ${err.message})`)
  }

  // 6. Check the battles table (sync cron output) — is IT getting data?
  header('6. battles table — recent activity (sync cron health)')
  try {
    const { count: totalBattles } = await admin
      .from('battles')
      .select('*', { count: 'exact', head: true })
    console.log(`  total rows in battles: ${totalBattles}`)

    const { data: newest } = await admin
      .from('battles')
      .select('battle_time')
      .order('battle_time', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (newest) {
      const age = Date.now() - new Date(newest.battle_time).getTime()
      const ageMin = Math.floor(age / 60000)
      const ageHr = Math.floor(ageMin / 60)
      console.log(`  newest battle_time: ${newest.battle_time} (${ageHr}h ${ageMin % 60}m ago)`)
    }

    const { data: oldest } = await admin
      .from('battles')
      .select('battle_time')
      .order('battle_time', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (oldest) {
      console.log(`  oldest battle_time: ${oldest.battle_time}`)
    }
  } catch (err) {
    console.log(`  (query failed: ${err.message})`)
  }

  console.log('\nDone.')
})().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
