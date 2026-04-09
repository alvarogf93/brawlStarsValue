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

  it('returns bestTrio when trio synergy data includes the brawler', () => {
    const mapMatrix: BrawlerMapEntry[] = [
      { brawlerId: 16000000, brawlerName: 'SHELLY', map: 'Super Beach', mode: 'brawlBall', wins: 7, total: 10, winRate: 70, wilsonScore: 45, eventId: null, confidence: 'high' as const },
    ]
    const trioSynergy: TrioSynergy[] = [
      {
        brawlers: [{ id: 16000000, name: 'SHELLY' }, { id: 16000001, name: 'COLT' }, { id: 16000002, name: 'BULL' }],
        mode: null, map: null,
        wins: 6, total: 8, winRate: 75, wilsonScore: 40, confidence: 'medium' as const,
      },
    ]
    const events = [{ startTime: '2026-04-05T10:00:00Z', endTime: '2026-04-06T10:00:00Z', event: { id: 1, mode: 'brawlBall', map: 'Super Beach' } }]
    const result = computePlayNowRecommendations(mapMatrix, trioSynergy, events)
    expect(result[0].recommendations[0].bestTrio).not.toBeNull()
    expect(result[0].recommendations[0].bestTrio!.brawlers).toHaveLength(3)
    expect(result[0].recommendations[0].bestTrio!.winRate).toBe(75)
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
