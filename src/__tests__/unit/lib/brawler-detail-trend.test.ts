import { describe, it, expect } from 'vitest'
import {
  compute7dTrend,
  MIN_BATTLES_PER_TREND_WINDOW,
  type DatedStatsRow,
} from '@/lib/brawler-detail/trend'

const NOW = new Date('2026-04-13T12:00:00.000Z')

function dateOffset(daysAgo: number): string {
  return new Date(NOW.getTime() - daysAgo * 86400000).toISOString().slice(0, 10)
}

describe('compute7dTrend — happy path with sufficient data in both windows', () => {
  it('returns a positive delta when recent WR is higher than previous WR', () => {
    const rows: DatedStatsRow[] = [
      { date: dateOffset(2), wins: 8, total: 10 }, // recent: 80%
      { date: dateOffset(10), wins: 5, total: 10 }, // prev: 50%
    ]
    expect(compute7dTrend(rows, NOW)).toBe(30) // 80 - 50 = 30 pp
  })

  it('returns a negative delta when recent WR is lower than previous WR', () => {
    const rows: DatedStatsRow[] = [
      { date: dateOffset(2), wins: 4, total: 10 }, // recent: 40%
      { date: dateOffset(10), wins: 7, total: 10 }, // prev: 70%
    ]
    expect(compute7dTrend(rows, NOW)).toBe(-30)
  })

  it('returns 0 when recent and previous WR are identical', () => {
    const rows: DatedStatsRow[] = [
      { date: dateOffset(2), wins: 5, total: 10 },
      { date: dateOffset(10), wins: 5, total: 10 },
    ]
    expect(compute7dTrend(rows, NOW)).toBe(0)
  })

  it('rounds to 1 decimal place', () => {
    const rows: DatedStatsRow[] = [
      { date: dateOffset(2), wins: 7, total: 13 }, // 53.846...%
      { date: dateOffset(10), wins: 5, total: 13 }, // 38.461...%
    ]
    // Delta ~15.38 pp, rounded to 15.4
    expect(compute7dTrend(rows, NOW)).toBe(15.4)
  })

  it('aggregates multiple rows in the same bucket correctly', () => {
    const rows: DatedStatsRow[] = [
      { date: dateOffset(1), wins: 4, total: 5 },
      { date: dateOffset(3), wins: 3, total: 5 },
      { date: dateOffset(5), wins: 2, total: 5 },
      // recent total: 9 wins / 15 games = 60%
      { date: dateOffset(8), wins: 3, total: 5 },
      { date: dateOffset(11), wins: 2, total: 5 },
      { date: dateOffset(13), wins: 1, total: 5 },
      // prev total: 6 wins / 15 games = 40%
    ]
    expect(compute7dTrend(rows, NOW)).toBe(20)
  })
})

describe('compute7dTrend — null fallbacks (the "Estable" bug regression)', () => {
  it('returns null when there is no data at all', () => {
    expect(compute7dTrend([], NOW)).toBeNull()
  })

  it('returns null when the recent window has fewer than MIN_BATTLES_PER_TREND_WINDOW battles', () => {
    const rows: DatedStatsRow[] = [
      { date: dateOffset(2), wins: 1, total: 2 }, // 2 < 3 threshold
      { date: dateOffset(10), wins: 5, total: 10 },
    ]
    expect(compute7dTrend(rows, NOW)).toBeNull()
  })

  it('returns null when the previous window has fewer than MIN_BATTLES_PER_TREND_WINDOW battles', () => {
    const rows: DatedStatsRow[] = [
      { date: dateOffset(2), wins: 5, total: 10 },
      { date: dateOffset(10), wins: 1, total: 2 }, // prev: 2 < 3
    ]
    expect(compute7dTrend(rows, NOW)).toBeNull()
  })

  it('returns null when ALL data is in the recent window (cron only running for ~7 days)', () => {
    // This is the EXACT scenario that caused every brawler to show
    // "Estable" before Sprint D's fix — the cron started recently so
    // there's no prev-window data, but the old code returned 0 instead
    // of null and the UI rendered "Estable".
    const rows: DatedStatsRow[] = [
      { date: dateOffset(0), wins: 10, total: 20 },
      { date: dateOffset(2), wins: 12, total: 20 },
      { date: dateOffset(5), wins: 8, total: 15 },
      { date: dateOffset(6), wins: 10, total: 18 },
    ]
    expect(compute7dTrend(rows, NOW)).toBeNull()
  })

  it('returns null when ALL data is in the previous window only', () => {
    const rows: DatedStatsRow[] = [
      { date: dateOffset(8), wins: 5, total: 10 },
      { date: dateOffset(11), wins: 6, total: 10 },
    ]
    expect(compute7dTrend(rows, NOW)).toBeNull()
  })

  it('ignores rows older than 14 days', () => {
    const rows: DatedStatsRow[] = [
      { date: dateOffset(2), wins: 5, total: 10 },
      { date: dateOffset(10), wins: 5, total: 10 },
      { date: dateOffset(20), wins: 100, total: 100 }, // ignored
      { date: dateOffset(30), wins: 100, total: 100 }, // ignored
    ]
    expect(compute7dTrend(rows, NOW)).toBe(0) // 50% - 50% = 0
  })

  it('handles rows with missing or empty date string gracefully', () => {
    const rows: DatedStatsRow[] = [
      { date: dateOffset(2), wins: 5, total: 10 },
      { date: dateOffset(10), wins: 5, total: 10 },
      { date: '', wins: 999, total: 999 }, // skipped
    ]
    expect(compute7dTrend(rows, NOW)).toBe(0)
  })

  it('boundary: a row with EXACTLY MIN_BATTLES_PER_TREND_WINDOW counts as enough', () => {
    const rows: DatedStatsRow[] = [
      { date: dateOffset(2), wins: 2, total: MIN_BATTLES_PER_TREND_WINDOW },
      { date: dateOffset(10), wins: 1, total: MIN_BATTLES_PER_TREND_WINDOW },
    ]
    // 2/3 = 66.66, 1/3 = 33.33, delta ≈ 33.3
    const result = compute7dTrend(rows, NOW)
    expect(result).not.toBeNull()
    expect(result).toBeCloseTo(33.3, 1)
  })

  it('boundary: a row with one less than MIN_BATTLES_PER_TREND_WINDOW returns null', () => {
    const tooFew = MIN_BATTLES_PER_TREND_WINDOW - 1
    const rows: DatedStatsRow[] = [
      { date: dateOffset(2), wins: 1, total: tooFew },
      { date: dateOffset(10), wins: 1, total: 5 },
    ]
    expect(compute7dTrend(rows, NOW)).toBeNull()
  })
})
