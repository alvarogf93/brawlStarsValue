'use client'

import { useState, useEffect } from 'react'
import { STORAGE_KEYS } from '@/lib/storage'

/**
 * Game-wide brawler registry from /api/brawlers (which itself proxies the
 * Supercell official `/brawlers` endpoint — the canonical source of truth).
 *
 * `roster` is a FULL list of every brawler currently in the game, so
 * consumers can cross-reference with `data.player.brawlers` to render
 * unowned brawlers as "locked" instead of hiding them entirely. Without
 * this, every page that listed brawlers showed only what the user owned
 * — new brawlers were invisible from the moment they shipped until the
 * user unlocked them. (FAIL-NEW-BRAWLERS, observed when DAMIAN released.)
 *
 * Fallback values used when the API is unreachable AND there's no cache:
 *   - brawlerCount, maxGadgets, maxStarPowers: roster size of April 2026.
 *   - roster: empty array. UI must guard against this — render only the
 *     player's owned brawlers in that case (the legacy behaviour).
 */
export interface BrawlerRegistry {
  brawlerCount: number
  maxGadgets: number
  maxStarPowers: number
  roster: BrawlerRosterEntry[]
}

export interface BrawlerRosterEntry {
  id: number
  name: string
  gadgets: number
  starPowers: number
  hyperCharges: number
}

const FALLBACK: BrawlerRegistry = {
  brawlerCount: 104,
  maxGadgets: 208,
  maxStarPowers: 208,
  roster: [],
}

// Uses a distinct key from `src/lib/brawler-registry.ts` (which
// holds a BrawlerEntry[] array under STORAGE_KEYS.BRAWLER_REGISTRY).
// Sprint D 2026-04-13: both files briefly shared the same literal
// and the shape mismatch (object vs array) crashed the brawler
// detail page. Both keys now live in `src/lib/storage.ts` so any
// accidental re-aliasing has to go through a single file.
const CACHE_KEY = STORAGE_KEYS.BRAWLER_REGISTRY_TOTALS
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24h — matches the server revalidate window
// Bump when BrawlerRegistry / BrawlerRosterEntry shape changes. Old
// caches without the right shape are dropped on read.
const CACHE_VERSION = 2

interface CachedRegistry {
  _v: number
  _ts: number
  data: BrawlerRegistry
}

/**
 * Validate that a registry object has all numeric fields as finite
 * positive numbers AND a roster array (possibly empty). JSON serialisation
 * silently drops `undefined` fields, so a partial cache from an older
 * version of this hook may be missing fields entirely. We treat any such
 * partial as a cache miss and re-fetch.
 */
function isValidRegistry(value: unknown): value is BrawlerRegistry {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<BrawlerRegistry>
  return (
    typeof v.brawlerCount === 'number' && Number.isFinite(v.brawlerCount) && v.brawlerCount > 0 &&
    typeof v.maxGadgets === 'number' && Number.isFinite(v.maxGadgets) && v.maxGadgets > 0 &&
    typeof v.maxStarPowers === 'number' && Number.isFinite(v.maxStarPowers) && v.maxStarPowers > 0 &&
    Array.isArray(v.roster)
  )
}

function readCache(): BrawlerRegistry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedRegistry
    if (parsed._v !== CACHE_VERSION) return null
    if (Date.now() - parsed._ts > CACHE_TTL) return null
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
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ _v: CACHE_VERSION, _ts: Date.now(), data }),
    )
  } catch {
    /* localStorage full — ignore */
  }
}

/**
 * Fetches the game-wide brawler registry from /api/brawlers. Caches in
 * localStorage for 24h. Always returns a value: the fallback is used
 * until the first fetch succeeds, so consumers never need to handle a
 * null state.
 *
 * `roster` may be empty (fallback or stale cache) — UIs MUST guard with
 * `if (registry.roster.length > 0) { …render full grid… } else { …render
 * only owned… }` to gracefully degrade.
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
        if (isValidRegistry(data)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
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
