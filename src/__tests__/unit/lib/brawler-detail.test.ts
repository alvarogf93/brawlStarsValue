import { describe, it, expect } from 'vitest'
import { generateRecommendations, bucketBattlesToCalendar } from '@/lib/brawler-detail/compute'
import type { Recommendation, CalendarDay } from '@/lib/brawler-detail/types'

describe('generateRecommendations', () => {
  it('returns "play" recommendation when personal WR exceeds meta by MIN_GAP on a map', () => {
    const personalMaps = [
      { map: 'Super Beach', mode: 'brawlBall', eventId: 1, winRate: 75, totalBattles: 10 },
    ]
    const metaMaps = [
      { map: 'Super Beach', mode: 'brawlBall', eventId: 1, winRate: 50, totalBattles: 1000 },
    ]
    const result = generateRecommendations('SHELLY', personalMaps, metaMaps, [], [], 'en')
    expect(result.length).toBeGreaterThanOrEqual(1)
    const playRec = result.find((r: Recommendation) => r.type === 'play')
    expect(playRec).toBeDefined()
    expect(playRec!.brawlerName).toBe('SHELLY')
    expect(playRec!.context).toBe('Super Beach')
    expect(playRec!.yourWR).toBe(75)
    expect(playRec!.metaWR).toBe(50)
    expect(playRec!.diff).toBe(25)
  })

  it('returns "avoid" recommendation when personal matchup WR is below meta by MIN_GAP', () => {
    const personalMatchups = [
      { opponentId: 16000001, opponentName: 'COLT', winRate: 30, totalBattles: 10 },
    ]
    const metaMatchups = [
      { opponentId: 16000001, opponentName: 'COLT', winRate: 55, totalBattles: 5000 },
    ]
    const result = generateRecommendations('SHELLY', [], [], personalMatchups, metaMatchups, 'en')
    expect(result.length).toBeGreaterThanOrEqual(1)
    const avoidRec = result.find((r: Recommendation) => r.type === 'avoid')
    expect(avoidRec).toBeDefined()
    expect(avoidRec!.brawlerName).toBe('SHELLY')
    expect(avoidRec!.context).toBe('COLT')
    expect(avoidRec!.yourWR).toBe(30)
    expect(avoidRec!.metaWR).toBe(55)
    expect(avoidRec!.diff).toBe(-25)
  })

  it('returns empty array when no significant gaps exist', () => {
    const personalMaps = [
      { map: 'Super Beach', mode: 'brawlBall', eventId: 1, winRate: 52, totalBattles: 10 },
    ]
    const metaMaps = [
      { map: 'Super Beach', mode: 'brawlBall', eventId: 1, winRate: 50, totalBattles: 1000 },
    ]
    const personalMatchups = [
      { opponentId: 16000001, opponentName: 'COLT', winRate: 48, totalBattles: 10 },
    ]
    const metaMatchups = [
      { opponentId: 16000001, opponentName: 'COLT', winRate: 50, totalBattles: 5000 },
    ]
    const result = generateRecommendations('SHELLY', personalMaps, metaMaps, personalMatchups, metaMatchups, 'en')
    expect(result).toEqual([])
  })

  it('caps at MAX_RECOMMENDATIONS (5)', () => {
    // Create 8 maps where personal WR exceeds meta by at least MIN_GAP
    const personalMaps = Array.from({ length: 8 }, (_, i) => ({
      map: `Map_${i}`,
      mode: 'brawlBall',
      eventId: i + 1,
      winRate: 80,
      totalBattles: 10,
    }))
    const metaMaps = Array.from({ length: 8 }, (_, i) => ({
      map: `Map_${i}`,
      mode: 'brawlBall',
      eventId: i + 1,
      winRate: 50,
      totalBattles: 1000,
    }))
    const result = generateRecommendations('SHELLY', personalMaps, metaMaps, [], [], 'en')
    expect(result.length).toBeLessThanOrEqual(5)
  })

  it('filters out personal maps with fewer than MIN_PERSONAL_GAMES (3)', () => {
    const personalMaps = [
      { map: 'Super Beach', mode: 'brawlBall', eventId: 1, winRate: 100, totalBattles: 2 },
    ]
    const metaMaps = [
      { map: 'Super Beach', mode: 'brawlBall', eventId: 1, winRate: 50, totalBattles: 1000 },
    ]
    const result = generateRecommendations('SHELLY', personalMaps, metaMaps, [], [], 'en')
    expect(result).toEqual([])
  })

  it('filters out personal matchups with fewer than MIN_PERSONAL_GAMES (3)', () => {
    const personalMatchups = [
      { opponentId: 16000001, opponentName: 'COLT', winRate: 10, totalBattles: 2 },
    ]
    const metaMatchups = [
      { opponentId: 16000001, opponentName: 'COLT', winRate: 55, totalBattles: 5000 },
    ]
    const result = generateRecommendations('SHELLY', [], [], personalMatchups, metaMatchups, 'en')
    expect(result).toEqual([])
  })

  it('sorts recommendations by absolute diff descending', () => {
    const personalMaps = [
      { map: 'Map_A', mode: 'brawlBall', eventId: 1, winRate: 65, totalBattles: 10 },
      { map: 'Map_B', mode: 'gemGrab', eventId: 2, winRate: 90, totalBattles: 10 },
    ]
    const metaMaps = [
      { map: 'Map_A', mode: 'brawlBall', eventId: 1, winRate: 50, totalBattles: 1000 },
      { map: 'Map_B', mode: 'gemGrab', eventId: 2, winRate: 50, totalBattles: 1000 },
    ]
    const result = generateRecommendations('SHELLY', personalMaps, metaMaps, [], [], 'en')
    expect(result.length).toBe(2)
    // Map_B diff = 40, Map_A diff = 15 => Map_B should come first
    expect(Math.abs(result[0].diff)).toBeGreaterThanOrEqual(Math.abs(result[1].diff))
  })
})

describe('bucketBattlesToCalendar', () => {
  it('groups battles by date and counts wins', () => {
    const battles = [
      { battle_time: '20260401T120000.000Z', result: 'victory' as const },
      { battle_time: '20260401T130000.000Z', result: 'defeat' as const },
      { battle_time: '20260401T140000.000Z', result: 'victory' as const },
      { battle_time: '20260402T100000.000Z', result: 'victory' as const },
    ]
    const result = bucketBattlesToCalendar(battles)
    expect(result).toHaveLength(2)
    const day1 = result.find((d: CalendarDay) => d.date === '2026-04-01')
    const day2 = result.find((d: CalendarDay) => d.date === '2026-04-02')
    expect(day1).toBeDefined()
    expect(day1!.games).toBe(3)
    expect(day1!.wins).toBe(2)
    expect(day2).toBeDefined()
    expect(day2!.games).toBe(1)
    expect(day2!.wins).toBe(1)
  })

  it('returns empty array when given empty input', () => {
    const result = bucketBattlesToCalendar([])
    expect(result).toEqual([])
  })

  it('sorts days chronologically', () => {
    const battles = [
      { battle_time: '20260405T120000.000Z', result: 'victory' as const },
      { battle_time: '20260401T120000.000Z', result: 'defeat' as const },
      { battle_time: '20260403T120000.000Z', result: 'victory' as const },
    ]
    const result = bucketBattlesToCalendar(battles)
    expect(result).toHaveLength(3)
    expect(result[0].date).toBe('2026-04-01')
    expect(result[1].date).toBe('2026-04-03')
    expect(result[2].date).toBe('2026-04-05')
  })

  it('counts draws as games but not wins', () => {
    const battles = [
      { battle_time: '20260401T120000.000Z', result: 'draw' as const },
      { battle_time: '20260401T130000.000Z', result: 'victory' as const },
    ]
    const result = bucketBattlesToCalendar(battles)
    expect(result).toHaveLength(1)
    expect(result[0].games).toBe(2)
    expect(result[0].wins).toBe(1)
  })
})
