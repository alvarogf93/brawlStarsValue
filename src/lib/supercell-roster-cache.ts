/**
 * Localstorage cache for the Supercell-sourced game roster.
 *
 * Owned by `useBrawlerRegistry` (which is the single fetch site for
 * `/api/brawlers`); exposed here so other modules can synchronously
 * read the same cache without pulling React hooks. Notably,
 * `resolveBrawlerName` reads it so the canonical Supercell-supplied
 * `name` (always includes brand-new brawlers the same day they ship)
 * wins over the Brawlify-only registry, which trails Supercell by
 * 1-3 days and produced `#16000104`-style fallbacks for new brawlers.
 *
 * Bumping `SUPERCELL_ROSTER_CACHE_VERSION` invalidates every client's
 * cache on the next read — the equivalent of a free schema migration.
 */

import { STORAGE_KEYS } from '@/lib/storage'

export const SUPERCELL_ROSTER_KEY = STORAGE_KEYS.BRAWLER_REGISTRY_TOTALS
export const SUPERCELL_ROSTER_CACHE_VERSION = 3
export const SUPERCELL_ROSTER_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export interface SupercellRosterEntry {
  id: number
  name: string
  gadgets: number
  starPowers: number
  hyperCharges: number
  /** From Brawlify when available; absent for brand-new brawlers
   *  Brawlify hasn't published yet. Consumers fall back to the
   *  hardcoded BRAWLER_RARITY_MAP and finally omit the badge. */
  rarity?: string
  rarityColor?: string
}

export interface SupercellRoster {
  brawlerCount: number
  maxGadgets: number
  maxStarPowers: number
  roster: SupercellRosterEntry[]
}

interface CachedEntry {
  _v: number
  _ts: number
  data: SupercellRoster
}

function isValidRoster(value: unknown): value is SupercellRoster {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<SupercellRoster>
  return (
    typeof v.brawlerCount === 'number' && Number.isFinite(v.brawlerCount) && v.brawlerCount > 0 &&
    typeof v.maxGadgets === 'number' && Number.isFinite(v.maxGadgets) && v.maxGadgets > 0 &&
    typeof v.maxStarPowers === 'number' && Number.isFinite(v.maxStarPowers) && v.maxStarPowers > 0 &&
    Array.isArray(v.roster)
  )
}

/**
 * Synchronous cache read. Returns null on:
 *   - SSR (window unavailable)
 *   - missing key
 *   - version mismatch (callers should re-fetch)
 *   - stale entry
 *   - schema-invalid payload (which is also purged in place)
 */
export function readSupercellRosterCache(): SupercellRoster | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SUPERCELL_ROSTER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedEntry
    if (parsed._v !== SUPERCELL_ROSTER_CACHE_VERSION) return null
    if (Date.now() - parsed._ts > SUPERCELL_ROSTER_CACHE_TTL_MS) return null
    if (!isValidRoster(parsed.data)) {
      try { window.localStorage.removeItem(SUPERCELL_ROSTER_KEY) } catch { /* ignore */ }
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

export function writeSupercellRosterCache(data: SupercellRoster): void {
  if (typeof window === 'undefined') return
  if (!isValidRoster(data)) return
  try {
    window.localStorage.setItem(
      SUPERCELL_ROSTER_KEY,
      JSON.stringify({ _v: SUPERCELL_ROSTER_CACHE_VERSION, _ts: Date.now(), data }),
    )
  } catch {
    /* localStorage full or blocked — ignore */
  }
}
