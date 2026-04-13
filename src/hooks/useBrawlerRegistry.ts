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

const CACHE_KEY = 'brawlvalue:brawler-registry'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24h — matches the server revalidate window

interface CachedRegistry {
  _ts: number
  data: BrawlerRegistry
}

function readCache(): BrawlerRegistry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedRegistry
    if (Date.now() - parsed._ts > CACHE_TTL) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeCache(data: BrawlerRegistry) {
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
      .then((data: BrawlerRegistry) => {
        if (typeof data.brawlerCount === 'number' && data.brawlerCount > 0) {
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
