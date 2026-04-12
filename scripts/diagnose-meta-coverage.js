#!/usr/bin/env node
/**
 * Meta-poll coverage diagnostics for the BrawlVision project.
 *
 * Questions this script answers (read-only, no writes):
 *
 *   1. How many battles are in the DB and over what time range?
 *   2. How many battles in the last 24h? 48h? 7d?
 *   3. Battles per hour of day — are there "dead windows" with 0 captures?
 *   4. Distribution by (map, mode) — which active maps are under-covered?
 *   5. Top-N most active players — who fills our pool?
 *   6. Overflow detection: for the top 50 most-active players, do we see
 *      gaps > 25 battles between consecutive captures?
 *   7. meta_stats shape: how many rows, which sources, how fresh?
 *   8. meta_poll_cursors: how many players polled, cursor freshness?
 *
 * This script uses the service-role Supabase client over PostgREST.
 * Schemas outside `public` (e.g. `cron.*`) are NOT accessible this way —
 * those are handled in a separate diagnose-cron-jobs.js script via an
 * RPC helper that needs to be applied as a migration first.
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Load .env.local
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

const H = (t) => `\n${'─'.repeat(3)} ${t} ${'─'.repeat(Math.max(0, 70 - t.length))}`

function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString('en-US') : String(n)
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log(' BrawlVision — Meta Coverage Diagnostic Report')
  console.log(` Generated: ${new Date().toISOString()}`)
  console.log('══════════════════════════════════════════════════════════════════')

  // ───────────────────────────────────────────────────────────────
  // 1. Total battles + temporal range
  // ───────────────────────────────────────────────────────────────
  console.log(H('1. Battles table — totals and temporal range'))

  const { count: totalBattles, error: e1 } = await admin
    .from('battles')
    .select('*', { count: 'exact', head: true })
  if (e1) throw e1
  console.log(`  Total battles in DB: ${fmt(totalBattles)}`)

  const { data: minRow } = await admin
    .from('battles')
    .select('battle_time')
    .order('battle_time', { ascending: true })
    .limit(1)
    .maybeSingle()
  const { data: maxRow } = await admin
    .from('battles')
    .select('battle_time')
    .order('battle_time', { ascending: false })
    .limit(1)
    .maybeSingle()
  console.log(`  Oldest battle:       ${minRow?.battle_time ?? 'none'}`)
  console.log(`  Most recent battle:  ${maxRow?.battle_time ?? 'none'}`)

  const now = new Date()
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const h48 = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { count: last24h } = await admin
    .from('battles')
    .select('*', { count: 'exact', head: true })
    .gte('battle_time', h24)
  const { count: last48h } = await admin
    .from('battles')
    .select('*', { count: 'exact', head: true })
    .gte('battle_time', h48)
  const { count: last7d } = await admin
    .from('battles')
    .select('*', { count: 'exact', head: true })
    .gte('battle_time', d7)
  console.log(`  Battles last 24h:    ${fmt(last24h)}`)
  console.log(`  Battles last 48h:    ${fmt(last48h)}`)
  console.log(`  Battles last 7d:     ${fmt(last7d)}`)

  // ───────────────────────────────────────────────────────────────
  // 2. Distinct players whose battles are in the DB
  // ───────────────────────────────────────────────────────────────
  console.log(H('2. Player coverage'))

  // Distinct player_tags with battles in last 24h (sample: just count batches)
  // PostgREST doesn't support DISTINCT cleanly, so we fetch and reduce.
  const { data: recentPlayers } = await admin
    .from('battles')
    .select('player_tag')
    .gte('battle_time', h24)
    .limit(10000)

  const uniquePlayers24h = new Set((recentPlayers ?? []).map((r) => r.player_tag))
  console.log(`  Distinct player_tags with battles in last 24h (first 10k sample): ${fmt(uniquePlayers24h.size)}`)

  const { data: recentPlayers48h } = await admin
    .from('battles')
    .select('player_tag')
    .gte('battle_time', h48)
    .limit(10000)
  const uniquePlayers48h = new Set((recentPlayers48h ?? []).map((r) => r.player_tag))
  console.log(`  Distinct player_tags with battles in last 48h: ${fmt(uniquePlayers48h.size)}`)

  // ───────────────────────────────────────────────────────────────
  // 3. Battles per hour of day (last 48h) — find dead windows
  // ───────────────────────────────────────────────────────────────
  console.log(H('3. Battles per hour (last 48h) — dead window detection'))

  const { data: recentBattles } = await admin
    .from('battles')
    .select('battle_time')
    .gte('battle_time', h48)
    .order('battle_time', { ascending: true })
    .limit(50000)

  const hourly = new Array(48).fill(0)
  if (recentBattles) {
    const nowMs = now.getTime()
    for (const b of recentBattles) {
      const t = new Date(b.battle_time).getTime()
      const hoursAgo = Math.floor((nowMs - t) / (60 * 60 * 1000))
      if (hoursAgo >= 0 && hoursAgo < 48) {
        hourly[47 - hoursAgo] += 1
      }
    }
  }
  console.log(`  (each row = 1 hour window, oldest → newest; bars scaled)`)
  const maxHourly = Math.max(1, ...hourly)
  for (let i = 0; i < 48; i++) {
    const hoursAgo = 47 - i
    const bar = '█'.repeat(Math.round((hourly[i] / maxHourly) * 30))
    const label = hoursAgo === 0 ? 'now-1h ' : `${hoursAgo}h-${hoursAgo + 1}h`
    console.log(`  ${label.padEnd(9)} ${fmt(hourly[i]).padStart(6)}  ${bar}`)
  }
  const deadWindows = hourly.filter((c) => c === 0).length
  const lowWindows = hourly.filter((c) => c > 0 && c < maxHourly * 0.1).length
  console.log(`\n  Dead hour windows (0 battles): ${deadWindows}/48`)
  console.log(`  Low hour windows  (<10% peak): ${lowWindows}/48`)

  // ───────────────────────────────────────────────────────────────
  // 4. Coverage by (map, mode) in the last 24h
  // ───────────────────────────────────────────────────────────────
  console.log(H('4. Battles per (map, mode) in last 24h'))

  const { data: mapBattles } = await admin
    .from('battles')
    .select('map, mode')
    .gte('battle_time', h24)
    .not('map', 'is', null)
    .limit(50000)

  const mapCount = new Map()
  if (mapBattles) {
    for (const b of mapBattles) {
      const key = `${b.mode ?? '??'} :: ${b.map ?? '??'}`
      mapCount.set(key, (mapCount.get(key) ?? 0) + 1)
    }
  }
  const sortedMaps = [...mapCount.entries()].sort((a, b) => b[1] - a[1])
  console.log(`  Total distinct (map, mode) combos in last 24h: ${sortedMaps.length}`)
  console.log(`  Top 20 most-covered:`)
  for (const [key, n] of sortedMaps.slice(0, 20)) {
    console.log(`    ${fmt(n).padStart(6)}  ${key}`)
  }
  console.log(`  Bottom 15 least-covered (>0 battles):`)
  for (const [key, n] of sortedMaps.slice(-15)) {
    console.log(`    ${fmt(n).padStart(6)}  ${key}`)
  }

  // ───────────────────────────────────────────────────────────────
  // 5. Top 30 most active players (by battle count in last 48h)
  // ───────────────────────────────────────────────────────────────
  console.log(H('5. Top 30 most-active players (last 48h)'))

  const playerBattleCount = new Map()
  if (recentPlayers48h) {
    for (const r of recentPlayers48h) {
      playerBattleCount.set(r.player_tag, (playerBattleCount.get(r.player_tag) ?? 0) + 1)
    }
  }
  const topPlayers = [...playerBattleCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
  for (const [tag, n] of topPlayers) {
    console.log(`    ${fmt(n).padStart(5)}  ${tag}`)
  }
  console.log(`\n  Players in sample: ${fmt(playerBattleCount.size)}`)
  console.log(`  Total battles counted: ${fmt([...playerBattleCount.values()].reduce((s, n) => s + n, 0))}`)

  // ───────────────────────────────────────────────────────────────
  // 6. Overflow detection: for top 10 active players, look at gap
  //    between consecutive battles. If there are long gaps during
  //    likely active periods, it's evidence of overflow (we missed
  //    batches because the 25-battle window overflowed between polls).
  // ───────────────────────────────────────────────────────────────
  console.log(H('6. Overflow detection — top 10 active players'))

  for (const [tag] of topPlayers.slice(0, 10)) {
    const { data: playerBattles } = await admin
      .from('battles')
      .select('battle_time')
      .eq('player_tag', tag)
      .gte('battle_time', h48)
      .order('battle_time', { ascending: true })
      .limit(500)

    if (!playerBattles || playerBattles.length < 2) {
      console.log(`  ${tag}: too few battles (${playerBattles?.length ?? 0}) for gap analysis`)
      continue
    }

    const gaps = []
    for (let i = 1; i < playerBattles.length; i++) {
      const prev = new Date(playerBattles[i - 1].battle_time).getTime()
      const curr = new Date(playerBattles[i].battle_time).getTime()
      gaps.push((curr - prev) / 1000 / 60) // minutes
    }

    const gapMedian = gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
    const gapP90 = gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length * 0.9)]
    const gapMax = Math.max(...gaps)
    const suspiciousGaps = gaps.filter((g) => g > 35 && g < 500).length // likely overflow, not "offline"

    console.log(
      `  ${tag}  battles=${playerBattles.length.toString().padStart(3)}  ` +
      `median_gap=${gapMedian.toFixed(1)}m  ` +
      `p90_gap=${gapP90.toFixed(1)}m  ` +
      `max_gap=${gapMax.toFixed(0)}m  ` +
      `suspicious_gaps=${suspiciousGaps}`,
    )
  }
  console.log(`\n  "suspicious_gaps" = gaps between 35 and 500 minutes — likely a poll`)
  console.log(`  missed a batch of battles (player played >25 in one poll window`)
  console.log(`  OR poll cadence > 30 min OR both). Gaps >500m are likely offline.`)

  // ───────────────────────────────────────────────────────────────
  // 7. meta_stats shape
  // ───────────────────────────────────────────────────────────────
  console.log(H('7. meta_stats — shape and freshness'))

  const { count: metaStatsTotal } = await admin
    .from('meta_stats')
    .select('*', { count: 'exact', head: true })
  console.log(`  Total rows: ${fmt(metaStatsTotal)}`)

  // Breakdown by source
  for (const source of ['global', 'users', 'pro']) {
    const { count } = await admin
      .from('meta_stats')
      .select('*', { count: 'exact', head: true })
      .eq('source', source)
    if (count && count > 0) {
      console.log(`    source='${source}':  ${fmt(count)} rows`)
    }
  }

  // Latest dates
  const { data: latestDates } = await admin
    .from('meta_stats')
    .select('date')
    .order('date', { ascending: false })
    .limit(5)
  if (latestDates && latestDates.length > 0) {
    const uniqueDates = [...new Set(latestDates.map((r) => r.date))]
    console.log(`  Most recent dates: ${uniqueDates.slice(0, 5).join(', ')}`)
  }

  // ───────────────────────────────────────────────────────────────
  // 8. meta_poll_cursors
  // ───────────────────────────────────────────────────────────────
  console.log(H('8. meta_poll_cursors — who is being polled'))

  const { count: pollCursorCount } = await admin
    .from('meta_poll_cursors')
    .select('*', { count: 'exact', head: true })
  console.log(`  Total cursors (distinct players in poll): ${fmt(pollCursorCount)}`)

  const { data: cursorFreshness } = await admin
    .from('meta_poll_cursors')
    .select('last_battle_time')
    .order('last_battle_time', { ascending: false })
    .limit(1)
  if (cursorFreshness?.[0]) {
    const freshest = new Date(cursorFreshness[0].last_battle_time)
    const ageMin = (now.getTime() - freshest.getTime()) / 1000 / 60
    console.log(`  Freshest cursor: ${freshest.toISOString()} (${ageMin.toFixed(0)} min ago)`)
  }

  const { data: stalestCursor } = await admin
    .from('meta_poll_cursors')
    .select('last_battle_time')
    .order('last_battle_time', { ascending: true })
    .limit(1)
  if (stalestCursor?.[0]) {
    const stalest = new Date(stalestCursor[0].last_battle_time)
    const ageMin = (now.getTime() - stalest.getTime()) / 1000 / 60
    console.log(`  Stalest cursor:  ${stalest.toISOString()} (${ageMin.toFixed(0)} min ago)`)
  }

  // Distribution of cursor age
  const { data: allCursors } = await admin
    .from('meta_poll_cursors')
    .select('last_battle_time')
    .limit(2000)

  if (allCursors) {
    const buckets = { '<30m': 0, '30-60m': 0, '1-3h': 0, '3-12h': 0, '12-24h': 0, '>24h': 0 }
    for (const c of allCursors) {
      const ageMin = (now.getTime() - new Date(c.last_battle_time).getTime()) / 1000 / 60
      if (ageMin < 30) buckets['<30m']++
      else if (ageMin < 60) buckets['30-60m']++
      else if (ageMin < 180) buckets['1-3h']++
      else if (ageMin < 720) buckets['3-12h']++
      else if (ageMin < 1440) buckets['12-24h']++
      else buckets['>24h']++
    }
    console.log(`  Cursor age distribution (sample of ${fmt(allCursors.length)}):`)
    for (const [label, n] of Object.entries(buckets)) {
      console.log(`    ${label.padEnd(7)} ${fmt(n).padStart(5)}`)
    }
  }

  // ───────────────────────────────────────────────────────────────
  // 9. meta_stats coverage by (map, mode) for TODAY — the real
  //    signal for "are we covering active maps well enough?"
  // ───────────────────────────────────────────────────────────────
  console.log(H('9. meta_stats coverage by (map, mode) for TODAY'))

  const today = now.toISOString().slice(0, 10)
  const { data: todayMeta } = await admin
    .from('meta_stats')
    .select('map, mode, source, total')
    .eq('date', today)
    .limit(10000)

  if (todayMeta && todayMeta.length > 0) {
    // Aggregate by (mode, map) across all brawlers
    const mapTotals = new Map()
    const mapBrawlerCount = new Map()
    for (const r of todayMeta) {
      if (r.source !== 'global') continue
      const key = `${r.mode} :: ${r.map}`
      mapTotals.set(key, (mapTotals.get(key) ?? 0) + r.total)
      mapBrawlerCount.set(key, (mapBrawlerCount.get(key) ?? 0) + 1)
    }
    const sorted = [...mapTotals.entries()].sort((a, b) => b[1] - a[1])
    console.log(`  Distinct (map, mode) with global data TODAY: ${sorted.length}`)
    console.log(`  Sorted by total battles (desc) — all maps shown:\n`)
    for (const [key, total] of sorted) {
      const brawlers = mapBrawlerCount.get(key) ?? 0
      const bar = '█'.repeat(Math.min(30, Math.round(total / 10)))
      console.log(`    ${fmt(total).padStart(5)} battles · ${brawlers.toString().padStart(2)} brawlers  ${key}  ${bar}`)
    }
  } else {
    console.log('  No meta_stats rows for today')
  }

  // ───────────────────────────────────────────────────────────────
  // 10. meta_stats inserted-time pattern — are there bursts or
  //     continuous flow? (Uses `date`, so only daily granularity —
  //     for intra-day we would need a `created_at` column.)
  // ───────────────────────────────────────────────────────────────
  console.log(H('10. meta_stats freshness per day (last 7 days)'))

  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().slice(0, 10)
    const { count } = await admin
      .from('meta_stats')
      .select('*', { count: 'exact', head: true })
      .eq('date', dateStr)
      .eq('source', 'global')
    console.log(`    ${dateStr}:  ${fmt(count ?? 0).padStart(6)} rows (source=global)`)
  }

  // ───────────────────────────────────────────────────────────────
  // 11. meta_stats cron job visibility — attempted via RPC
  // ───────────────────────────────────────────────────────────────
  console.log(H('11. cron.job inspection (requires diagnose-cron-helper RPC)'))

  const { data: cronJobs, error: cronErr } = await admin.rpc('diagnose_cron_jobs')
  if (cronErr) {
    console.log(`  RPC diagnose_cron_jobs not installed yet.`)
    console.log(`  To enable: apply supabase/migrations/010_cron_diagnostic_helpers.sql`)
    console.log(`  via Dashboard → SQL Editor. Then re-run this script.`)
  } else if (cronJobs && cronJobs.length > 0) {
    console.log(`  Active cron jobs:`)
    for (const j of cronJobs) {
      console.log(`    ${j.jobname.padEnd(36)}  schedule=${j.schedule.padEnd(14)}  active=${j.active}`)
    }

    const { data: cronRuns } = await admin.rpc('diagnose_cron_runs', { p_limit: 10 })
    if (cronRuns && cronRuns.length > 0) {
      console.log(`\n  Last 10 cron runs:`)
      for (const r of cronRuns) {
        const duration =
          r.end_time && r.start_time
            ? ((new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 1000).toFixed(1) + 's'
            : 'running'
        console.log(`    ${r.jobname.padEnd(32)}  ${r.start_time}  ${r.status.padEnd(10)}  ${duration}`)
      }
    }
  } else {
    console.log(`  RPC returned zero jobs (pg_cron may not be set up in this project).`)
  }

  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log(' End of diagnostic report')
  console.log('══════════════════════════════════════════════════════════════════\n')
}

main().catch((err) => {
  console.error('✗ Unexpected error:', err)
  process.exit(1)
})
