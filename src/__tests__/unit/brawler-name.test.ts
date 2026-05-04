import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolveBrawlerName } from '@/lib/brawler-name'
import {
  writeSupercellRosterCache,
  type SupercellRoster,
} from '@/lib/supercell-roster-cache'
import { setCachedRegistry } from '@/lib/brawler-registry'

/**
 * Regression: 2026-05-04 — DAMIAN (16000104) and four other newly-released
 * brawlers (SIRIUS 16000102, NAJIA 16000103, STARR NOVA 16000105, BOLT
 * 16000106) rendered as `#16000104` etc. on the public brawler pages
 * because Brawlify's community API trailed Supercell by ~5 brawlers and
 * `resolveBrawlerName` only consulted Brawlify. The fix reads the
 * Supercell-sourced roster cache first; this suite locks the priority
 * order in.
 */

const SUPERCELL_ROSTER: SupercellRoster = {
  brawlerCount: 5,
  maxGadgets: 10,
  maxStarPowers: 10,
  roster: [
    { id: 16000000, name: 'SHELLY', gadgets: 2, starPowers: 2, hyperCharges: 1 },
    { id: 16000102, name: 'SIRIUS', gadgets: 2, starPowers: 2, hyperCharges: 0 },
    { id: 16000103, name: 'NAJIA', gadgets: 2, starPowers: 2, hyperCharges: 0 },
    { id: 16000104, name: 'DAMIAN', gadgets: 2, starPowers: 2, hyperCharges: 0 },
    { id: 16000106, name: 'BOLT', gadgets: 2, starPowers: 2, hyperCharges: 0 },
  ],
}

const BRAWLIFY_REGISTRY = [
  { id: 16000000, name: 'SHELLY', rarity: 'Trophy Road', class: 'Damage', imageUrl: '' },
  // Note: Brawlify intentionally lags — SIRIUS / NAJIA / DAMIAN / BOLT absent.
]

beforeEach(() => {
  // jsdom localStorage is per-test; clear it so the previous test's
  // cache writes don't leak into the next.
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolveBrawlerName — priority order', () => {
  it('returns the Supercell name for a brawler missing from Brawlify', () => {
    writeSupercellRosterCache(SUPERCELL_ROSTER)
    setCachedRegistry(BRAWLIFY_REGISTRY)

    expect(resolveBrawlerName(16000104)).toBe('DAMIAN')
    expect(resolveBrawlerName(16000103)).toBe('NAJIA')
    expect(resolveBrawlerName(16000102)).toBe('SIRIUS')
    expect(resolveBrawlerName(16000106)).toBe('BOLT')
  })

  it('returns the Brawlify name when Supercell cache is missing', () => {
    // No Supercell write — only Brawlify.
    setCachedRegistry(BRAWLIFY_REGISTRY)

    expect(resolveBrawlerName(16000000)).toBe('SHELLY')
  })

  it('prefers Supercell over Brawlify when both have the brawler', () => {
    writeSupercellRosterCache({
      ...SUPERCELL_ROSTER,
      roster: [
        { id: 16000000, name: 'SHELLY-FROM-SUPERCELL', gadgets: 2, starPowers: 2, hyperCharges: 1 },
      ],
    })
    setCachedRegistry([
      { id: 16000000, name: 'SHELLY-FROM-BRAWLIFY', rarity: '', class: '', imageUrl: '' },
    ])

    expect(resolveBrawlerName(16000000)).toBe('SHELLY-FROM-SUPERCELL')
  })

  it('falls back to caller-supplied playerBrawlerNames when both caches miss', () => {
    // No cache writes — both caches empty.
    const playerNames = new Map<number, string>([[16000104, 'DAMIAN']])
    expect(resolveBrawlerName(16000104, playerNames)).toBe('DAMIAN')
  })

  it('falls back to #ID only when every source misses', () => {
    // No cache, no player map.
    expect(resolveBrawlerName(16000999)).toBe('#16000999')
  })

  it('does NOT fall back to #ID when Supercell cache has the brawler', () => {
    writeSupercellRosterCache(SUPERCELL_ROSTER)
    // Without the fix, this returned `#16000104` — exact reproduction of
    // the bug reported on 2026-05-04.
    expect(resolveBrawlerName(16000104)).not.toMatch(/^#\d+$/)
  })

  it('returns #ID when the cache is stale (version mismatch)', () => {
    // Hand-write a cache entry with a wrong version so the read function
    // returns null and we observe the fallback chain.
    window.localStorage.setItem(
      'brawlvalue:brawler-registry-totals',
      JSON.stringify({ _v: 999, _ts: Date.now(), data: SUPERCELL_ROSTER }),
    )
    expect(resolveBrawlerName(16000104)).toBe('#16000104')
  })
})
