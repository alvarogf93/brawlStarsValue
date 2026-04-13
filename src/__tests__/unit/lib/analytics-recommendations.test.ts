import { describe, it, expect } from 'vitest'
import { findUnderusedBrawlers, computePlayNowRecommendations } from '@/lib/analytics/recommendations'
import type { BrawlerMapEntry, TrioSynergy } from '@/lib/analytics/types'

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
    expect(findUnderusedBrawlers(brawlers, battleCounts)).toEqual([])
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

  it('returns recommendations with null bestTrio when no synergy data', () => {
    const mapMatrix: BrawlerMapEntry[] = [
      { brawlerId: 16000000, brawlerName: 'SHELLY', map: 'Super Beach', mode: 'brawlBall', wins: 7, total: 10, winRate: 70, wilsonScore: 45, eventId: null, confidence: 'high' as const },
    ]
    const events = [{ startTime: '2026-04-05T10:00:00Z', endTime: '2026-04-06T10:00:00Z', event: { id: 1, mode: 'brawlBall', map: 'Super Beach' } }]
    const result = computePlayNowRecommendations(mapMatrix, [], events)
    expect(result).toHaveLength(1)
    expect(result[0].recommendations[0].brawlerName).toBe('SHELLY')
    expect(result[0].recommendations[0].bestTrio).toBeNull()
  })

  it('returns bestTrio when trio synergy data is map-specific for the slot', () => {
    const mapMatrix: BrawlerMapEntry[] = [
      { brawlerId: 16000000, brawlerName: 'SHELLY', map: 'Super Beach', mode: 'brawlBall', wins: 7, total: 10, winRate: 70, wilsonScore: 45, eventId: null, confidence: 'high' as const },
    ]
    const trioSynergy: TrioSynergy[] = [
      {
        brawlers: [{ id: 16000000, name: 'SHELLY' }, { id: 16000001, name: 'COLT' }, { id: 16000002, name: 'BULL' }],
        mode: 'brawlBall', map: 'Super Beach', topMap: 'Super Beach',
        wins: 6, total: 8, winRate: 75, wilsonScore: 40, confidence: 'medium' as const,
      },
    ]
    const events = [{ startTime: '2026-04-05T10:00:00Z', endTime: '2026-04-06T10:00:00Z', event: { id: 1, mode: 'brawlBall', map: 'Super Beach' } }]
    const result = computePlayNowRecommendations(mapMatrix, trioSynergy, events)
    expect(result[0].recommendations[0].bestTrio).not.toBeNull()
    expect(result[0].recommendations[0].bestTrio!.brawlers).toHaveLength(3)
    expect(result[0].recommendations[0].bestTrio!.winRate).toBe(75)
  })

  it('does NOT return bestTrio when trio synergy is global or for a different map', () => {
    const mapMatrix: BrawlerMapEntry[] = [
      { brawlerId: 16000000, brawlerName: 'SHELLY', map: 'Super Beach', mode: 'brawlBall', wins: 7, total: 10, winRate: 70, wilsonScore: 45, eventId: null, confidence: 'high' as const },
    ]
    const trioSynergy: TrioSynergy[] = [
      // Global aggregate (map === null) — must be ignored
      {
        brawlers: [{ id: 16000000, name: 'SHELLY' }, { id: 16000001, name: 'COLT' }, { id: 16000002, name: 'BULL' }],
        mode: null, map: null, topMap: 'Backyard Bowl',
        wins: 6, total: 8, winRate: 75, wilsonScore: 40, confidence: 'medium' as const,
      },
      // Same trio but on a different map — must also be ignored
      {
        brawlers: [{ id: 16000000, name: 'SHELLY' }, { id: 16000001, name: 'COLT' }, { id: 16000002, name: 'BULL' }],
        mode: 'brawlBall', map: 'Backyard Bowl', topMap: 'Backyard Bowl',
        wins: 6, total: 8, winRate: 75, wilsonScore: 40, confidence: 'medium' as const,
      },
    ]
    const events = [{ startTime: '2026-04-05T10:00:00Z', endTime: '2026-04-06T10:00:00Z', event: { id: 1, mode: 'brawlBall', map: 'Super Beach' } }]
    const result = computePlayNowRecommendations(mapMatrix, trioSynergy, events)
    expect(result[0].recommendations[0].bestTrio).toBeNull()
  })

  it('picks the map-specific trio over a global one with higher wilson score', () => {
    const mapMatrix: BrawlerMapEntry[] = [
      { brawlerId: 16000000, brawlerName: 'SHELLY', map: 'Super Beach', mode: 'brawlBall', wins: 7, total: 10, winRate: 70, wilsonScore: 45, eventId: null, confidence: 'high' as const },
    ]
    const trioSynergy: TrioSynergy[] = [
      // Global SHELLY+COLT+BULL — high wilson, but not map-specific
      {
        brawlers: [{ id: 16000000, name: 'SHELLY' }, { id: 16000001, name: 'COLT' }, { id: 16000002, name: 'BULL' }],
        mode: null, map: null, topMap: 'Backyard Bowl',
        wins: 20, total: 25, winRate: 80, wilsonScore: 70, confidence: 'high' as const,
      },
      // Map-specific SHELLY+POCO+BULL on Super Beach — lower wilson but correct map
      {
        brawlers: [{ id: 16000000, name: 'SHELLY' }, { id: 16000003, name: 'POCO' }, { id: 16000002, name: 'BULL' }],
        mode: 'brawlBall', map: 'Super Beach', topMap: 'Super Beach',
        wins: 4, total: 6, winRate: 66.7, wilsonScore: 30, confidence: 'medium' as const,
      },
    ]
    const events = [{ startTime: '2026-04-05T10:00:00Z', endTime: '2026-04-06T10:00:00Z', event: { id: 1, mode: 'brawlBall', map: 'Super Beach' } }]
    const result = computePlayNowRecommendations(mapMatrix, trioSynergy, events)
    expect(result[0].recommendations[0].bestTrio).not.toBeNull()
    // The POCO trio is selected even though the global COLT trio has a higher wilson
    const trioNames = result[0].recommendations[0].bestTrio!.brawlers.map(b => b.name).sort()
    expect(trioNames).toEqual(['BULL', 'POCO', 'SHELLY'])
  })

  it('sets bestTrio to null on the mode-aggregate fallback path (no map-specific trios exist)', () => {
    const mapMatrix: BrawlerMapEntry[] = [
      // User played SHELLY on a DIFFERENT map — fallback will fire for the rotation map
      { brawlerId: 16000000, brawlerName: 'SHELLY', map: 'Other Beach', mode: 'brawlBall', wins: 7, total: 10, winRate: 70, wilsonScore: 45, eventId: null, confidence: 'high' as const },
    ]
    const trioSynergy: TrioSynergy[] = [
      // Trio data only exists for Other Beach — NOT for Super Beach
      {
        brawlers: [{ id: 16000000, name: 'SHELLY' }, { id: 16000001, name: 'COLT' }, { id: 16000002, name: 'BULL' }],
        mode: 'brawlBall', map: 'Other Beach', topMap: 'Other Beach',
        wins: 6, total: 8, winRate: 75, wilsonScore: 40, confidence: 'medium' as const,
      },
    ]
    const events = [{ startTime: '2026-04-05T10:00:00Z', endTime: '2026-04-06T10:00:00Z', event: { id: 1, mode: 'brawlBall', map: 'Super Beach' } }]
    const result = computePlayNowRecommendations(mapMatrix, trioSynergy, events)
    // Fallback fires — SHELLY still recommended from mode-aggregate path
    expect(result[0].source).toBe('mode-aggregate')
    expect(result[0].recommendations[0].brawlerName).toBe('SHELLY')
    // But no trio is shown because there's no map-specific trio for Super Beach
    expect(result[0].recommendations[0].bestTrio).toBeNull()
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

  it('aggregates duplicates across maps when fallback kicks in', () => {
    // User has played Najia on TWO knockout maps but NOT on Crab Claws
    const mapMatrix: BrawlerMapEntry[] = [
      // Najia on "Out in the Open" — 12 games, 9 wins
      { brawlerId: 16000100, brawlerName: 'NAJIA', map: 'Out in the Open', mode: 'knockout', wins: 9, total: 12, winRate: 75, wilsonScore: 55, eventId: null, confidence: 'high' as const },
      // Najia on "Goldarm Gulch" — 5 games, 4 wins
      { brawlerId: 16000100, brawlerName: 'NAJIA', map: 'Goldarm Gulch', mode: 'knockout', wins: 4, total: 5, winRate: 80, wilsonScore: 45, eventId: null, confidence: 'medium' as const },
      // Rico on "Out in the Open" — 8 games, 5 wins
      { brawlerId: 16000101, brawlerName: 'RICO', map: 'Out in the Open', mode: 'knockout', wins: 5, total: 8, winRate: 62.5, wilsonScore: 35, eventId: null, confidence: 'medium' as const },
    ]
    // Event rotation is on Crab Claws — user has NO data for it, fallback fires
    const events = [{ startTime: '2026-04-13T10:00:00Z', endTime: '2026-04-14T10:00:00Z', event: { id: 1, mode: 'knockout', map: 'Crab Claws' } }]

    const result = computePlayNowRecommendations(mapMatrix, [], events)

    expect(result).toHaveLength(1)
    const recs = result[0].recommendations

    // Najia should appear EXACTLY ONCE
    const najiaEntries = recs.filter(r => r.brawlerId === 16000100)
    expect(najiaEntries).toHaveLength(1)

    // The aggregated Najia entry should have totals summed across both maps:
    // wins: 9 + 4 = 13, total: 12 + 5 = 17
    expect(najiaEntries[0].gamesPlayed).toBe(17)
    // winRate is recomputed from the aggregate: 13/17 = 76.47%
    expect(najiaEntries[0].winRate).toBeCloseTo((13 / 17) * 100, 1)

    // Rico is also present, appearing exactly once
    const ricoEntries = recs.filter(r => r.brawlerId === 16000101)
    expect(ricoEntries).toHaveLength(1)
    expect(ricoEntries[0].gamesPlayed).toBe(8)

    // The result's source field marks this as a mode-aggregate
    expect(result[0].source).toBe('mode-aggregate')
  })

  it('preserves map-specific data when the user has played the rotation map', () => {
    const mapMatrix: BrawlerMapEntry[] = [
      // User played Najia on Crab Claws directly
      { brawlerId: 16000100, brawlerName: 'NAJIA', map: 'Crab Claws', mode: 'knockout', wins: 7, total: 10, winRate: 70, wilsonScore: 45, eventId: null, confidence: 'high' as const },
      // User also played Najia on a DIFFERENT knockout map — this should NOT affect the Crab Claws recommendation
      { brawlerId: 16000100, brawlerName: 'NAJIA', map: 'Out in the Open', mode: 'knockout', wins: 20, total: 50, winRate: 40, wilsonScore: 30, eventId: null, confidence: 'high' as const },
    ]
    const events = [{ startTime: '2026-04-13T10:00:00Z', endTime: '2026-04-14T10:00:00Z', event: { id: 1, mode: 'knockout', map: 'Crab Claws' } }]

    const result = computePlayNowRecommendations(mapMatrix, [], events)

    expect(result).toHaveLength(1)
    const recs = result[0].recommendations

    // Only the Crab Claws Najia entry is used (10 games, not 60)
    const najiaEntries = recs.filter(r => r.brawlerId === 16000100)
    expect(najiaEntries).toHaveLength(1)
    expect(najiaEntries[0].gamesPlayed).toBe(10)
    expect(najiaEntries[0].winRate).toBe(70)

    // The result's source field marks this as map-specific
    expect(result[0].source).toBe('map-specific')
  })
})
