import { describe, it, expect } from 'vitest'
import { aggregateAnalytics } from '@/hooks/useAnalytics'
import type { Battle } from '@/lib/supabase/types'

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    id: 1,
    player_tag: '#TAG',
    battle_time: '2026-04-05T17:00:00Z',
    mode: 'brawlBall',
    map: 'Super Beach',
    result: 'victory',
    trophy_change: 8,
    duration: 120,
    is_star_player: false,
    my_brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 750, gadgets: [], starPowers: [], hypercharges: [] },
    teammates: [{ tag: '#ALLY1', name: 'Ally1', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 600 } }],
    opponents: [],
    created_at: '2026-04-05T17:00:00Z',
    ...overrides,
  }
}

describe('aggregateAnalytics', () => {
  it('calculates overall win rate', () => {
    const battles = [
      makeBattle({ result: 'victory' }),
      makeBattle({ id: 2, result: 'victory' }),
      makeBattle({ id: 3, result: 'defeat' }),
    ]
    const result = aggregateAnalytics(battles)
    expect(result.overallWinRate).toBe(67)
  })

  it('calculates win rate by mode', () => {
    const battles = [
      makeBattle({ mode: 'brawlBall', result: 'victory' }),
      makeBattle({ id: 2, mode: 'brawlBall', result: 'defeat' }),
      makeBattle({ id: 3, mode: 'gemGrab', result: 'victory' }),
    ]
    const result = aggregateAnalytics(battles)
    const bb = result.byMode.find(m => m.mode === 'brawlBall')
    expect(bb?.winRate).toBe(50)
    expect(bb?.total).toBe(2)
    const gg = result.byMode.find(m => m.mode === 'gemGrab')
    expect(gg?.winRate).toBe(100)
  })

  it('calculates win rate by brawler', () => {
    const battles = [
      makeBattle({ result: 'victory' }),
      makeBattle({ id: 2, result: 'defeat' }),
    ]
    const result = aggregateAnalytics(battles)
    const shelly = result.byBrawler.find(b => b.name === 'SHELLY')
    expect(shelly?.winRate).toBe(50)
    expect(shelly?.total).toBe(2)
  })

  it('calculates win rate by map', () => {
    const battles = [
      makeBattle({ map: 'Super Beach', result: 'victory' }),
      makeBattle({ id: 2, map: 'Super Beach', result: 'victory' }),
      makeBattle({ id: 3, map: 'Backyard Bowl', result: 'defeat' }),
    ]
    const result = aggregateAnalytics(battles)
    expect(result.byMap.find(m => m.map === 'Super Beach')?.winRate).toBe(100)
  })

  it('calculates best teammates', () => {
    const battles = [
      makeBattle({ teammates: [{ tag: '#A', name: 'Alice', brawler: { id: 1, name: 'COLT', power: 9, trophies: 500 } }], result: 'victory' }),
      makeBattle({ id: 2, teammates: [{ tag: '#A', name: 'Alice', brawler: { id: 1, name: 'COLT', power: 9, trophies: 500 } }], result: 'victory' }),
      makeBattle({ id: 3, teammates: [{ tag: '#B', name: 'Bob', brawler: { id: 2, name: 'BULL', power: 10, trophies: 400 } }], result: 'defeat' }),
    ]
    const result = aggregateAnalytics(battles)
    expect(result.bestTeammates[0].name).toBe('Alice')
    expect(result.bestTeammates[0].gamesPlayed).toBe(2)
    expect(result.bestTeammates[0].winRate).toBe(100)
  })

  it('returns empty analytics for no battles', () => {
    const result = aggregateAnalytics([])
    expect(result.overallWinRate).toBe(0)
    expect(result.byMode).toHaveLength(0)
  })
})
