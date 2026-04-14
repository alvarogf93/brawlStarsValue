import { META_POLL_TARGET_RATIO, META_POLL_MIN_TARGET } from './constants'

/**
 * Pure helpers for the meta-poll (map, mode) balancing algorithm.
 *
 * The cron polls pro players from multiple country rankings and records
 * battles into `meta_stats`. Without balancing, the cumulative totals
 * skew to whatever modes pros happen to play most — brawlBall ends up
 * 10-100× any niche mode because 60-80% of pro draft battles are brawl
 * ball, and the cron has no way to steer pro players toward under-
 * sampled maps.
 *
 * The balancing approach is:
 *
 *   1. At the start of each cron run, preload the 14-day cumulative
 *      counts from `meta_stats` keyed by `${map}|${mode}`.
 *   2. Fetch the live events rotation to get the set of currently-live
 *      `(map, mode)` pairs — only these are the targets of balancing.
 *      (Out-of-rotation maps can't receive new data anyway; they
 *      naturally decay out of the 14-day window.)
 *   3. Compute the target as `max(META_POLL_MIN_TARGET, ratio × max(live counts))`.
 *   4. During the player-processing loop, every battle is gated by
 *      whether its `(map, mode)` key is in the "under target" set.
 *      The set is RECOMPUTED after each player so the filter adapts
 *      as the run progresses (e.g., Hyperspace may fall out of the
 *      under-target set mid-run once it catches up).
 *
 * All of this logic is side-effect free so we can unit-test the
 * algorithm independently of Supabase + Supercell API mocks.
 */

/** Counts keyed by `${map}|${mode}` string. */
export interface MapModeCounts {
  [key: string]: number
}

/** Canonical key format used by MapModeCounts. */
export function mapModeKey(map: string, mode: string): string {
  return `${map}|${mode}`
}

/**
 * Compute the minimum battle count each currently-live `(map, mode)`
 * pair must reach. The target is `ratio × max(counts over liveKeys)`,
 * floored at `META_POLL_MIN_TARGET` so the algorithm still makes
 * progress when every live map is undersampled (e.g., early in the
 * rolling window after a big Supercell release).
 *
 * Only `liveKeys` contribute to the `max` calculation. Out-of-rotation
 * maps may have huge 14-day counts inherited from a prior live period,
 * but they're no longer receiving new battles so they should not pull
 * the target upward.
 */
export function computeMapModeTarget(
  counts: MapModeCounts,
  liveKeys: Set<string>,
  ratio: number = META_POLL_TARGET_RATIO,
  minTarget: number = META_POLL_MIN_TARGET,
): number {
  let maxCount = 0
  for (const key of liveKeys) {
    const c = counts[key] ?? 0
    if (c > maxCount) maxCount = c
  }
  return Math.max(minTarget, Math.floor(maxCount * ratio))
}

/**
 * Return the set of live `(map, mode)` keys whose current count is
 * strictly below the target. Used as the accept-filter for incoming
 * battles during the player-processing loop.
 *
 * Keys not in `liveKeys` are NEVER included — we do not spend budget
 * on rotations that can't receive data. A key in `liveKeys` but not
 * in `counts` is implicitly at 0, which is critical: it ensures
 * brand-new rotations are always under target on their first run.
 *
 * If the returned set is empty, every live pair has reached target
 * and the caller can short-circuit — no further player processing
 * will change the balance in this run.
 */
export function findUnderTargetMapModes(
  counts: MapModeCounts,
  liveKeys: Set<string>,
  target: number,
): Set<string> {
  const under = new Set<string>()
  for (const key of liveKeys) {
    const c = counts[key] ?? 0
    if (c < target) under.add(key)
  }
  return under
}

/** A single (map, mode) mis-classification detected at the start of
 *  the meta-poll run. The cleanup helper merges `wrongMode` rows into
 *  `canonicalMode` rows for the given `map`. */
export interface MapModeStraggler {
  map: string
  /** Mode currently in the stale rows (e.g. 'brawlBall' for a hockey map). */
  wrongMode: string
  /** Canonical mode determined by the live rotation (e.g. 'brawlHockey'). */
  canonicalMode: string
}

/**
 * Find maps whose historical `meta_stats` rows are split across multiple
 * modes when the live rotation knows the ONE canonical mode for that map.
 *
 * Why this helper exists: Brawl Stars maps are 1:1 with their mode — a
 * map is always one mode in the game. But the Supercell API occasionally
 * ships battles with a stale `mode` string while the `modeId` is correct,
 * and the old `normalizeSupercellMode` (pre-2026-04-14) trusted the string
 * first. Result: Hyperspace (a brawlHockey map, modeId 45) shipped with
 * `mode: "brawlBall"` and ~600 rows landed under `brawlBall::Hyperspace`
 * instead of `brawlHockey::Hyperspace`. Same thing later with Tip Toe.
 *
 * The fix flip to `modeId`-priority stops NEW mis-classifications, but
 * existing stale rows don't self-heal — each time a new hockey map rotates
 * in we have to manually backfill. This helper closes that loop: on every
 * cron run, before processing players, we scan the preloaded counts for
 * any (map, mode) pair whose map is currently LIVE under a DIFFERENT mode
 * according to `liveKeys`. Those are definite stale rows and safe to merge.
 *
 * This helper is a PURE FUNCTION — the cleanup side-effects live in the
 * cron route so they can be mocked in integration tests.
 */
export function findMapModeStragglers(
  counts: MapModeCounts,
  liveKeys: Set<string>,
): MapModeStraggler[] {
  // Build canonicalByMap from the live rotation: each live map has
  // exactly one canonical mode (the one currently in rotation).
  const canonicalByMap = new Map<string, string>()
  for (const key of liveKeys) {
    const pipeIdx = key.indexOf('|')
    if (pipeIdx <= 0) continue
    const map = key.slice(0, pipeIdx)
    const mode = key.slice(pipeIdx + 1)
    canonicalByMap.set(map, mode)
  }

  const stragglers: MapModeStraggler[] = []
  const seen = new Set<string>() // dedup (map, wrongMode) pairs
  for (const key of Object.keys(counts)) {
    const pipeIdx = key.indexOf('|')
    if (pipeIdx <= 0) continue
    const map = key.slice(0, pipeIdx)
    const mode = key.slice(pipeIdx + 1)
    const canonical = canonicalByMap.get(map)
    // Only flag maps that are CURRENTLY live under a different mode.
    // Out-of-rotation maps (not in liveKeys) are left alone — they
    // decay out of the 14-day window naturally, and we can't determine
    // their canonical mode without running a separate rotation query.
    if (canonical && canonical !== mode && (counts[key] ?? 0) > 0) {
      const dedupKey = `${map}|${mode}`
      if (seen.has(dedupKey)) continue
      seen.add(dedupKey)
      stragglers.push({ map, wrongMode: mode, canonicalMode: canonical })
    }
  }
  return stragglers
}
