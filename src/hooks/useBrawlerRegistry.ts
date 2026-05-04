'use client'

import { useState, useEffect } from 'react'
import {
  readSupercellRosterCache,
  writeSupercellRosterCache,
  type SupercellRoster,
  type SupercellRosterEntry,
} from '@/lib/supercell-roster-cache'

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
 * The persistence (localStorage cache + invalidation rules) lives in
 * `src/lib/supercell-roster-cache.ts` so other modules — notably
 * `resolveBrawlerName` — can read the same cache synchronously without
 * pulling in this hook (which would force them to be client components).
 *
 * Fallback values used when the API is unreachable AND there's no cache:
 *   - brawlerCount, maxGadgets, maxStarPowers: roster size of April 2026.
 *   - roster: empty array. UI must guard against this — render only the
 *     player's owned brawlers in that case (the legacy behaviour).
 */
export type BrawlerRegistry = SupercellRoster
export type BrawlerRosterEntry = SupercellRosterEntry

const FALLBACK: BrawlerRegistry = {
  brawlerCount: 104,
  maxGadgets: 208,
  maxStarPowers: 208,
  roster: [],
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
  const [registry, setRegistry] = useState<BrawlerRegistry>(() => readSupercellRosterCache() ?? FALLBACK)

  useEffect(() => {
    const cached = readSupercellRosterCache()
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
        // writeSupercellRosterCache also runs the schema check; if data
        // doesn't match SupercellRoster shape, the write is a no-op and
        // we keep the fallback in state.
        if (data && typeof data === 'object' && Array.isArray((data as SupercellRoster).roster)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setRegistry(data as SupercellRoster)
          writeSupercellRosterCache(data as SupercellRoster)
        }
      })
      .catch(() => {
        /* Network or API error — stick with fallback, silent. */
      })

    return () => controller.abort()
  }, [])

  return registry
}
