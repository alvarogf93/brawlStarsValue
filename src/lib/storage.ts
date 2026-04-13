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
} as const

/** True when the given key is owned by this app (prefix match). */
export function isAppStorageKey(key: string | null | undefined): boolean {
  return typeof key === 'string' && key.startsWith(STORAGE_PREFIX)
}
