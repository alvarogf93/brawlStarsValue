import { describe, it, expect } from 'vitest'
import {
  computeTrendDelta,
  computeGapVerdict,
  filterByMinBattles,
  canonicalizeTrioKey,
  computePickRate,
} from '@/lib/draft/pro-analysis'
import { bayesianWinRate } from '@/lib/draft/scoring'

describe('computeTrendDelta', () => {
  it('returns positive delta when current WR > previous WR', () => {
    const currentWR = bayesianWinRate(60, 100)
    const previousWR = bayesianWinRate(50, 100)
    const delta = computeTrendDelta(currentWR, previousWR)
    expect(delta).toBeGreaterThan(0)
    expect(delta).toBeCloseTo(currentWR - previousWR, 1)
  })

  it('returns negative delta when current WR < previous WR', () => {
    const currentWR = bayesianWinRate(40, 100)
    const previousWR = bayesianWinRate(60, 100)
    const delta = computeTrendDelta(currentWR, previousWR)
    expect(delta).toBeLessThan(0)
  })

  it('returns null when previous WR is null (no previous data)', () => {
    const delta = computeTrendDelta(55.0, null)
    expect(delta).toBeNull()
  })

  it('returns 0 when both WRs are identical', () => {
    const delta = computeTrendDelta(50.0, 50.0)
    expect(delta).toBe(0)
  })
})

describe('computeGapVerdict', () => {
  it('returns "above" when user WR > PRO WR + 3', () => {
    expect(computeGapVerdict(65, 58)).toBe('above')
  })

  it('returns "below" when user WR < PRO WR - 3', () => {
    expect(computeGapVerdict(48, 62)).toBe('below')
  })

  it('returns "on-par" when |gap| <= 3', () => {
    expect(computeGapVerdict(60, 58)).toBe('on-par')
    expect(computeGapVerdict(55, 58)).toBe('on-par')
    expect(computeGapVerdict(61, 58)).toBe('on-par')
  })

  it('returns "on-par" at exactly 3 point gap boundary', () => {
    expect(computeGapVerdict(61, 58)).toBe('on-par')
    expect(computeGapVerdict(55, 58)).toBe('on-par')
  })

  it('returns "above" at 3.01 points above', () => {
    expect(computeGapVerdict(61.01, 58)).toBe('above')
  })
})

describe('filterByMinBattles', () => {
  it('removes entries below threshold', () => {
    const data = [
      { brawlerId: 1, wins: 15, total: 19 },
      { brawlerId: 2, wins: 20, total: 25 },
      { brawlerId: 3, wins: 5, total: 8 },
    ]
    const filtered = filterByMinBattles(data, 20)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].brawlerId).toBe(2)
  })

  it('keeps entries exactly at threshold', () => {
    const data = [{ brawlerId: 1, wins: 10, total: 20 }]
    const filtered = filterByMinBattles(data, 20)
    expect(filtered).toHaveLength(1)
  })

  it('returns empty array when all below threshold', () => {
    const data = [{ brawlerId: 1, wins: 5, total: 10 }]
    const filtered = filterByMinBattles(data, 20)
    expect(filtered).toHaveLength(0)
  })
})

describe('canonicalizeTrioKey', () => {
  it('sorts IDs in ascending order', () => {
    expect(canonicalizeTrioKey([3, 1, 2])).toEqual([1, 2, 3])
  })

  it('handles already sorted IDs', () => {
    expect(canonicalizeTrioKey([10, 20, 30])).toEqual([10, 20, 30])
  })

  it('handles reverse sorted IDs', () => {
    expect(canonicalizeTrioKey([100, 50, 1])).toEqual([1, 50, 100])
  })
})

describe('computePickRate', () => {
  it('computes percentage of total battles', () => {
    const rate = computePickRate(50, 1000)
    expect(rate).toBeCloseTo(5.0, 1)
  })

  it('returns 0 when totalBattles is 0', () => {
    expect(computePickRate(10, 0)).toBe(0)
  })

  it('handles 100% pick rate', () => {
    expect(computePickRate(100, 100)).toBeCloseTo(100, 1)
  })
})

describe('trend calculation end-to-end', () => {
  it('computes 7d rising trend correctly', () => {
    const current7dWR = 57.0
    const prev7dWR = 50.0
    const delta = computeTrendDelta(current7dWR, prev7dWR)
    expect(delta).toBe(7)
    expect(delta).toBeGreaterThan(2)
  })

  it('computes 7d falling trend correctly', () => {
    const current7dWR = 45.0
    const prev7dWR = 52.0
    const delta = computeTrendDelta(current7dWR, prev7dWR)
    expect(delta).toBe(-7)
    expect(delta).toBeLessThan(-2)
  })

  it('computes stable trend (no change > 2%)', () => {
    const current7dWR = 51.0
    const prev7dWR = 50.0
    const delta = computeTrendDelta(current7dWR, prev7dWR)
    expect(delta).toBe(1)
    expect(Math.abs(delta!)).toBeLessThanOrEqual(2)
  })

  it('handles 30d trend with larger data sets', () => {
    const current30dWR = 62.5
    const prev30dWR = 55.0
    const delta = computeTrendDelta(current30dWR, prev30dWR)
    expect(delta).toBe(7.5)
  })
})
