import { describe, it, expect } from 'vitest'
import {
  computeTrendDelta,
  computeGapVerdict,
  filterByMinBattles,
  computePickRate,
} from '@/lib/draft/pro-analysis'

describe('/api/meta/pro-analysis data aggregation', () => {
  it('computeTrendDelta handles edge cases in aggregation context', () => {
    const wr1 = 62.5
    const wr2 = 58.3
    const delta = computeTrendDelta(wr1, wr2)
    expect(delta).toBeCloseTo(4.2, 1)
  })

  it('filterByMinBattles enforces PRO_MIN_BATTLES_DISPLAY', () => {
    const mockStats = [
      { brawlerId: 1, wins: 15, total: 19, name: 'Shelly' },
      { brawlerId: 2, wins: 12, total: 20, name: 'Colt' },
      { brawlerId: 3, wins: 100, total: 200, name: 'Brock' },
    ]
    const filtered = filterByMinBattles(mockStats, 20)
    expect(filtered).toHaveLength(2)
    expect(filtered.map(f => f.brawlerId)).toEqual([2, 3])
  })

  it('computePickRate sums correctly for endpoint response', () => {
    expect(computePickRate(50, 1000)).toBeCloseTo(5.0)
    expect(computePickRate(10, 0)).toBe(0)
  })

  it('computeGapVerdict categorizes endpoint gap data correctly', () => {
    expect(computeGapVerdict(70, 55)).toBe('above')
    expect(computeGapVerdict(45, 62)).toBe('below')
    expect(computeGapVerdict(60, 58.5)).toBe('on-par')
  })
})

describe('/api/meta/pro-analysis response shape', () => {
  it('free users get null for premium fields', () => {
    const freeResponse = {
      topBrawlers: [],
      totalProBattles: 0,
      windowDays: 14,
      trending: { rising: [], falling: [] },
      counters: [],
      topBrawlerTeammates: [],
      dailyTrend: null,
      proTrios: null,
      personalGap: null,
      matchupGaps: null,
    }

    expect(freeResponse.dailyTrend).toBeNull()
    expect(freeResponse.proTrios).toBeNull()
    expect(freeResponse.personalGap).toBeNull()
    expect(freeResponse.matchupGaps).toBeNull()
    // topBrawlerTeammates is shown to all users; not gated
    expect(Array.isArray(freeResponse.topBrawlerTeammates)).toBe(true)
  })
})
