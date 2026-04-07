import { describe, it, expect } from 'vitest'
import { computeCounterPick, findUnderusedBrawlers, computePlayNowRecommendations } from '@/lib/analytics/recommendations'
import { makeVictory, makeDefeat } from '../../fixtures/battle.fixture'
import type { BrawlerMapEntry, BrawlerSynergy } from '@/lib/analytics/types'

describe('computeCounterPick', () => {
  it('returns empty array with no battles', () => {
    const result = computeCounterPick([], ['SHELLY'])
    expect(result).toEqual([])
  })

  it('returns empty array when no battles match opponent', () => {
    const battles = [makeVictory()]
    const result = computeCounterPick(battles, ['NONEXISTENT'])
    expect(result).toEqual([])
  })

  it('finds counter-picks against specified opponent', () => {
    const battles = [
      makeVictory({
        my_brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 750, gadgets: [], starPowers: [], hypercharges: [] },
        opponents: [{ tag: '#F1', name: 'Foe', brawler: { id: 16000003, name: 'BROCK', power: 10, trophies: 600 } }],
      }),
      makeDefeat({
        my_brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] },
        opponents: [{ tag: '#F2', name: 'Foe2', brawler: { id: 16000003, name: 'BROCK', power: 11, trophies: 700 } }],
      }),
    ]
    const result = computeCounterPick(battles, ['BROCK'])
    expect(result.length).toBeGreaterThanOrEqual(1)
    // SHELLY won vs BROCK (wilsonScore higher), should rank first
    expect(result[0].brawlerName).toBe('SHELLY')
  })

  it('is case-insensitive for opponent names', () => {
    const battles = [
      makeVictory({
        opponents: [{ tag: '#F1', name: 'Foe', brawler: { id: 16000003, name: 'BROCK', power: 10, trophies: 600 } }],
      }),
    ]
    const lower = computeCounterPick(battles, ['brock'])
    const upper = computeCounterPick(battles, ['BROCK'])
    expect(lower.length).toBe(upper.length)
  })

  it('filters by map when mapFilter provided', () => {
    const battles = [
      makeVictory({
        map: 'Super Beach',
        opponents: [{ tag: '#F1', name: 'Foe', brawler: { id: 16000003, name: 'BROCK', power: 10, trophies: 600 } }],
      }),
      makeVictory({
        map: 'Backyard Bowl',
        opponents: [{ tag: '#F2', name: 'Foe2', brawler: { id: 16000003, name: 'BROCK', power: 11, trophies: 700 } }],
      }),
    ]
    const result = computeCounterPick(battles, ['BROCK'], 'Super Beach')
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].gamesPlayed).toBe(1)
  })

  it('includes vsBreakdown for each specified opponent', () => {
    const battles = [
      makeVictory({
        opponents: [
          { tag: '#F1', name: 'Foe1', brawler: { id: 16000003, name: 'BROCK', power: 10, trophies: 600 } },
          { tag: '#F2', name: 'Foe2', brawler: { id: 16000004, name: 'COLT', power: 9, trophies: 500 } },
        ],
      }),
    ]
    const result = computeCounterPick(battles, ['BROCK', 'COLT'])
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].vsBreakdown).toHaveLength(2)
  })
})

describe('findUnderusedBrawlers', () => {
  it('returns empty for player with no high-power brawlers', () => {
    const brawlers = [{ id: 16000000, name: 'SHELLY', power: 5, trophies: 200 }]
    const battleCounts = new Map<number, number>()
    const result = findUnderusedBrawlers(brawlers, battleCounts)
    expect(result).toEqual([])
  })

  it('identifies high-power brawler with 0 battles', () => {
    const brawlers = [{ id: 16000000, name: 'SHELLY', power: 11, trophies: 750 }]
    const battleCounts = new Map<number, number>()
    const result = findUnderusedBrawlers(brawlers, battleCounts)
    expect(result).toHaveLength(1)
    expect(result[0].suggestion).toContain('Never played')
  })

  it('identifies brawler with few battles', () => {
    const brawlers = [{ id: 16000000, name: 'SHELLY', power: 11, trophies: 750 }]
    const battleCounts = new Map<number, number>([[16000000, 3]])
    const result = findUnderusedBrawlers(brawlers, battleCounts)
    expect(result).toHaveLength(1)
    expect(result[0].suggestion).toContain('Only 3')
  })

  it('excludes brawlers with many battles', () => {
    const brawlers = [{ id: 16000000, name: 'SHELLY', power: 11, trophies: 750 }]
    const battleCounts = new Map<number, number>([[16000000, 50]])
    const result = findUnderusedBrawlers(brawlers, battleCounts)
    expect(result).toEqual([])
  })

  it('sorts by power level descending', () => {
    const brawlers = [
      { id: 16000000, name: 'SHELLY', power: 9, trophies: 500 },
      { id: 16000001, name: 'COLT', power: 11, trophies: 750 },
    ]
    const battleCounts = new Map<number, number>()
    const result = findUnderusedBrawlers(brawlers, battleCounts)
    expect(result[0].name).toBe('COLT')
  })

  it('respects custom minPower and maxBattles', () => {
    const brawlers = [{ id: 16000000, name: 'SHELLY', power: 7, trophies: 300 }]
    const battleCounts = new Map<number, number>([[16000000, 8]])
    // Default: minPower=9, maxBattles=5 → excluded
    expect(findUnderusedBrawlers(brawlers, battleCounts)).toEqual([])
    // Custom: minPower=6, maxBattles=10 → included
    expect(findUnderusedBrawlers(brawlers, battleCounts, 6, 10)).toHaveLength(1)
  })
})

describe('computePlayNowRecommendations', () => {
  it('returns empty array with no events', () => {
    const result = computePlayNowRecommendations([], [], [])
    expect(result).toEqual([])
  })

  it('returns empty array with no brawler map data', () => {
    const events = [{ startTime: '2026-04-05T10:00:00Z', endTime: '2026-04-06T10:00:00Z', event: { id: 1, mode: 'brawlBall', map: 'Super Beach' } }]
    const result = computePlayNowRecommendations([], [], events)
    expect(result).toEqual([])
  })

  it('returns recommendations when map data exists', () => {
    const mapMatrix: BrawlerMapEntry[] = [
      { brawlerId: 16000000, brawlerName: 'SHELLY', map: 'Super Beach', mode: 'brawlBall', wins: 7, total: 10, winRate: 70, wilsonScore: 45, eventId: null, confidence: 'high' as const },
    ]
    const events = [{ startTime: '2026-04-05T10:00:00Z', endTime: '2026-04-06T10:00:00Z', event: { id: 1, mode: 'brawlBall', map: 'Super Beach' } }]
    const result = computePlayNowRecommendations(mapMatrix, [], events)
    expect(result).toHaveLength(1)
    expect(result[0].recommendations).toHaveLength(1)
    expect(result[0].recommendations[0].brawlerName).toBe('SHELLY')
  })

  it('falls back to mode data when no map match', () => {
    const mapMatrix: BrawlerMapEntry[] = [
      { brawlerId: 16000000, brawlerName: 'SHELLY', map: 'Other Map', mode: 'brawlBall', wins: 5, total: 10, winRate: 50, wilsonScore: 30, eventId: null, confidence: 'medium' as const },
    ]
    const events = [{ startTime: '2026-04-05T10:00:00Z', endTime: '2026-04-06T10:00:00Z', event: { id: 1, mode: 'brawlBall', map: 'Unknown Map' } }]
    const result = computePlayNowRecommendations(mapMatrix, [], events)
    expect(result).toHaveLength(1)
  })

  it('limits to top 5 brawlers', () => {
    const mapMatrix: BrawlerMapEntry[] = Array.from({ length: 10 }, (_, i) => ({
      brawlerId: 16000000 + i,
      brawlerName: `BRAWLER_${i}`,
      map: 'Super Beach',
      mode: 'brawlBall',
      wins: 5 + i,
      total: 10,
      winRate: 50 + i * 5,
      wilsonScore: 30 + i * 3,
      eventId: null,
      confidence: 'medium' as const,
    }))
    const events = [{ startTime: '2026-04-05T10:00:00Z', endTime: '2026-04-06T10:00:00Z', event: { id: 1, mode: 'brawlBall', map: 'Super Beach' } }]
    const result = computePlayNowRecommendations(mapMatrix, [], events)
    expect(result[0].recommendations.length).toBeLessThanOrEqual(5)
  })
})
