/**
 * Centralized localStorage keys used across more than one file.
 *
 * Exists to prevent the class of bug that crashed the brawler
 * detail page in commit 9eff831, where two unrelated caches were
 * sharing the same `'brawlvalue:brawler-registry'` literal from
 * different files and writing incompatible shapes to it. A central
 * registry makes every cross-file key visible at a glance and
 * prevents silent drift.
 *
 * Per-hook caches that are written and read from a single file
 * (e.g. `useBattlelog`, `useClub`) do NOT belong here — they stay
 * local to their own hook, since they cannot collide with anything.
 */

/** Prefix every app-owned localStorage key starts with. Used by
 *  cleanup helpers that need to iterate and drop our keys without
 *  touching third-party keys (e.g. Supabase `sb-*`). */
export const STORAGE_PREFIX = 'brawlvalue:' as const

export const STORAGE_KEYS = {
  /** Last-searched player tag — persisted by the landing form and
   *  consumed by the leaderboard, header and auth provider to
   *  remember who the user is between visits. */
  USER: 'brawlvalue:user',
  /** Referral code captured from `?ref=` query param on landing,
   *  consumed by the auth flow at sign-up time. */
  REF: 'brawlvalue:ref',
  /** Legacy `BrawlerEntry[]` cache (BrawlAPI community data) used by
   *  `src/lib/brawler-registry.ts`. The `-totals` sibling below has
   *  a completely different shape — they MUST remain distinct keys
   *  or the brawler detail page crashes on `.find()` over an object
   *  (regression tested in `brawler-registry.test.ts`). */
  BRAWLER_REGISTRY: 'brawlvalue:brawler-registry',
  /** Game-wide registry totals (brawlerCount, maxGadgets,
   *  maxStarPowers) used by `useBrawlerRegistry`. Separate namespace
   *  from `BRAWLER_REGISTRY` on purpose. */
  BRAWLER_REGISTRY_TOTALS: 'brawlvalue:brawler-registry-totals',
} as const

/** Shared prefix for the per-player GemScore cache — key format is
 *  `${PLAYER_CACHE_PREFIX}${tag.toUpperCase()}`. Writer is
 *  `usePlayerData`; readers are `UpgradeCard` (for the hook banner
 *  segment heuristic) and `AuthProvider` (for bulk invalidation on
 *  profile sync). Centralized so renaming requires one edit instead
 *  of three. */
export const PLAYER_CACHE_PREFIX = `${STORAGE_PREFIX}player:` as const

/** Build the per-player cache key for the given tag. */
export function playerCacheKey(tag: string): string {
  return `${PLAYER_CACHE_PREFIX}${tag.toUpperCase()}`
}

/** Type predicate: narrows `key` to `string` after a truthy return,
 *  so callers iterating `Storage.key(i)` (which returns
 *  `string | null`) don't need non-null assertions. */
export function isAppStorageKey(key: string | null | undefined): key is string {
  return typeof key === 'string' && key.startsWith(STORAGE_PREFIX)
}
