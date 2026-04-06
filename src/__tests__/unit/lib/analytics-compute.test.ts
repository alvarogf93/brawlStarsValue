import { describe, it, expect } from 'vitest'
import { computeAdvancedAnalytics } from '@/lib/analytics/compute'
import type { Battle } from '@/lib/supabase/types'

// ── Test data factory ───────────────────────────────────────────

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    id: Math.floor(Math.random() * 100000),
    player_tag: '#TEST',
    battle_time: '2026-04-05T12:00:00.000Z',
    mode: 'gemGrab',
    map: 'Undermine',
    result: 'victory',
    trophy_change: 8,
    duration: 120,
    is_star_player: false,
    my_brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] },
    teammates: [
      { tag: '#ALLY1', name: 'Ally1', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 400 } },
    ],
    opponents: [
      { tag: '#OPP1', name: 'Opp1', brawler: { id: 16000002, name: 'BULL', power: 10, trophies: 450 } },
      { tag: '#OPP2', name: 'Opp2', brawler: { id: 16000003, name: 'BROCK', power: 8, trophies: 350 } },
    ],
    created_at: '2026-04-05T12:00:00.000Z',
    ...overrides,
  } as Battle
}

function makeBattles(count: number, overrideFn?: (i: number) => Partial<Battle>): Battle[] {
  return Array.from({ length: count }, (_, i) => {
    const hour = 10 + Math.floor(i / 5)
    const min = (i % 5) * 3
    const baseTime = `2026-04-05T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00.000Z`
    return makeBattle({
      battle_time: baseTime,
      ...(overrideFn ? overrideFn(i) : {}),
    })
  })
}

// ── Tests ───────────────────────────────────────────────────────

describe('computeAdvancedAnalytics', () => {
  describe('overview', () => {
    it('computes correct overview stats', () => {
      const battles = [
        makeBattle({ result: 'victory', trophy_change: 8, is_star_player: true, duration: 100 }),
        makeBattle({ result: 'victory', trophy_change: 8, duration: 90 }),
        makeBattle({ result: 'defeat', trophy_change: -5, duration: 130 }),
        makeBattle({ result: 'defeat', trophy_change: -3, duration: 110 }),
        makeBattle({ result: 'victory', trophy_change: 8, duration: 95 }),
      ]

      const result = computeAdvancedAnalytics(battles)

      expect(result.overview.totalBattles).toBe(5)
      expect(result.overview.totalWins).toBe(3)
      expect(result.overview.overallWinRate).toBe(60)
      expect(result.overview.trophyChange).toBe(16) // 8+8-5-3+8
      expect(result.overview.starPlayerCount).toBe(1)
      expect(result.overview.starPlayerRate).toBe(20)
      expect(result.overview.avgDuration).toBeCloseTo(105, 0)
    })

    it('handles empty battles', () => {
      const result = computeAdvancedAnalytics([])
      expect(result.overview.totalBattles).toBe(0)
      expect(result.overview.overallWinRate).toBe(0)
    })
  })

  describe('streaks', () => {
    it('detects current win streak', () => {
      const battles = [
        makeBattle({ result: 'defeat', battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ result: 'victory', battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ result: 'victory', battle_time: '2026-04-05T10:10:00.000Z' }),
        makeBattle({ result: 'victory', battle_time: '2026-04-05T10:15:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)
      expect(result.overview.streak.currentType).toBe('win')
      expect(result.overview.streak.currentCount).toBe(3)
      expect(result.overview.streak.longestWin).toBe(3)
      expect(result.overview.streak.longestLoss).toBe(1)
    })

    it('detects current loss streak', () => {
      const battles = [
        makeBattle({ result: 'victory', battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ result: 'defeat', battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ result: 'defeat', battle_time: '2026-04-05T10:10:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)
      expect(result.overview.streak.currentType).toBe('loss')
      expect(result.overview.streak.currentCount).toBe(2)
    })
  })

  describe('byBrawler', () => {
    it('groups stats by brawler correctly', () => {
      const battles = [
        makeBattle({ result: 'victory', my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
        makeBattle({ result: 'defeat', my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
        makeBattle({ result: 'victory', my_brawler: { id: 2, name: 'COLT', power: 9, trophies: 300, gadgets: [], starPowers: [], hypercharges: [] } }),
      ]

      const result = computeAdvancedAnalytics(battles)
      const shelly = result.byBrawler.find(b => b.name === 'SHELLY')
      const colt = result.byBrawler.find(b => b.name === 'COLT')

      expect(shelly).toBeDefined()
      expect(shelly!.wins).toBe(1)
      expect(shelly!.losses).toBe(1)
      expect(shelly!.total).toBe(2)
      expect(shelly!.winRate).toBe(50)

      expect(colt).toBeDefined()
      expect(colt!.wins).toBe(1)
      expect(colt!.total).toBe(1)
      expect(colt!.winRate).toBe(100)
    })

    it('sorts brawlers by total games descending', () => {
      const battles = [
        ...makeBattles(5, () => ({ my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } })),
        ...makeBattles(3, () => ({ my_brawler: { id: 2, name: 'COLT', power: 9, trophies: 300, gadgets: [], starPowers: [], hypercharges: [] } })),
      ]

      const result = computeAdvancedAnalytics(battles)
      expect(result.byBrawler[0].name).toBe('SHELLY')
      expect(result.byBrawler[1].name).toBe('COLT')
    })
  })

  describe('brawlerMapMatrix', () => {
    it('filters entries below MIN_GAMES threshold', () => {
      const battles = [
        makeBattle({ map: 'MapA', my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
        makeBattle({ map: 'MapA', my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
        // Only 2 games — below MIN_GAMES (3)
      ]

      const result = computeAdvancedAnalytics(battles)
      const shellyMapA = result.brawlerMapMatrix.find(e => e.brawlerName === 'SHELLY' && e.map === 'MapA')
      expect(shellyMapA).toBeUndefined()
    })

    it('includes entries at MIN_GAMES threshold', () => {
      const battles = makeBattles(3, () => ({
        map: 'MapA',
        my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] },
      }))

      const result = computeAdvancedAnalytics(battles)
      const shellyMapA = result.brawlerMapMatrix.find(e => e.brawlerName === 'SHELLY' && e.map === 'MapA')
      expect(shellyMapA).toBeDefined()
      expect(shellyMapA!.total).toBe(3)
    })
  })

  describe('matchups', () => {
    it('computes correct matchup win rates', () => {
      const battles = [
        makeBattle({ result: 'victory', my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] }, opponents: [{ tag: '#O1', name: 'O1', brawler: { id: 10, name: 'CROW', power: 10, trophies: 400 } }] }),
        makeBattle({ result: 'victory', my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] }, opponents: [{ tag: '#O2', name: 'O2', brawler: { id: 10, name: 'CROW', power: 10, trophies: 400 } }] }),
        makeBattle({ result: 'defeat', my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] }, opponents: [{ tag: '#O3', name: 'O3', brawler: { id: 10, name: 'CROW', power: 10, trophies: 400 } }] }),
      ]

      const result = computeAdvancedAnalytics(battles)
      const shellyCrow = result.matchups.find(m => m.myBrawlerName === 'SHELLY' && m.opponentBrawlerName === 'CROW')

      expect(shellyCrow).toBeDefined()
      expect(shellyCrow!.wins).toBe(2)
      expect(shellyCrow!.total).toBe(3)
      expect(shellyCrow!.winRate).toBe(66.7)
    })
  })

  describe('teammateSynergy', () => {
    it('tracks best mode for each teammate', () => {
      const battles = [
        makeBattle({ mode: 'gemGrab', result: 'victory', battle_time: '2026-04-05T10:00:00.000Z', teammates: [{ tag: '#A', name: 'Alice', brawler: { id: 1, name: 'SHELLY', power: 9, trophies: 300 } }] }),
        makeBattle({ mode: 'gemGrab', result: 'victory', battle_time: '2026-04-05T10:05:00.000Z', teammates: [{ tag: '#A', name: 'Alice', brawler: { id: 1, name: 'SHELLY', power: 9, trophies: 300 } }] }),
        makeBattle({ mode: 'brawlBall', result: 'defeat', battle_time: '2026-04-05T10:10:00.000Z', teammates: [{ tag: '#A', name: 'Alice', brawler: { id: 1, name: 'SHELLY', power: 9, trophies: 300 } }] }),
      ]

      const result = computeAdvancedAnalytics(battles)
      const alice = result.teammateSynergy.find(t => t.tag === '#A')

      expect(alice).toBeDefined()
      expect(alice!.total).toBe(3)
      expect(alice!.wins).toBe(2)
      expect(alice!.bestMode).toBe('gemGrab')
      expect(alice!.bestModeWR).toBe(100)
    })
  })

  describe('byHour', () => {
    it('groups battles by UTC hour', () => {
      const battles = [
        makeBattle({ result: 'victory', battle_time: '2026-04-05T14:00:00.000Z' }),
        makeBattle({ result: 'victory', battle_time: '2026-04-05T14:05:00.000Z' }),
        makeBattle({ result: 'defeat', battle_time: '2026-04-05T22:00:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)

      const hour14 = result.byHour[14]
      expect(hour14.total).toBe(2)
      expect(hour14.wins).toBe(2)
      expect(hour14.winRate).toBe(100)

      const hour22 = result.byHour[22]
      expect(hour22.total).toBe(1)
      expect(hour22.wins).toBe(0)
      expect(hour22.winRate).toBe(0)
    })

    it('returns all 24 hours even if no battles', () => {
      const result = computeAdvancedAnalytics([])
      expect(result.byHour.length).toBe(24)
    })
  })

  describe('dailyTrend', () => {
    it('aggregates by date with cumulative trophies', () => {
      const battles = [
        makeBattle({ result: 'victory', trophy_change: 8, battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ result: 'defeat', trophy_change: -5, battle_time: '2026-04-05T14:00:00.000Z' }),
        makeBattle({ result: 'victory', trophy_change: 8, battle_time: '2026-04-06T10:00:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)

      expect(result.dailyTrend.length).toBe(2)
      expect(result.dailyTrend[0].date).toBe('2026-04-05')
      expect(result.dailyTrend[0].trophyChange).toBe(3) // 8 - 5
      expect(result.dailyTrend[0].cumulativeTrophies).toBe(3)
      expect(result.dailyTrend[1].date).toBe('2026-04-06')
      expect(result.dailyTrend[1].cumulativeTrophies).toBe(11) // 3 + 8
    })
  })

  describe('sessions', () => {
    it('splits sessions by 30min gap', () => {
      const battles = [
        makeBattle({ battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ battle_time: '2026-04-05T10:03:00.000Z' }),
        makeBattle({ battle_time: '2026-04-05T10:06:00.000Z' }),
        // 2 hour gap
        makeBattle({ battle_time: '2026-04-05T12:00:00.000Z' }),
        makeBattle({ battle_time: '2026-04-05T12:03:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)
      expect(result.sessions.length).toBe(2)
      expect(result.sessions[0].battles).toBe(3)
      expect(result.sessions[1].battles).toBe(2)
    })

    it('keeps all battles in one session if within 30min', () => {
      const battles = [
        makeBattle({ battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ battle_time: '2026-04-05T10:10:00.000Z' }),
        makeBattle({ battle_time: '2026-04-05T10:20:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)
      expect(result.sessions.length).toBe(1)
      expect(result.sessions[0].battles).toBe(3)
    })
  })

  describe('tilt analysis', () => {
    it('detects tilt when 3+ consecutive losses in a session', () => {
      const battles = [
        makeBattle({ result: 'victory', battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ result: 'defeat', battle_time: '2026-04-05T10:03:00.000Z' }),
        makeBattle({ result: 'defeat', battle_time: '2026-04-05T10:06:00.000Z' }),
        makeBattle({ result: 'defeat', battle_time: '2026-04-05T10:09:00.000Z' }),
        // Now in tilt
        makeBattle({ result: 'defeat', battle_time: '2026-04-05T10:12:00.000Z' }),
        makeBattle({ result: 'victory', battle_time: '2026-04-05T10:15:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)
      expect(result.tilt.tiltEpisodes).toBe(1)
      // 3 battles in tilt (the 4th loss, 5th loss, 6th victory)
      expect(result.tilt.wrNormal).toBeDefined()
    })

    it('returns null WR when not enough data', () => {
      const result = computeAdvancedAnalytics([
        makeBattle({ result: 'victory' }),
      ])
      // No tilt episodes with only 1 battle
      expect(result.tilt.tiltEpisodes).toBe(0)
    })
  })

  describe('brawlerMastery', () => {
    it('shows cumulative WR evolution', () => {
      const battles = [
        makeBattle({ result: 'victory', battle_time: '2026-04-01T10:00:00.000Z', my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
        makeBattle({ result: 'victory', battle_time: '2026-04-01T10:05:00.000Z', my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
        makeBattle({ result: 'defeat', battle_time: '2026-04-02T10:00:00.000Z', my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
        makeBattle({ result: 'victory', battle_time: '2026-04-02T10:05:00.000Z', my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
        makeBattle({ result: 'defeat', battle_time: '2026-04-03T10:00:00.000Z', my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
        makeBattle({ result: 'victory', battle_time: '2026-04-03T10:05:00.000Z', my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
      ]

      const result = computeAdvancedAnalytics(battles)
      const shelly = result.brawlerMastery.find(m => m.brawlerName === 'SHELLY')

      expect(shelly).toBeDefined()
      expect(shelly!.points.length).toBe(3) // 3 days
      expect(shelly!.points[0].winRate).toBe(100)  // day 1: 2/2
      expect(shelly!.points[1].winRate).toBe(75)    // day 2: 3/4 cumulative
      expect(shelly!.points[2].winRate).toBe(66.7)  // day 3: 4/6 cumulative
    })

    it('excludes brawlers with too few games', () => {
      const battles = [
        makeBattle({ my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
        makeBattle({ my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
        // Only 2 games — below MIN_GAMES*2 = 6
      ]

      const result = computeAdvancedAnalytics(battles)
      expect(result.brawlerMastery.length).toBe(0)
    })
  })
})
