/**
 * Pure helper for the brawler-detail trend calculation. Splits a list
 * of dated meta_stats rows into "recent 7 days" and "previous 7 days"
 * buckets, then returns the WR delta in percentage points.
 *
 * Returns `null` when EITHER window has fewer than `MIN_BATTLES_PER_WINDOW`
 * battles for the brawler — the UI must distinguish "we don't have
 * enough historical data" from "the WR is stable". Pre-Sprint D the
 * function returned 0 in both cases, which made every brawler look
 * "Estable" because the cron hadn't been collecting long enough to
 * fill the previous 7-day window.
 *
 * Threshold rationale: 3 battles is low enough that even niche
 * brawlers with patchy data get a trend signal, and high enough that
 * a single match's noise doesn't dominate the percentage delta.
 */

export const MIN_BATTLES_PER_TREND_WINDOW = 3

export interface DatedStatsRow {
  date: string
  wins: number
  total: number
}

/**
 * Compute the 7-day WR trend delta in percentage points.
 * Returns `null` when either bucket is below the threshold.
 *
 * `now` is injected so the function is deterministic in tests.
 */
export function compute7dTrend(
  rows: readonly DatedStatsRow[],
  now: Date = new Date(),
): number | null {
  const d7ago = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
  const d14ago = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10)

  let recentWins = 0
  let recentTotal = 0
  let prevWins = 0
  let prevTotal = 0

  for (const r of rows) {
    if (!r.date) continue
    if (r.date >= d7ago) {
      recentWins += r.wins
      recentTotal += r.total
    } else if (r.date >= d14ago) {
      prevWins += r.wins
      prevTotal += r.total
    }
  }

  if (recentTotal < MIN_BATTLES_PER_TREND_WINDOW) return null
  if (prevTotal < MIN_BATTLES_PER_TREND_WINDOW) return null

  const recentWR = (recentWins / recentTotal) * 100
  const prevWR = (prevWins / prevTotal) * 100
  // Round to 1 decimal place for display stability
  return Math.round((recentWR - prevWR) * 10) / 10
}
