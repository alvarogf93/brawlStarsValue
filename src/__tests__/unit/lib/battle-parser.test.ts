import { describe, it, expect, vi } from 'vitest'
import { parseBattle, parseBattleTime, parseBattlelog, parseSupercellTime } from '@/lib/battle-parser'
import type { BattlelogEntry } from '@/lib/api'

describe('parseSupercellTime — robust event-time parser', () => {
  it('parses the Supercell compact format "YYYYMMDDTHHMMSS.fffZ"', () => {
    const d = parseSupercellTime('20260413T120000.000Z')
    expect(d).not.toBeNull()
    expect(d!.toISOString()).toBe('2026-04-13T12:00:00.000Z')
  })

  it('parses the Supercell compact format without milliseconds', () => {
    const d = parseSupercellTime('20260413T120000Z')
    expect(d).not.toBeNull()
    expect(d!.toISOString()).toBe('2026-04-13T12:00:00.000Z')
  })

  it('parses already-ISO 8601 strings as a fallback', () => {
    const d = parseSupercellTime('2026-04-13T12:00:00.000Z')
    expect(d).not.toBeNull()
    expect(d!.toISOString()).toBe('2026-04-13T12:00:00.000Z')
  })

  it('returns null for empty strings', () => {
    expect(parseSupercellTime('')).toBeNull()
  })

  it('returns null for null/undefined input', () => {
    expect(parseSupercellTime(null)).toBeNull()
    expect(parseSupercellTime(undefined)).toBeNull()
  })

  it('returns null for garbage strings that Date cannot parse', () => {
    expect(parseSupercellTime('not-a-date')).toBeNull()
    expect(parseSupercellTime('20260413')).toBeNull() // date only, no T/time
  })

  it('returns null for a compact-format string with an impossible date', () => {
    // Month 13 — regex matches but Date rejects the resulting ISO string
    expect(parseSupercellTime('20261345T120000.000Z')).toBeNull()
  })

  it('regression: the raw Supercell format would produce NaN via new Date() directly', () => {
    // This is the pre-fix behaviour the helper protects against.
    // If new Date() ever learns to parse this format, the helper still works
    // because the compact regex runs FIRST and produces a known-good ISO string.
    const raw = '20260413T120000.000Z'
    const directDate = new Date(raw)
    expect(Number.isNaN(directDate.getTime())).toBe(true) // the bug

    const parsed = parseSupercellTime(raw)
    expect(parsed).not.toBeNull() // the fix
    expect(Number.isNaN(parsed!.getTime())).toBe(false)
  })
})

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

  it('handles midnight timestamp', () => {
    expect(parseBattleTime('20260101T000000.000Z')).toBe('2026-01-01T00:00:00.000Z')
  })

  it('handles end-of-day timestamp', () => {
    expect(parseBattleTime('20261231T235959.000Z')).toBe('2026-12-31T23:59:59.000Z')
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

  it('handles missing starPlayer field', () => {
    const entry = makeBattleEntry()
    delete (entry.battle as Record<string, unknown>).starPlayer
    const result = parseBattle(entry, PLAYER_TAG)
    expect(result!.is_star_player).toBe(false)
  })

  it('handles missing duration field', () => {
    const entry = makeBattleEntry()
    delete (entry.battle as Record<string, unknown>).duration
    const result = parseBattle(entry, PLAYER_TAG)
    expect(result!.duration).toBeNull()
  })

  it('handles null map in event', () => {
    const entry = makeBattleEntry()
    ;(entry.event as Record<string, unknown>).map = ''
    const result = parseBattle(entry, PLAYER_TAG)
    // Empty string is falsy, so map should be null
    expect(result!.map).toBeNull()
  })

  it('populates gadgets and starPowers in my_brawler', () => {
    const entry = makeBattleEntry()
    entry.battle.teams![0][0].brawler.gadgets = [{ id: 1, name: 'GadgetA' }]
    entry.battle.teams![0][0].brawler.starPowers = [{ id: 2, name: 'StarPowerA' }]
    const result = parseBattle(entry, PLAYER_TAG)
    expect(result!.my_brawler.gadgets).toEqual([{ id: 1, name: 'GadgetA' }])
    expect(result!.my_brawler.starPowers).toEqual([{ id: 2, name: 'StarPowerA' }])
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

  it('skips entries with malformed battleTime instead of aborting the batch (LOG-12)', () => {
    // parseBattleTime now throws on unparseable input. parseBattlelog
    // catches per-entry so one bad battle doesn't tank the whole sync.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const entries = [
      makeBattleEntry(),
      makeBattleEntry({ battleTime: 'not a real time' }),
      makeBattleEntry({ battleTime: '20260405T180000.000Z' }),
    ]

    const results = parseBattlelog(entries, PLAYER_TAG)

    // 2 valid entries returned; the malformed one was skipped.
    expect(results).toHaveLength(2)
    expect(results[0].battle_time).toBe('2026-04-05T17:16:04.000Z')
    expect(results[1].battle_time).toBe('2026-04-05T18:00:00.000Z')

    // The skip is observable — operators can grep the bad battleTime in logs.
    expect(warn).toHaveBeenCalledTimes(1)
    const warnCall = warn.mock.calls[0]
    expect(warnCall[0]).toMatch(/skipping malformed entry/)
    expect(JSON.stringify(warnCall[1])).toContain('not a real time')

    warn.mockRestore()
  })
})
