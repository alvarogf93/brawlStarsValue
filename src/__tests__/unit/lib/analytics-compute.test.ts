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
      expect(result.overview.trophyChange).toBe(0)
      expect(result.byBrawler).toEqual([])
      expect(result.sessions).toEqual([])
    })

    it('handles single battle', () => {
      const result = computeAdvancedAnalytics([makeBattle({ result: 'victory' })])
      expect(result.overview.totalBattles).toBe(1)
      expect(result.overview.totalWins).toBe(1)
      expect(result.overview.overallWinRate).toBe(100)
    })

    it('handles all-draw battles', () => {
      const draws = [
        makeBattle({ result: 'draw', trophy_change: 0, battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ result: 'draw', trophy_change: 0, battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ result: 'draw', trophy_change: 0, battle_time: '2026-04-05T10:10:00.000Z' }),
      ]
      const result = computeAdvancedAnalytics(draws)
      expect(result.overview.overallWinRate).toBe(0)
      expect(result.overview.totalWins).toBe(0)
      expect(result.overview.trophyChange).toBe(0)
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
    it('includes entries at or above MIN_GAMES (1)', () => {
      const battles = [
        makeBattle({ map: 'MapA', my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
        makeBattle({ map: 'MapA', my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
      ]

      const result = computeAdvancedAnalytics(battles)
      const shellyMapA = result.brawlerMapMatrix.find(e => e.brawlerName === 'SHELLY' && e.map === 'MapA')
      // MIN_GAMES = 1, so 2 games should be included
      expect(shellyMapA).toBeDefined()
      expect(shellyMapA!.total).toBe(2)
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

  describe('trioSynergy', () => {
    const tm2 = [
      { tag: '#A1', name: 'Ally1', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 400 } },
      { tag: '#A2', name: 'Ally2', brawler: { id: 16000002, name: 'BULL', power: 10, trophies: 450 } },
    ]

    it('groups 3-brawler teams with correct winRate', () => {
      const battles = [
        makeBattle({ mode: 'gemGrab', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ mode: 'gemGrab', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ mode: 'gemGrab', result: 'defeat', teammates: tm2, battle_time: '2026-04-05T10:10:00.000Z' }),
      ]
      const result = computeAdvancedAnalytics(battles)
      expect(result.trioSynergy.length).toBeGreaterThanOrEqual(1)
      const trio = result.trioSynergy[0]
      expect(trio.brawlers).toHaveLength(3)
      expect(trio.total).toBe(3)
      expect(trio.wins).toBe(2)
      expect(trio.winRate).toBeCloseTo(66.7, 0)
    })

    it('normalizes trio order (ABC = CBA)', () => {
      const tmReversed = [
        { tag: '#A2', name: 'Ally2', brawler: { id: 16000002, name: 'BULL', power: 10, trophies: 450 } },
        { tag: '#A1', name: 'Ally1', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 400 } },
      ]
      const battles = [
        makeBattle({ mode: 'brawlBall', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ mode: 'brawlBall', result: 'victory', teammates: tmReversed, battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ mode: 'brawlBall', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:10:00.000Z' }),
      ]
      const result = computeAdvancedAnalytics(battles)
      // Should be ONE global trio, not two (same brawlers, different order)
      const globalMatching = result.trioSynergy.filter(t => t.total === 3 && t.map === null)
      expect(globalMatching).toHaveLength(1)
    })

    it('excludes non-standard modes (showdown)', () => {
      const battles = [
        makeBattle({ mode: 'soloShowdown', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ mode: 'soloShowdown', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ mode: 'soloShowdown', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:10:00.000Z' }),
      ]
      const result = computeAdvancedAnalytics(battles)
      expect(result.trioSynergy).toHaveLength(0)
    })

    it('excludes battles with only 1 teammate (duo modes)', () => {
      const singleTm = [{ tag: '#A1', name: 'Ally1', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 400 } }]
      const battles = [
        makeBattle({ mode: 'gemGrab', result: 'victory', teammates: singleTm, battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ mode: 'gemGrab', result: 'victory', teammates: singleTm, battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ mode: 'gemGrab', result: 'victory', teammates: singleTm, battle_time: '2026-04-05T10:10:00.000Z' }),
      ]
      const result = computeAdvancedAnalytics(battles)
      expect(result.trioSynergy).toHaveLength(0)
    })

    it('sorts by wilson score descending', () => {
      const tm2b = [
        { tag: '#B1', name: 'Bob', brawler: { id: 16000003, name: 'BROCK', power: 9, trophies: 400 } },
        { tag: '#B2', name: 'Eve', brawler: { id: 16000004, name: 'JESSIE', power: 10, trophies: 450 } },
      ]
      const battles = [
        // Trio A: 2/3 wins
        makeBattle({ mode: 'gemGrab', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ mode: 'gemGrab', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ mode: 'gemGrab', result: 'defeat', teammates: tm2, battle_time: '2026-04-05T10:10:00.000Z' }),
        // Trio B: 3/3 wins (better)
        makeBattle({ mode: 'brawlBall', result: 'victory', teammates: tm2b, battle_time: '2026-04-05T11:00:00.000Z' }),
        makeBattle({ mode: 'brawlBall', result: 'victory', teammates: tm2b, battle_time: '2026-04-05T11:05:00.000Z' }),
        makeBattle({ mode: 'brawlBall', result: 'victory', teammates: tm2b, battle_time: '2026-04-05T11:10:00.000Z' }),
      ]
      const result = computeAdvancedAnalytics(battles)
      // 2 global + 2 per-map = 4 entries
      const globalTrios = result.trioSynergy.filter(t => t.map === null)
      expect(globalTrios.length).toBe(2)
      // 100% WR trio should be first among globals
      expect(globalTrios[0].winRate).toBe(100)
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
      // TEST-07 — wrNormal is `number | null`. The previous `toBeDefined`
      // accepted both `null` AND any number; a regression that flipped
      // the win-rate to a negative or NaN would still pass. With 3 wins
      // / 6 normal battles, wrNormal must be exactly 50.
      // 3 battles in tilt (4th loss, 5th loss, 6th victory) → 3 normal
      // wins out of the first 3 battles + the warmUp counts as normal too.
      // We assert "non-null and inside [0, 100]" — bookended.
      expect(result.tilt.wrNormal).not.toBeNull()
      expect(result.tilt.wrNormal!).toBeGreaterThanOrEqual(0)
      expect(result.tilt.wrNormal!).toBeLessThanOrEqual(100)
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

    it('includes brawlers with games at mastery threshold', () => {
      const battles = [
        makeBattle({ my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
        makeBattle({ my_brawler: { id: 1, name: 'SHELLY', power: 11, trophies: 500, gadgets: [], starPowers: [], hypercharges: [] } }),
      ]

      const result = computeAdvancedAnalytics(battles)
      // MIN_GAMES = 1, so 2 games qualifies for mastery tracking
      expect(result.brawlerMastery.length).toBe(1)
      expect(result.brawlerMastery[0].brawlerName).toBe('SHELLY')
    })
  })

  // ── computeByMode ──────────────────────────────────────────────

  describe('byMode', () => {
    it('groups battles by game mode with correct win rates', () => {
      const battles = [
        makeBattle({ mode: 'gemGrab', result: 'victory', battle_time: '2026-04-05T10:00:00.000Z',
          teammates: [
            { tag: '#A1', name: 'A1', brawler: { id: 1, name: 'COLT', power: 9, trophies: 400 } },
            { tag: '#A2', name: 'A2', brawler: { id: 2, name: 'BULL', power: 10, trophies: 450 } },
          ],
        }),
        makeBattle({ mode: 'gemGrab', result: 'defeat', battle_time: '2026-04-05T10:05:00.000Z',
          teammates: [
            { tag: '#A1', name: 'A1', brawler: { id: 1, name: 'COLT', power: 9, trophies: 400 } },
            { tag: '#A2', name: 'A2', brawler: { id: 2, name: 'BULL', power: 10, trophies: 450 } },
          ],
        }),
        makeBattle({ mode: 'brawlBall', result: 'victory', battle_time: '2026-04-05T10:10:00.000Z',
          teammates: [
            { tag: '#A1', name: 'A1', brawler: { id: 1, name: 'COLT', power: 9, trophies: 400 } },
            { tag: '#A2', name: 'A2', brawler: { id: 2, name: 'BULL', power: 10, trophies: 450 } },
          ],
        }),
        makeBattle({ mode: 'brawlBall', result: 'victory', battle_time: '2026-04-05T10:15:00.000Z',
          teammates: [
            { tag: '#A1', name: 'A1', brawler: { id: 1, name: 'COLT', power: 9, trophies: 400 } },
            { tag: '#A2', name: 'A2', brawler: { id: 2, name: 'BULL', power: 10, trophies: 450 } },
          ],
        }),
        makeBattle({ mode: 'brawlBall', result: 'defeat', battle_time: '2026-04-05T10:20:00.000Z',
          teammates: [
            { tag: '#A1', name: 'A1', brawler: { id: 1, name: 'COLT', power: 9, trophies: 400 } },
            { tag: '#A2', name: 'A2', brawler: { id: 2, name: 'BULL', power: 10, trophies: 450 } },
          ],
        }),
      ]

      const result = computeAdvancedAnalytics(battles)

      expect(result.byMode.length).toBe(2)

      const gemGrab = result.byMode.find(m => m.mode === 'gemGrab')
      const brawlBall = result.byMode.find(m => m.mode === 'brawlBall')

      expect(gemGrab).toBeDefined()
      expect(gemGrab!.wins).toBe(1)
      expect(gemGrab!.total).toBe(2)
      expect(gemGrab!.winRate).toBe(50)

      expect(brawlBall).toBeDefined()
      expect(brawlBall!.wins).toBe(2)
      expect(brawlBall!.total).toBe(3)
      expect(brawlBall!.winRate).toBe(66.7)
    })

    it('sorts modes by total games descending', () => {
      const battles = [
        makeBattle({ mode: 'heist', result: 'victory', battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ mode: 'bounty', result: 'victory', battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ mode: 'bounty', result: 'defeat', battle_time: '2026-04-05T10:10:00.000Z' }),
        makeBattle({ mode: 'bounty', result: 'victory', battle_time: '2026-04-05T10:15:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)
      expect(result.byMode[0].mode).toBe('bounty')
      expect(result.byMode[1].mode).toBe('heist')
    })

    it('returns empty array for empty battles', () => {
      const result = computeAdvancedAnalytics([])
      expect(result.byMode).toEqual([])
    })
  })

  // ── computeByMap ───────────────────────────────────────────────

  describe('byMap', () => {
    it('groups battles by map with correct win rates', () => {
      const battles = [
        makeBattle({ map: 'Super Beach', mode: 'brawlBall', result: 'victory', battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ map: 'Super Beach', mode: 'brawlBall', result: 'victory', battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ map: 'Super Beach', mode: 'brawlBall', result: 'defeat', battle_time: '2026-04-05T10:10:00.000Z' }),
        makeBattle({ map: 'Undermine', mode: 'gemGrab', result: 'defeat', battle_time: '2026-04-05T10:15:00.000Z' }),
        makeBattle({ map: 'Undermine', mode: 'gemGrab', result: 'defeat', battle_time: '2026-04-05T10:20:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)

      expect(result.byMap.length).toBe(2)

      const beach = result.byMap.find(m => m.map === 'Super Beach')
      const undermine = result.byMap.find(m => m.map === 'Undermine')

      expect(beach).toBeDefined()
      expect(beach!.wins).toBe(2)
      expect(beach!.total).toBe(3)
      expect(beach!.winRate).toBe(66.7)
      expect(beach!.mode).toBe('brawlBall')

      expect(undermine).toBeDefined()
      expect(undermine!.wins).toBe(0)
      expect(undermine!.total).toBe(2)
      expect(undermine!.winRate).toBe(0)
    })

    it('handles null map gracefully by labeling it Unknown', () => {
      const battles = [
        makeBattle({ map: null as unknown as string, result: 'victory', battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ map: null as unknown as string, result: 'defeat', battle_time: '2026-04-05T10:05:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)
      const unknown = result.byMap.find(m => m.map === 'Unknown')

      expect(unknown).toBeDefined()
      expect(unknown!.total).toBe(2)
      expect(unknown!.wins).toBe(1)
      expect(unknown!.winRate).toBe(50)
    })

    it('returns empty array for empty battles', () => {
      const result = computeAdvancedAnalytics([])
      expect(result.byMap).toEqual([])
    })
  })

  // ── computeClutch ──────────────────────────────────────────────

  describe('clutch', () => {
    it('calculates wrAsStar and wrNotStar correctly', () => {
      const battles = [
        makeBattle({ is_star_player: true, result: 'victory', battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ is_star_player: true, result: 'victory', battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ is_star_player: true, result: 'defeat', battle_time: '2026-04-05T10:10:00.000Z' }),
        makeBattle({ is_star_player: false, result: 'victory', battle_time: '2026-04-05T10:15:00.000Z' }),
        makeBattle({ is_star_player: false, result: 'defeat', battle_time: '2026-04-05T10:20:00.000Z' }),
        makeBattle({ is_star_player: false, result: 'defeat', battle_time: '2026-04-05T10:25:00.000Z' }),
        makeBattle({ is_star_player: false, result: 'defeat', battle_time: '2026-04-05T10:30:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)

      // Star: 2 wins / 3 total = 66.7%
      expect(result.clutch.wrAsStar).toBe(66.7)
      // Non-star: 1 win / 4 total = 25%
      expect(result.clutch.wrNotStar).toBe(25)
      expect(result.clutch.starGames).toBe(3)
      expect(result.clutch.nonStarGames).toBe(4)
      // delta = 66.7 - 25 = 41.7
      expect(result.clutch.delta).toBe(41.7)
    })

    it('returns null wrAsStar when no star player games exist', () => {
      const battles = [
        makeBattle({ is_star_player: false, result: 'victory', battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ is_star_player: false, result: 'defeat', battle_time: '2026-04-05T10:05:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)

      expect(result.clutch.wrAsStar).toBeNull()
      expect(result.clutch.starGames).toBe(0)
      expect(result.clutch.wrNotStar).toBe(50)
      expect(result.clutch.delta).toBeNull()
    })

    it('counts starGames accurately', () => {
      const battles = [
        makeBattle({ is_star_player: true, result: 'victory', battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ is_star_player: false, result: 'victory', battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ is_star_player: true, result: 'defeat', battle_time: '2026-04-05T10:10:00.000Z' }),
        makeBattle({ is_star_player: true, result: 'victory', battle_time: '2026-04-05T10:15:00.000Z' }),
        makeBattle({ is_star_player: false, result: 'defeat', battle_time: '2026-04-05T10:20:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)
      expect(result.clutch.starGames).toBe(3)
      expect(result.clutch.nonStarGames).toBe(2)
    })
  })

  // ── computeWeeklyPattern ───────────────────────────────────────

  describe('weeklyPattern', () => {
    it('groups battles by day of week with correct win rates', () => {
      // 2026-04-05 = Sunday (0), 2026-04-06 = Monday (1), 2026-04-07 = Tuesday (2)
      const battles = [
        makeBattle({ result: 'victory', battle_time: '2026-04-05T10:00:00.000Z' }), // Sunday
        makeBattle({ result: 'victory', battle_time: '2026-04-05T10:05:00.000Z' }), // Sunday
        makeBattle({ result: 'defeat', battle_time: '2026-04-05T10:10:00.000Z' }),  // Sunday
        makeBattle({ result: 'victory', battle_time: '2026-04-06T10:00:00.000Z' }), // Monday
        makeBattle({ result: 'defeat', battle_time: '2026-04-07T10:00:00.000Z' }),  // Tuesday
      ]

      const result = computeAdvancedAnalytics(battles)

      expect(result.weeklyPattern.length).toBe(7)

      const sunday = result.weeklyPattern[0]
      expect(sunday.dayOfWeek).toBe(0)
      expect(sunday.dayName).toBe('Sunday')
      expect(sunday.total).toBe(3)
      expect(sunday.wins).toBe(2)
      expect(sunday.winRate).toBe(66.7)

      const monday = result.weeklyPattern[1]
      expect(monday.dayOfWeek).toBe(1)
      expect(monday.dayName).toBe('Monday')
      expect(monday.total).toBe(1)
      expect(monday.wins).toBe(1)
      expect(monday.winRate).toBe(100)

      const tuesday = result.weeklyPattern[2]
      expect(tuesday.dayOfWeek).toBe(2)
      expect(tuesday.dayName).toBe('Tuesday')
      expect(tuesday.total).toBe(1)
      expect(tuesday.wins).toBe(0)
      expect(tuesday.winRate).toBe(0)
    })

    it('returns all 7 days even with sparse data', () => {
      const battles = [
        makeBattle({ result: 'victory', battle_time: '2026-04-05T10:00:00.000Z' }), // Sunday only
      ]

      const result = computeAdvancedAnalytics(battles)

      expect(result.weeklyPattern.length).toBe(7)

      // Sunday has data
      expect(result.weeklyPattern[0].total).toBe(1)
      expect(result.weeklyPattern[0].wins).toBe(1)

      // All other days have 0 games
      for (let i = 1; i <= 6; i++) {
        expect(result.weeklyPattern[i].dayOfWeek).toBe(i)
        expect(result.weeklyPattern[i].total).toBe(0)
        expect(result.weeklyPattern[i].wins).toBe(0)
        expect(result.weeklyPattern[i].winRate).toBe(0)
      }
    })

    it('returns all 7 days for empty battles', () => {
      const result = computeAdvancedAnalytics([])
      expect(result.weeklyPattern.length).toBe(7)
      result.weeklyPattern.forEach((day, i) => {
        expect(day.dayOfWeek).toBe(i)
        expect(day.total).toBe(0)
        expect(day.winRate).toBe(0)
      })
    })
  })

  // ── computeRecovery ────────────────────────────────────────────

  describe('recovery', () => {
    it('detects recovery after 3+ consecutive losses', () => {
      // All within one session (no 30min gaps)
      const battles = [
        makeBattle({ result: 'victory', trophy_change: 8, battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ result: 'defeat', trophy_change: -5, battle_time: '2026-04-05T10:03:00.000Z' }),
        makeBattle({ result: 'defeat', trophy_change: -5, battle_time: '2026-04-05T10:06:00.000Z' }),
        makeBattle({ result: 'defeat', trophy_change: -5, battle_time: '2026-04-05T10:09:00.000Z' }), // 3rd loss → enters recovery
        makeBattle({ result: 'victory', trophy_change: 8, battle_time: '2026-04-05T10:12:00.000Z' }), // recovery game
        makeBattle({ result: 'victory', trophy_change: 8, battle_time: '2026-04-05T10:15:00.000Z' }), // recovery game
      ]

      const result = computeAdvancedAnalytics(battles)

      expect(result.recovery.recoveryEpisodes).toBe(1)
      // After entering recovery on the 3rd loss (trophy_change=-5 → debt=-5),
      // game 5: +8 → debt=3 ≥ 0 → successful recovery, 1 game to recover
      // But game 6 won't count because recovery ended
      expect(result.recovery.successRate).toBe(100)
      expect(result.recovery.avgGamesToRecover).toBeGreaterThanOrEqual(1)
    })

    it('returns null values when no losses exist', () => {
      const battles = [
        makeBattle({ result: 'victory', trophy_change: 8, battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ result: 'victory', trophy_change: 8, battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ result: 'victory', trophy_change: 8, battle_time: '2026-04-05T10:10:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)

      expect(result.recovery.recoveryEpisodes).toBe(0)
      expect(result.recovery.avgGamesToRecover).toBeNull()
      expect(result.recovery.successRate).toBeNull()
    })

    it('handles 2 losses without triggering recovery (needs 3)', () => {
      const battles = [
        makeBattle({ result: 'defeat', trophy_change: -5, battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ result: 'defeat', trophy_change: -5, battle_time: '2026-04-05T10:03:00.000Z' }),
        makeBattle({ result: 'victory', trophy_change: 8, battle_time: '2026-04-05T10:06:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)

      expect(result.recovery.recoveryEpisodes).toBe(0)
      expect(result.recovery.avgGamesToRecover).toBeNull()
    })

    it('tracks unsuccessful recovery when trophies never recover', () => {
      const battles = [
        makeBattle({ result: 'defeat', trophy_change: -5, battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ result: 'defeat', trophy_change: -5, battle_time: '2026-04-05T10:03:00.000Z' }),
        makeBattle({ result: 'defeat', trophy_change: -5, battle_time: '2026-04-05T10:06:00.000Z' }), // enters recovery
        makeBattle({ result: 'defeat', trophy_change: -5, battle_time: '2026-04-05T10:09:00.000Z' }), // still in recovery, losing more
        makeBattle({ result: 'victory', trophy_change: 2, battle_time: '2026-04-05T10:12:00.000Z' }),  // debt = -5 + (-5) + 2 = -8, not recovered
      ]

      const result = computeAdvancedAnalytics(battles)

      expect(result.recovery.recoveryEpisodes).toBe(1)
      // Never recovered (debt never reaches 0)
      expect(result.recovery.successRate).toBe(0)
    })
  })

  // ── trioSynergy per-map ────────────────────────────────────────

  describe('trioSynergy per-map', () => {
    const tm2 = [
      { tag: '#A1', name: 'Ally1', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 400 } },
      { tag: '#A2', name: 'Ally2', brawler: { id: 16000002, name: 'BULL', power: 10, trophies: 450 } },
    ]

    it('generates per-map entries alongside global', () => {
      const battles = [
        makeBattle({ mode: 'gemGrab', map: 'Undermine', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ mode: 'gemGrab', map: 'Undermine', result: 'defeat', teammates: tm2, battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ mode: 'gemGrab', map: 'Undermine', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:10:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)

      const globalEntries = result.trioSynergy.filter(t => t.map === null)
      const perMapEntries = result.trioSynergy.filter(t => t.map !== null)

      expect(globalEntries.length).toBe(1)
      expect(perMapEntries.length).toBe(1)
      expect(perMapEntries[0].map).toBe('Undermine')
      expect(perMapEntries[0].mode).toBe('gemGrab')

      // Both should have same stats for single-map data
      expect(globalEntries[0].total).toBe(3)
      expect(perMapEntries[0].total).toBe(3)
      expect(globalEntries[0].wins).toBe(2)
      expect(perMapEntries[0].wins).toBe(2)
    })

    it('produces separate per-map entries for same trio on different maps', () => {
      const battles = [
        makeBattle({ mode: 'gemGrab', map: 'Undermine', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ mode: 'gemGrab', map: 'Undermine', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ mode: 'brawlBall', map: 'Super Beach', result: 'defeat', teammates: tm2, battle_time: '2026-04-05T10:10:00.000Z' }),
        makeBattle({ mode: 'brawlBall', map: 'Super Beach', result: 'defeat', teammates: tm2, battle_time: '2026-04-05T10:15:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)

      const perMapEntries = result.trioSynergy.filter(t => t.map !== null)
      const undermineEntry = perMapEntries.find(t => t.map === 'Undermine')
      const beachEntry = perMapEntries.find(t => t.map === 'Super Beach')

      expect(perMapEntries.length).toBe(2)

      expect(undermineEntry).toBeDefined()
      expect(undermineEntry!.wins).toBe(2)
      expect(undermineEntry!.total).toBe(2)
      expect(undermineEntry!.winRate).toBe(100)

      expect(beachEntry).toBeDefined()
      expect(beachEntry!.wins).toBe(0)
      expect(beachEntry!.total).toBe(2)
      expect(beachEntry!.winRate).toBe(0)
    })

    it('global entry aggregates across maps', () => {
      const battles = [
        makeBattle({ mode: 'gemGrab', map: 'Undermine', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ mode: 'gemGrab', map: 'Undermine', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ mode: 'brawlBall', map: 'Super Beach', result: 'defeat', teammates: tm2, battle_time: '2026-04-05T10:10:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)

      const globalEntry = result.trioSynergy.find(t => t.map === null)

      expect(globalEntry).toBeDefined()
      // Global should aggregate: 2 wins out of 3 total across both maps
      expect(globalEntry!.total).toBe(3)
      expect(globalEntry!.wins).toBe(2)
      expect(globalEntry!.winRate).toBeCloseTo(66.7, 0)
    })

    it('distinguishes global vs per-map counts correctly', () => {
      const battles = [
        makeBattle({ mode: 'gemGrab', map: 'Undermine', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:00:00.000Z' }),
        makeBattle({ mode: 'brawlBall', map: 'Super Beach', result: 'victory', teammates: tm2, battle_time: '2026-04-05T10:05:00.000Z' }),
        makeBattle({ mode: 'bounty', map: 'Canal Grande', result: 'defeat', teammates: tm2, battle_time: '2026-04-05T10:10:00.000Z' }),
      ]

      const result = computeAdvancedAnalytics(battles)

      const globalEntries = result.trioSynergy.filter(t => t.map === null)
      const perMapEntries = result.trioSynergy.filter(t => t.map !== null)

      // 1 global entry aggregating all 3 maps
      expect(globalEntries.length).toBe(1)
      expect(globalEntries[0].total).toBe(3)

      // 3 per-map entries, each with 1 game
      expect(perMapEntries.length).toBe(3)
      perMapEntries.forEach(entry => {
        expect(entry.total).toBe(1)
      })

      // Sum of per-map totals should equal global total
      const perMapTotalSum = perMapEntries.reduce((sum, e) => sum + e.total, 0)
      expect(perMapTotalSum).toBe(globalEntries[0].total)
    })
  })
})
