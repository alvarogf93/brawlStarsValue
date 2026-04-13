import { STORAGE_KEYS } from '@/lib/storage'

/** Brawler data from BrawlAPI (community API) */
export interface BrawlerEntry {
  id: number
  name: string
  rarity: string
  class: string
  imageUrl: string
}

/** Client-side cache — fetches once and caches in localStorage */
const LS_KEY = STORAGE_KEYS.BRAWLER_REGISTRY
const LS_TTL = 24 * 60 * 60 * 1000

/**
 * Self-healing read: validates that the cached payload is actually a
 * BrawlerEntry[] before returning. Sprint D 2026-04-13: a sibling
 * hook (`useBrawlerRegistry` in `/src/hooks/`) briefly used the same
 * localStorage key with a totally different shape (an object with
 * `brawlerCount` etc.). That overwrote this cache and crashed the
 * brawler detail page on `.find(...)`. The validation here purges
 * any incompatible payload so we never return a non-array. The other
 * hook has since been moved to a different key.
 */
export function getCachedRegistry(): BrawlerEntry[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { data, ts } = parsed as { data: unknown; ts: number }
    if (typeof ts !== 'number' || Date.now() - ts > LS_TTL) return null
    if (!Array.isArray(data)) {
      // Polluted cache from a different consumer using the same key.
      // Purge in place so the next caller starts clean.
      try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
      return null
    }
    return data as BrawlerEntry[]
  } catch {
    return null
  }
}

export function setCachedRegistry(data: BrawlerEntry[]): void {
  if (!Array.isArray(data)) return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* ignore */ }
}
