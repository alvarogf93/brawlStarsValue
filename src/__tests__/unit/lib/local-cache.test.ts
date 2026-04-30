/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readLocalCache, writeLocalCache, clearLocalCache } from '@/lib/local-cache'

const KEY = 'test:scope:thing'
const TTL = 5 * 60 * 1000

beforeEach(() => {
  localStorage.clear()
})

describe('local-cache — versioned localStorage helper (LOG-13)', () => {
  it('round-trips a payload through write → read', () => {
    writeLocalCache(KEY, 1, { a: 1, b: ['x', 'y'] })
    expect(readLocalCache<{ a: number; b: string[] }>(KEY, 1, TTL)).toEqual({
      a: 1, b: ['x', 'y'],
    })
  })

  it('returns null when the version differs', () => {
    writeLocalCache(KEY, 1, { foo: 'old' })
    // Reader bumped to v2 — must NOT see the old payload, must remove it.
    expect(readLocalCache(KEY, 2, TTL)).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('returns null and removes the entry when older than ttlMs', () => {
    writeLocalCache(KEY, 1, { foo: 'old' })
    // Manually rewind the storedAt — easier than waiting.
    const raw = JSON.parse(localStorage.getItem(KEY)!)
    raw.storedAt = Date.now() - (TTL + 1000)
    localStorage.setItem(KEY, JSON.stringify(raw))

    expect(readLocalCache(KEY, 1, TTL)).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('returns null and removes the entry when JSON is corrupt', () => {
    localStorage.setItem(KEY, 'not json')
    expect(readLocalCache(KEY, 1, TTL)).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('returns null when the entry is missing required fields', () => {
    // A pre-LOG-13 payload (legacy shape) would lack `v` and `storedAt`.
    localStorage.setItem(KEY, JSON.stringify({ data: { foo: 'legacy' } }))
    expect(readLocalCache(KEY, 1, TTL)).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('clearLocalCache removes a single entry', () => {
    writeLocalCache(KEY, 1, { a: 1 })
    clearLocalCache(KEY)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('writeLocalCache silently no-ops on quota errors (we still have the data in memory)', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError') }
    expect(() => writeLocalCache(KEY, 1, { huge: 'payload' })).not.toThrow()
    Storage.prototype.setItem = original
  })
})
