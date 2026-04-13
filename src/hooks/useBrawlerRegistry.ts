'use client'

import { useState, useEffect } from 'react'

/**
 * Denominators for the stats page completion charts, fetched from
 * /api/brawlers. All values are game-wide maxes (not per-player).
 *
 * Fallback values used when the API is unreachable:
 * - brawlerCount = 101 (current roster as of April 2026)
 * - maxGadgets / maxStarPowers = brawlerCount × 2 each
 */
export interface BrawlerRegistry {
  brawlerCount: number
  maxGadgets: number
  maxStarPowers: number
}

const FALLBACK: BrawlerRegistry = {
  brawlerCount: 101,
  maxGadgets: 202,
  maxStarPowers: 202,
}

// CRITICAL: this key MUST NOT collide with `src/lib/brawler-registry.ts`
// which uses 'brawlvalue:brawler-registry' for its BrawlerEntry[] cache.
// Sprint D 2026-04-13: a previous version of this file used the same
// key and the shape mismatch (array vs object) crashed the brawler
// detail page. The string `-totals` namespace is the regression lock.
const CACHE_KEY = 'brawlvalue:brawler-registry-totals'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24h — matches the server revalidate window

interface CachedRegistry {
  _ts: number
  data: BrawlerRegistry
}

/**
 * Validate that a registry object has all three numeric fields as
 * finite positive numbers. JSON serialisation silently drops
 * `undefined` fields, so a partial cache from an older (or buggier)
 * version of this hook may be missing fields entirely. We treat any
 * such partial as a cache miss and re-fetch.
 */
function isValidRegistry(value: unknown): value is BrawlerRegistry {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<BrawlerRegistry>
  return (
    typeof v.brawlerCount === 'number' && Number.isFinite(v.brawlerCount) && v.brawlerCount > 0 &&
    typeof v.maxGadgets === 'number' && Number.isFinite(v.maxGadgets) && v.maxGadgets > 0 &&
    typeof v.maxStarPowers === 'number' && Number.isFinite(v.maxStarPowers) && v.maxStarPowers > 0
  )
}

function readCache(): BrawlerRegistry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedRegistry
    if (Date.now() - parsed._ts > CACHE_TTL) return null
    // Self-heal: if the stored shape is partial / invalid (e.g. from
    // an older buggy version of the hook), purge it and act as a
    // cache miss so the fallback or a fresh fetch takes over.
    if (!isValidRegistry(parsed.data)) {
      try { localStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

function writeCache(data: BrawlerRegistry) {
  if (!isValidRegistry(data)) return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ _ts: Date.now(), data }))
  } catch {
    /* localStorage full — ignore */
  }
}

/**
 * Fetches the game-wide brawler registry (roster size, max gadgets,
 * max star powers) from /api/brawlers. Caches in localStorage for 24h.
 * Always returns a value: the fallback is used until the first fetch
 * succeeds, so consumers never need to handle a null state.
 */
export function useBrawlerRegistry(): BrawlerRegistry {
  const [registry, setRegistry] = useState<BrawlerRegistry>(() => readCache() ?? FALLBACK)

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      // Fresh cache already loaded by useState — nothing else to do.
      return
    }

    const controller = new AbortController()
    fetch('/api/brawlers', { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`)
        return res.json()
      })
      .then((data: unknown) => {
        // Validate the FULL shape — not just brawlerCount. A partial
        // response would cache a half-broken registry that produces
        // NaN downstream (the bug shipped in Sprint D, fixed here).
        if (isValidRegistry(data)) {
          setRegistry(data)
          writeCache(data)
        }
      })
      .catch(() => {
        /* Network or API error — stick with fallback, silent. */
      })

    return () => controller.abort()
  }, [])

  return registry
}
