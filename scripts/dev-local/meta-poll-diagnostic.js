#!/usr/bin/env node
/**
 * Read-only diagnostic for the meta-poll balance algorithm.
 *
 * Calls the Supabase RPC `sum_meta_stats_by_map_mode` (same one the
 * cron uses to preload cumulative counts) and prints the top N
 * `(map, mode)` pairs by battle count for the last 14 days with
 * source='global'. Highlights the asymmetry-of-supply hypothesis
 * by grouping by mode and showing the min/max/median spread.
 *
 * NEVER MUTATES. Pure read. Uses the same env vars the cron reads.
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

const ROLLING_DAYS = 14

function fmt(n) {
  return String(n).padStart(6, ' ')
}

function bar(value, max, width = 40) {
  const frac = max > 0 ? value / max : 0
  const filled = Math.round(frac * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function median(nums) {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

;(async () => {
  const since = new Date(Date.now() - ROLLING_DAYS * 86400_000)
    .toISOString()
    .slice(0, 10)

  console.log(`\n=== meta-poll diagnostic ===`)
  console.log(`Rolling window: last ${ROLLING_DAYS} days (since ${since})`)
  console.log(`Source: global`)
  console.log('')

  const { data, error } = await admin.rpc('sum_meta_stats_by_map_mode', {
    p_since: since,
    p_source: 'global',
  })

  if (error) {
    console.error('RPC error:', error)
    process.exit(1)
  }
  if (!data || data.length === 0) {
    console.error('No rows returned. Either the RPC is missing or there is no global data yet.')
    process.exit(1)
  }

  // Normalize: the RPC returns rows shaped { map, mode, total }
  const rows = data
    .map(r => ({ map: r.map, mode: r.mode, total: Number(r.total) || 0 }))
    .filter(r => r.map && r.mode)
    .sort((a, b) => b.total - a.total)

  console.log(`Total (map, mode) pairs in window: ${rows.length}`)
  console.log(`Total battles recorded:            ${rows.reduce((s, r) => s + r.total, 0)}`)
  console.log('')

  // Top 30 overall
  const topMax = rows[0]?.total ?? 1
  console.log(`--- TOP 30 (map, mode) by count ---`)
  console.log(`${'#'.padEnd(3)} ${'count'.padStart(6)}  mode              map`)
  rows.slice(0, 30).forEach((r, i) => {
    console.log(
      `${String(i + 1).padEnd(3)} ${fmt(r.total)}  ${r.mode.padEnd(16)}  ${r.map}`,
    )
  })
  console.log('')

  // Group by mode and show min/max/median spread
  const byMode = {}
  for (const r of rows) {
    if (!byMode[r.mode]) byMode[r.mode] = []
    byMode[r.mode].push(r)
  }

  console.log(`--- Per-mode spread (asymmetry check) ---`)
  const modeOrder = Object.keys(byMode).sort(
    (a, b) => byMode[b].reduce((s, r) => s + r.total, 0) - byMode[a].reduce((s, r) => s + r.total, 0),
  )
  for (const mode of modeOrder) {
    const modeRows = byMode[mode].sort((a, b) => b.total - a.total)
    const counts = modeRows.map(r => r.total)
    const max = counts[0]
    const min = counts[counts.length - 1]
    const med = median(counts)
    const ratio = max > 0 ? (min / max).toFixed(3) : 'n/a'
    console.log(
      `  ${mode.padEnd(16)} maps=${String(modeRows.length).padStart(2)}  max=${fmt(max)}  med=${fmt(Math.round(med))}  min=${fmt(min)}  (min/max=${ratio})`,
    )
  }
  console.log('')

  // Zoom on brawlBall (the user's reported case)
  console.log(`--- brawlBall detail ---`)
  const bb = (byMode.brawlBall ?? []).sort((a, b) => b.total - a.total)
  if (bb.length === 0) {
    console.log('  (no brawlBall rows in window)')
  } else {
    const bbMax = bb[0].total
    bb.forEach(r => {
      const isSunny = /sunny/i.test(r.map)
      const marker = isSunny ? '  <<<' : ''
      console.log(
        `  ${fmt(r.total)}  ${bar(r.total, bbMax, 30)}  ${r.map}${marker}`,
      )
    })
  }
  console.log('')

  // Per-mode target preview using current constants (floor=500, ratio=0.6)
  const FLOOR = 500
  const RATIO = 0.6
  console.log(`--- Target check per mode (floor=${FLOOR}, ratio=${RATIO}) ---`)
  for (const mode of modeOrder) {
    const modeRows = byMode[mode]
    const max = Math.max(...modeRows.map(r => r.total))
    const target = Math.max(FLOOR, Math.floor(max * RATIO))
    const under = modeRows.filter(r => r.total < target)
    console.log(
      `  ${mode.padEnd(16)} target=${fmt(target)}  under-target=${String(under.length).padStart(2)}/${modeRows.length}`,
    )
    if (under.length > 0) {
      for (const u of under.sort((a, b) => a.total - b.total).slice(0, 5)) {
        console.log(`      ${fmt(u.total)}  ${u.map}`)
      }
    }
  }
  console.log('')
  console.log('Done.')
})().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
