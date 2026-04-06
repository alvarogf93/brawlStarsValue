import { describe, it, expect } from 'vitest'
import { parseBattle, parseBattleTime, parseBattlelog } from '@/lib/battle-parser'
import type { BattlelogEntry } from '@/lib/api'

const PLAYER_TAG = '#YJU282PV'

function makeBattleEntry(overrides: Partial<BattlelogEntry> = {}): BattlelogEntry {
  return {
    battleTime: '20260405T171604.000Z',
    event: { id: 15000001, mode: 'brawlBall', modeId: 2, map: 'Super Beach' },
    battle: {
      mode: 'brawlBall',
      type: 'ranked',
      result: 'victory',
      duration: 120,
      trophyChange: 8,
      starPlayer: { tag: '#YJU282PV', name: 'TestPlayer', brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 750 } },
      teams: [
        [
          { tag: '#YJU282PV', name: 'TestPlayer', brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 750 } },
          { tag: '#ALLY1', name: 'Ally1', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 600 } },
          { tag: '#ALLY2', name: 'Ally2', brawler: { id: 16000002, name: 'BULL', power: 10, trophies: 500 } },
        ],
        [
          { tag: '#FOE1', name: 'Foe1', brawler: { id: 16000003, name: 'BROCK', power: 11, trophies: 700 } },
          { tag: '#FOE2', name: 'Foe2', brawler: { id: 16000004, name: 'RICO', power: 8, trophies: 400 } },
          { tag: '#FOE3', name: 'Foe3', brawler: { id: 16000005, name: 'SPIKE', power: 11, trophies: 800 } },
        ],
      ],
    },
    ...overrides,
  }
}

describe('parseBattleTime', () => {
  it('converts Supercell format to ISO 8601', () => {
    expect(parseBattleTime('20260405T171604.000Z')).toBe('2026-04-05T17:16:04.000Z')
  })

  it('handles missing milliseconds', () => {
    expect(parseBattleTime('20260405T171604Z')).toBe('2026-04-05T17:16:04.000Z')
  })
})

describe('parseBattle', () => {
  it('extracts basic fields', () => {
    const result = parseBattle(makeBattleEntry(), PLAYER_TAG)
    expect(result!.player_tag).toBe('#YJU282PV')
    expect(result!.mode).toBe('brawlBall')
    expect(result!.map).toBe('Super Beach')
    expect(result!.result).toBe('victory')
    expect(result!.trophy_change).toBe(8)
    expect(result!.duration).toBe(120)
  })

  it('detects star player correctly', () => {
    const result = parseBattle(makeBattleEntry(), PLAYER_TAG)
    expect(result!.is_star_player).toBe(true)
  })

  it('detects non-star-player correctly', () => {
    const entry = makeBattleEntry()
    entry.battle.starPlayer = { tag: '#SOMEONE', name: 'Other', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 600 } }
    const result = parseBattle(entry, PLAYER_TAG)
    expect(result!.is_star_player).toBe(false)
  })

  it('extracts my_brawler from team', () => {
    const result = parseBattle(makeBattleEntry(), PLAYER_TAG)
    expect(result!.my_brawler.id).toBe(16000000)
    expect(result!.my_brawler.name).toBe('SHELLY')
    expect(result!.my_brawler.power).toBe(11)
  })

  it('extracts teammates (excluding self)', () => {
    const result = parseBattle(makeBattleEntry(), PLAYER_TAG)
    expect(result!.teammates).toHaveLength(2)
    expect(result!.teammates[0].tag).toBe('#ALLY1')
    expect(result!.teammates[1].tag).toBe('#ALLY2')
  })

  it('extracts opponents (other team)', () => {
    const result = parseBattle(makeBattleEntry(), PLAYER_TAG)
    expect(result!.opponents).toHaveLength(3)
    expect(result!.opponents[0].tag).toBe('#FOE1')
  })

  it('handles showdown (players array, no teams)', () => {
    const entry = makeBattleEntry({
      battle: {
        mode: 'showdown',
        type: 'soloRanked',
        result: 'victory',
        duration: 90,
        trophyChange: 10,
        players: [
          { tag: '#YJU282PV', name: 'TestPlayer', brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 750 } },
          { tag: '#OTHER1', name: 'Other1', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 600 } },
        ],
      },
    })
    const result = parseBattle(entry, PLAYER_TAG)
    expect(result!.my_brawler.id).toBe(16000000)
    expect(result!.teammates).toHaveLength(0)
    expect(result!.opponents).toHaveLength(1)
  })

  it('handles missing trophyChange', () => {
    const entry = makeBattleEntry()
    delete (entry.battle as Record<string, unknown>).trophyChange
    const result = parseBattle(entry, PLAYER_TAG)
    expect(result!.trophy_change).toBe(0)
  })

  it('uses event.mode as fallback when battle.mode is empty', () => {
    const entry = makeBattleEntry()
    entry.battle.mode = ''
    const result = parseBattle(entry, PLAYER_TAG)
    expect(result!.mode).toBe('brawlBall')
  })

  it('returns null if player not found in battle', () => {
    const result = parseBattle(makeBattleEntry(), '#NOTINBATTLE')
    expect(result).toBeNull()
  })
})

describe('parseBattlelog', () => {
  it('parses multiple entries and filters null results', () => {
    const entries = [
      makeBattleEntry(),
      makeBattleEntry({ battleTime: '20260405T180000.000Z' }),
    ]
    const results = parseBattlelog(entries, PLAYER_TAG)
    expect(results).toHaveLength(2)
    expect(results[0].battle_time).toBe('2026-04-05T17:16:04.000Z')
    expect(results[1].battle_time).toBe('2026-04-05T18:00:00.000Z')
  })

  it('skips entries where player is not found', () => {
    const results = parseBattlelog([makeBattleEntry()], '#NOTINBATTLE')
    expect(results).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(parseBattlelog([], PLAYER_TAG)).toHaveLength(0)
  })
})
