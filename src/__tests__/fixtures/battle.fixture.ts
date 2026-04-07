import type { Battle } from '@/lib/supabase/types'

export function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    id: 1,
    player_tag: '#TEST123',
    battle_time: '2026-04-05T17:00:00.000Z',
    event_id: 15000001,
    mode: 'brawlBall',
    map: 'Super Beach',
    result: 'victory',
    trophy_change: 8,
    duration: 120,
    is_star_player: false,
    my_brawler: {
      id: 16000000,
      name: 'SHELLY',
      power: 11,
      trophies: 750,
      gadgets: [{ id: 1, name: 'G1' }],
      starPowers: [{ id: 1, name: 'SP1' }],
      hypercharges: [],
    },
    teammates: [
      { tag: '#ALLY1', name: 'Ally1', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 600 } },
    ],
    opponents: [
      { tag: '#FOE1', name: 'Foe1', brawler: { id: 16000003, name: 'BROCK', power: 11, trophies: 700 } },
      { tag: '#FOE2', name: 'Foe2', brawler: { id: 16000004, name: 'RICO', power: 10, trophies: 650 } },
    ],
    created_at: '2026-04-05T17:00:00.000Z',
    ...overrides,
  }
}

export function makeVictory(overrides: Partial<Battle> = {}): Battle {
  return makeBattle({ result: 'victory', trophy_change: 8, ...overrides })
}

export function makeDefeat(overrides: Partial<Battle> = {}): Battle {
  return makeBattle({ result: 'defeat', trophy_change: -5, ...overrides })
}

export function makeDraw(overrides: Partial<Battle> = {}): Battle {
  return makeBattle({ result: 'draw', trophy_change: 0, ...overrides })
}

/** Generate N battles with incremental timestamps */
export function makeBattleSeries(count: number, base: Partial<Battle> = {}): Battle[] {
  return Array.from({ length: count }, (_, i) => {
    const time = new Date('2026-04-05T17:00:00.000Z')
    time.setMinutes(time.getMinutes() + i * 5)
    return makeBattle({
      id: i + 1,
      battle_time: time.toISOString(),
      result: i % 3 === 2 ? 'defeat' : 'victory',
      trophy_change: i % 3 === 2 ? -5 : 8,
      ...base,
    })
  })
}
