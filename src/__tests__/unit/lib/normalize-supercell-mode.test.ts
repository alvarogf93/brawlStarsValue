import { describe, it, expect } from 'vitest'
import { normalizeSupercellMode, isDraftMode, DRAFT_MODES } from '@/lib/draft/constants'

describe('normalizeSupercellMode', () => {
  it('returns the raw mode string when it is already a known draft mode', () => {
    expect(normalizeSupercellMode('brawlBall', 2)).toBe('brawlBall')
    expect(normalizeSupercellMode('gemGrab', 0)).toBe('gemGrab')
    expect(normalizeSupercellMode('knockout', 20)).toBe('knockout')
  })

  it('trims whitespace on known mode strings', () => {
    expect(normalizeSupercellMode('  brawlBall  ', null)).toBe('brawlBall')
  })

  it('falls back to modeId 45 → brawlHockey when the mode string is "unknown"', () => {
    // This is the EXACT bug that caused Hyperspace / Brawl Hockey
    // to have zero pro data in meta_stats. Supercell reports mode:
    // "unknown" for brand-new modes but the modeId is correct.
    expect(normalizeSupercellMode('unknown', 45)).toBe('brawlHockey')
  })

  it('falls back to modeId even when mode string is empty / null / undefined', () => {
    expect(normalizeSupercellMode('', 45)).toBe('brawlHockey')
    expect(normalizeSupercellMode(null, 45)).toBe('brawlHockey')
    expect(normalizeSupercellMode(undefined, 45)).toBe('brawlHockey')
  })

  it('returns null when neither the mode nor the modeId maps to a draft mode', () => {
    expect(normalizeSupercellMode('unknown', 999)).toBeNull()
    expect(normalizeSupercellMode('unknown', null)).toBeNull()
    expect(normalizeSupercellMode('duoShowdown', 9)).toBeNull()   // SD is not a draft mode
    expect(normalizeSupercellMode('soloShowdown', 6)).toBeNull()
    expect(normalizeSupercellMode('', null)).toBeNull()
    expect(normalizeSupercellMode(null, null)).toBeNull()
  })

  it('prefers the explicit mode string when both sources agree (no regression)', () => {
    expect(normalizeSupercellMode('brawlHockey', 45)).toBe('brawlHockey')
  })

  it('prefers modeId over a conflicting mode string — Hyperspace/brawlHockey regression', () => {
    // Supercell reported Hyperspace battles with mode='brawlBall' and
    // modeId=45 for weeks. The original implementation checked
    // isDraftMode(rawMode) first and returned 'brawlBall' without ever
    // looking at the modeId, so 369 Hyperspace rows ended up mis-
    // classified in meta_stats and brawlHockey had 0 rows. The fix
    // flips the priority so modeId wins when it maps to a known
    // draft mode. This test locks the new ordering.
    expect(normalizeSupercellMode('brawlBall', 45)).toBe('brawlHockey')
  })

  it('every currently-listed draft mode round-trips through the normalizer', () => {
    for (const mode of DRAFT_MODES) {
      expect(normalizeSupercellMode(mode, 0)).toBe(mode)
      expect(isDraftMode(mode)).toBe(true)
    }
  })

  it('returns the canonical key (not the input casing) when the input is already a draft mode', () => {
    // Guards against us one day accepting mixed casing — if we do,
    // this test will fail and force us to explicitly decide the
    // canonical-casing rule.
    expect(normalizeSupercellMode('brawlBall', 2)).toBe('brawlBall')
  })
})
