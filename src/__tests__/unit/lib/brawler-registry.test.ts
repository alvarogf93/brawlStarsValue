import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getCachedRegistry, setCachedRegistry, type BrawlerEntry } from '@/lib/brawler-registry'
import { STORAGE_KEYS } from '@/lib/storage'

const LS_KEY = STORAGE_KEYS.BRAWLER_REGISTRY

const memoryStore = new Map<string, string>()
const mockLocalStorage = {
  getItem: vi.fn((k: string) => memoryStore.get(k) ?? null),
  setItem: vi.fn((k: string, v: string) => { memoryStore.set(k, v) }),
  removeItem: vi.fn((k: string) => { memoryStore.delete(k) }),
  clear: vi.fn(() => { memoryStore.clear() }),
}

beforeEach(() => {
  memoryStore.clear()
  mockLocalStorage.getItem.mockClear()
  mockLocalStorage.setItem.mockClear()
  mockLocalStorage.removeItem.mockClear()
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  })
})

const SAMPLE_BRAWLERS: BrawlerEntry[] = [
  { id: 16000000, name: 'SHELLY', rarity: 'Trophy Road', class: 'Damage Dealer', imageUrl: '/s.png' },
  { id: 16000001, name: 'COLT', rarity: 'Rare', class: 'Sharpshooter', imageUrl: '/c.png' },
]

describe('getCachedRegistry / setCachedRegistry — happy path', () => {
  it('returns null when nothing is cached', () => {
    expect(getCachedRegistry()).toBeNull()
  })

  it('round-trips a valid BrawlerEntry array', () => {
    setCachedRegistry(SAMPLE_BRAWLERS)
    const result = getCachedRegistry()
    expect(result).toEqual(SAMPLE_BRAWLERS)
  })

  it('returns null when the cache is older than 24h', () => {
    const stale = Date.now() - 25 * 60 * 60 * 1000
    memoryStore.set(LS_KEY, JSON.stringify({ data: SAMPLE_BRAWLERS, ts: stale }))
    expect(getCachedRegistry()).toBeNull()
  })
})

describe('getCachedRegistry — collision regression locks (Sprint D)', () => {
  it('returns null and PURGES the cache when the stored data is an object (not an array)', () => {
    // This is the exact corruption that crashed the brawler detail
    // page on 2026-04-13: useBrawlerRegistry briefly used the same
    // localStorage key with an object shape, overwriting this cache.
    // Calling .find(...) on the object threw a TypeError.
    memoryStore.set(LS_KEY, JSON.stringify({
      data: { brawlerCount: 101, maxGadgets: 202, maxStarPowers: 202 },
      ts: Date.now(),
    }))

    const result = getCachedRegistry()
    expect(result).toBeNull()
    // Purged in place — next call sees a clean cache
    expect(memoryStore.get(LS_KEY)).toBeUndefined()
  })

  it('returns null when the data field is a string', () => {
    memoryStore.set(LS_KEY, JSON.stringify({ data: 'hello', ts: Date.now() }))
    expect(getCachedRegistry()).toBeNull()
  })

  it('returns null when the data field is null', () => {
    memoryStore.set(LS_KEY, JSON.stringify({ data: null, ts: Date.now() }))
    expect(getCachedRegistry()).toBeNull()
  })

  it('returns null when the cached payload is malformed JSON', () => {
    memoryStore.set(LS_KEY, '{not valid json')
    expect(getCachedRegistry()).toBeNull()
  })

  it('returns null when the cached payload is a bare value (no wrapper)', () => {
    memoryStore.set(LS_KEY, JSON.stringify(SAMPLE_BRAWLERS))
    // Bare array → parsed.data is undefined → typeof ts !== 'number' → null
    expect(getCachedRegistry()).toBeNull()
  })

  it('returns null when ts is missing or wrong type', () => {
    memoryStore.set(LS_KEY, JSON.stringify({ data: SAMPLE_BRAWLERS, ts: 'recent' }))
    expect(getCachedRegistry()).toBeNull()
  })
})

describe('setCachedRegistry — input validation', () => {
  it('writes a valid BrawlerEntry array', () => {
    setCachedRegistry(SAMPLE_BRAWLERS)
    expect(memoryStore.has(LS_KEY)).toBe(true)
    const stored = JSON.parse(memoryStore.get(LS_KEY)!)
    expect(stored.data).toEqual(SAMPLE_BRAWLERS)
    expect(typeof stored.ts).toBe('number')
  })

  it('refuses to write a non-array value (defensive — protects sibling consumers)', () => {
    // TS won't let you call setCachedRegistry with a non-array under
    // normal usage, but if someone bypasses the type via `as any` or
    // a fetch returning unexpected JSON, the runtime check rejects it.
    setCachedRegistry({ brawlerCount: 101 } as unknown as BrawlerEntry[])
    expect(memoryStore.has(LS_KEY)).toBe(false)
  })
})

describe('localStorage key isolation (Sprint D regression)', () => {
  it('uses a key that DOES NOT collide with useBrawlerRegistry', () => {
    // Anchor the regression lock on the canonical STORAGE_KEYS
    // entries instead of raw string literals — this way any future
    // rename of either constant is still caught without having to
    // hand-update the test.
    expect(STORAGE_KEYS.BRAWLER_REGISTRY).not.toBe(STORAGE_KEYS.BRAWLER_REGISTRY_TOTALS)
    // Sanity: this file's setCachedRegistry must write to the legacy key
    setCachedRegistry(SAMPLE_BRAWLERS)
    expect(memoryStore.has(STORAGE_KEYS.BRAWLER_REGISTRY)).toBe(true)
    expect(memoryStore.has(STORAGE_KEYS.BRAWLER_REGISTRY_TOTALS)).toBe(false)
  })
})
