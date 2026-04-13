import { DRAFT_MODES, META_POLL_TARGET_RATIO, META_POLL_MIN_TARGET } from './constants'

/**
 * Pure helpers for the adaptive meta-poll top-up algorithm.
 *
 * The cron polls the top N pro players, counts battles per mode, and if any
 * mode is under-sampled relative to the best-covered mode, keeps polling
 * subsequent chunks — but only stores battles from the under-sampled modes
 * to avoid amplifying the already-popular ones.
 *
 * All of this logic is side-effect free so we can unit-test the algorithm
 * independently of Supabase + Supercell API mocks.
 */

export interface ModeCounts {
  /** Absolute battle counts by mode key (e.g. 'brawlBall', 'basketBrawl') */
  [mode: string]: number
}

/**
 * Given a running count of battles per mode, compute the minimum number of
 * battles each mode must reach. The target is `ratio * maxCount`, floored at
 * `META_POLL_MIN_TARGET` so we still do meaningful top-up on quiet days where
 * even the best mode is undersampled.
 *
 * Missing modes (key not present in `counts`) are implicitly treated as 0,
 * which is crucial — the top-up has to reach them, not ignore them.
 */
export function computeModeTarget(
  counts: ModeCounts,
  ratio: number = META_POLL_TARGET_RATIO,
  minTarget: number = META_POLL_MIN_TARGET,
): number {
  let maxCount = 0
  for (const mode of DRAFT_MODES) {
    const c = counts[mode] ?? 0
    if (c > maxCount) maxCount = c
  }
  return Math.max(minTarget, Math.floor(maxCount * ratio))
}

/**
 * Return the set of draft modes whose current count is strictly below the
 * target. Used by the cron to decide whether a top-up iteration is needed,
 * and to filter which battles from subsequent chunks are worth keeping.
 *
 * Note: if every mode is already at or above target, the set is empty and
 * the cron stops polling.
 */
export function findUnderTargetModes(
  counts: ModeCounts,
  target: number,
): Set<string> {
  const under = new Set<string>()
  for (const mode of DRAFT_MODES) {
    const c = counts[mode] ?? 0
    if (c < target) under.add(mode)
  }
  return under
}
