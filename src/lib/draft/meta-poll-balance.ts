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
