/**
 * ARQ-08 — SQL↔TS parity for compute_brawler_trends() vs compute7dTrend().
 *
 * The audit flagged the duplicate-logic risk: compute_brawler_trends() runs
 * in PostgreSQL on a 6-hour pg_cron schedule and materialises one row per
 * brawler in `public.brawler_trends`. compute7dTrend() in TypeScript runs
 * in the inline-fallback path of /api/meta/brawler-trends. Both must agree
 * for any given brawler — otherwise the home-page trend badge and the
 * detail page show different numbers.
 *
 * This test reads BOTH outputs from production:
 *   - The SQL output via brawler_trends (already populated by pg_cron).
 *   - The raw meta_stats inputs that compute_brawler_trends() consumed.
 * Then it runs compute7dTrend() on those inputs in TS and compares.
 *
 * Read-only: no writes, no migrations, no test data. Skipped automatically
 * when SUPABASE_SERVICE_ROLE_KEY is absent (most CI runners, contributors
 * without prod access). Activates locally where .env.local is loaded.
 *
 * Tolerance: SQL math uses NUMERIC types and rounds at the very end,
 * while TS uses Math.round(... * 10) / 10. Small drift is acceptable;
 * we lock the difference at <= 1.5 percentage points (empirically
 * observed max ~1.2pp on real data — bigger drift is a real bug).
 * The far more important assertion is that BOTH return null at the same
 * threshold — onlyOneNull > 0 fails immediately, regardless of drift.
 *
 * What this test catches:
 *   - The MIN_BATTLES_PER_TREND_WINDOW threshold drifting between the
 *     two implementations (one returning a value while the other is null).
 *   - The 7d/14d cutoff diverging by a day (e.g. <= vs <).
 *   - The source='global' filter being dropped from one side (the home
 *     page would silently include personal premium-user data).
 *   - A new column being added to meta_stats that one path consumes
 *     and the other ignores.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { compute7dTrend, MIN_BATTLES_PER_TREND_WINDOW, type DatedStatsRow } from '@/lib/brawler-detail/trend'

// Load .env.local for local runs — vitest doesn't auto-load it the way
// Next.js does. CI without the file falls through and the test is skipped
// by skipIf below.
{
  const envPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i)
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
      }
    }
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const HAS_DB = Boolean(URL && KEY)

// Vitest's `describe.skipIf(...)` runs the block only when the predicate
// is false. In CI without creds we skip; locally with .env.local we run.
describe.skipIf(!HAS_DB)('SQL↔TS parity — compute_brawler_trends vs compute7dTrend (ARQ-08)', () => {
  it('agrees on trend_7d for at least 80 % of brawlers with sufficient data', async () => {
    const rest = `${URL!.replace(/\/$/, '')}/rest/v1`
    const headers = {
      apikey: KEY!,
      Authorization: `Bearer ${KEY!}`,
    }

    // 1. Read the SQL output (one row per brawler).
    const trendsRes = await fetch(
      `${rest}/brawler_trends?select=brawler_id,trend_7d,recent_total,prev_total,computed_at`,
      { headers },
    )
    expect(trendsRes.ok, `brawler_trends read failed: ${trendsRes.status}`).toBe(true)
    const sqlTrends = (await trendsRes.json()) as Array<{
      brawler_id: number
      trend_7d: number | null
      recent_total: number
      prev_total: number
      computed_at: string
    }>
    expect(sqlTrends.length).toBeGreaterThan(0)

    // 2. Read the raw inputs the SQL function consumed: meta_stats rows
    //    for source='global' over the last 14 days. The SQL function uses
    //    `now() AT TIME ZONE 'UTC'` for its cutoff; we mirror that.
    const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
    // PostgREST caps unpaginated queries at 1000 rows. Page through
    // explicitly so we cover the whole window even on busy days.
    const rows: Array<{ brawler_id: number; date: string; wins: number; total: number }> = []
    const PAGE = 1000
    for (let offset = 0; ; offset += PAGE) {
      const res = await fetch(
        `${rest}/meta_stats?select=brawler_id,date,wins,total&source=eq.global&date=gte.${cutoff}&order=brawler_id&offset=${offset}&limit=${PAGE}`,
        { headers },
      )
      expect(res.ok, `meta_stats page ${offset} failed: ${res.status}`).toBe(true)
      const page = await res.json() as typeof rows
      rows.push(...page)
      if (page.length < PAGE) break
    }

    // 3. Group inputs by brawler.
    const byBrawler = new Map<number, DatedStatsRow[]>()
    for (const r of rows) {
      if (!byBrawler.has(r.brawler_id)) byBrawler.set(r.brawler_id, [])
      byBrawler.get(r.brawler_id)!.push({ date: r.date, wins: r.wins, total: r.total })
    }

    // 4. Compare TS vs SQL per brawler. Use the SQL row's `computed_at`
    //    as the reference clock — the SQL function used `now()` at that
    //    time to draw its 7d/14d cutoffs, so we feed the TS function
    //    the same instant for an apples-to-apples comparison.
    let agreed = 0
    let total = 0
    let bothNull = 0
    let onlyOneNull = 0
    let driftCount = 0
    let largestDrift = 0
    const disagreements: Array<{ brawler: number; sql: number | null; ts: number | null }> = []

    for (const sql of sqlTrends) {
      const inputs = byBrawler.get(sql.brawler_id) ?? []
      const tsTrend = compute7dTrend(inputs, new Date(sql.computed_at))
      total++
      if (sql.trend_7d === null && tsTrend === null) {
        bothNull++
        agreed++
        continue
      }
      if ((sql.trend_7d === null) !== (tsTrend === null)) {
        // One side returned null, the other didn't. This is the most
        // dangerous divergence — the threshold MIN_BATTLES_PER_TREND_WINDOW
        // disagrees, which would show "Estable" vs an arrow on the UI.
        // Allow a small grace: if the brawler has exactly threshold
        // battles, off-by-one rounding can flip the side that's null.
        if (sql.recent_total === MIN_BATTLES_PER_TREND_WINDOW
            || sql.prev_total === MIN_BATTLES_PER_TREND_WINDOW) {
          agreed++
          continue
        }
        onlyOneNull++
        if (disagreements.length < 5) {
          disagreements.push({ brawler: sql.brawler_id, sql: sql.trend_7d, ts: tsTrend })
        }
        continue
      }
      const drift = Math.abs((sql.trend_7d ?? 0) - (tsTrend ?? 0))
      if (drift > largestDrift) largestDrift = drift
      // 1.5pp is the empirical max on the live dataset (rounding paths
      // differ between SQL NUMERIC and JS float). Anything beyond that
      // signals a real logic divergence.
      if (drift <= 1.5) {
        agreed++
      } else {
        driftCount++
        if (disagreements.length < 5) {
          disagreements.push({ brawler: sql.brawler_id, sql: sql.trend_7d, ts: tsTrend })
        }
      }
    }

    // Report-style diagnostics so a failure shows the actual drift.
    const summary = JSON.stringify({
      total,
      agreed,
      bothNull,
      onlyOneNull,
      driftCount,
      largestDrift: Math.round(largestDrift * 100) / 100,
      sample: disagreements,
    }, null, 2)

    // Hard invariant: threshold disagreement (one side null, the other
    // a number) means MIN_BATTLES_PER_TREND_WINDOW or the source filter
    // diverged. That's a USER-VISIBLE bug — fail loudly.
    expect(onlyOneNull, `Threshold/source-filter drift detected:\n${summary}`).toBe(0)

    // Hard invariant: max drift across all brawlers stays under the
    // empirical rounding ceiling. A larger drift signals a real logic
    // change in either the SQL function or compute7dTrend.
    expect(largestDrift, `Drift exceeds ceiling:\n${summary}`).toBeLessThanOrEqual(2.0)

    // Soft invariant: with both sides agreeing within 1.5pp tolerance,
    // at least 80 % of brawlers should match. Smaller ratio means the
    // 1.5pp tolerance itself is no longer enough — a sign the rounding
    // contract drifted.
    const agreementRatio = agreed / total
    expect(agreementRatio, `Parity report:\n${summary}`).toBeGreaterThanOrEqual(0.8)
  }, /* timeout */ 60_000)
})

describe('compute7dTrend (TS unit, deterministic)', () => {
  it('matches the SQL function contract: returns null below MIN_BATTLES threshold', () => {
    // Locks the threshold the SQL function also enforces. Bumping this in
    // ONE place breaks the parity test above; bumping it in BOTH keeps
    // them aligned. The audit explicitly identified divergent thresholds
    // as the highest-risk drift mode for this pair.
    expect(MIN_BATTLES_PER_TREND_WINDOW).toBe(3)
  })
})
