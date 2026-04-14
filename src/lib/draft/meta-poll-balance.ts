/**
 * Pure helpers for the meta-poll (map, mode) balancing algorithm.
 *
 * ─── Sprint F model (probabilistic weighted sampling) ──────────────
 *
 * Problem the old model (target + ratio) couldn't solve:
 *
 *   Pro battle supply is wildly asymmetric across live maps — a
 *   competitive favourite like Sneaky Fields sees 15-20× the pro
 *   battles of a niche map like Sunny Soccer within the same day.
 *   The old algorithm used a hard target `max(FLOOR, RATIO × max)`
 *   and gated acceptance binary: once a map cleared the target,
 *   it was dropped from the under-target set. Two failure modes:
 *
 *     (a) On modes with enormous spread, `RATIO × max` becomes
 *         unreachable for the sparsest maps — the popular maps
 *         keep pushing the target upward faster than the scarce
 *         ones can catch up, producing a runaway gap.
 *     (b) Binary gating means we STOP collecting from popular
 *         maps the moment they clear target — contradicting the
 *         product goal of "never stop collecting data from any
 *         live map, just balance the growth rates".
 *
 * New model (this file):
 *
 *   No target. No floor. No ceiling. Every incoming battle whose
 *   (map, mode) is in the live rotation gets a per-battle accept
 *   probability equal to
 *
 *       p = min(1, (minLive + 1) / (currentCount + 1))
 *
 *   where `minLive` is the count of the least-sampled live pair
 *   at the moment the player is processed. The `+1` on both sides
 *   (Laplacian smoothing) keeps the formula well-defined when a
 *   new rotation enters with count=0.
 *
 *   Properties:
 *
 *     • Every live map ALWAYS has a non-zero accept rate. Popular
 *       maps are attenuated proportionally — they never drop out.
 *     • The least-sampled live map has rate = 1.0 (accept all).
 *     • As the gap closes (minLive rises), the popular maps'
 *       attenuation relaxes — convergence is monotonic and
 *       self-terminating: once everything is within ε of parity,
 *       rates collapse to ~1 and the system stops filtering.
 *     • No tunable constants. No floor, no ratio, no cap.
 *     • The sampler uses an injectable PRNG so tests can pin a
 *       seed for reproducibility; production uses `Math.random`.
 *
 *   What is NOT accepted is simply not written — it is not a
 *   delete and it is not a missed duplicate. The player cursor
 *   still advances to the max battle_time of the processed
 *   battlelog so the algorithm never re-fetches the same battle
 *   across runs. A rejected battle of an oversampled map is a
 *   conscious choice to skip capture in favour of budget for
 *   under-sampled maps — not a data loss from the DB.
 *
 * Out-of-band side features still live here:
 *
 *   • `findMapModeStragglers` — detects `(map, mode)` rows that
 *     the live rotation knows under a different canonical mode
 *     (e.g. Hyperspace under brawlBall when it's actually
 *     brawlHockey). The cleanup RPC merges them. Pure function;
 *     effects live in the cron route.
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
 * Find the count of the least-sampled live `(map, mode)` pair. A
 * live pair that isn't in `counts` is implicitly 0 (brand-new
 * rotation on its first run). Empty `liveKeys` returns 0.
 */
export function computeMinLive(
  counts: MapModeCounts,
  liveKeys: Set<string>,
): number {
  if (liveKeys.size === 0) return 0
  let min = Infinity
  for (const key of liveKeys) {
    const c = counts[key] ?? 0
    if (c < min) min = c
  }
  return min === Infinity ? 0 : min
}

/**
 * Probability of accepting a single incoming battle whose
 * (map, mode) pair currently has `currentCount` recorded battles,
 * given that the least-sampled live pair has `minLiveCount`.
 *
 * Formula: `min(1, (minLive + 1) / (currentCount + 1))`.
 *
 * The `+1` smoothing (Laplace) avoids a 0/0 edge when a brand-new
 * rotation enters at 0: without smoothing, `rate = 0 / currentCount
 * = 0` would mean nothing gets accepted and the new map could never
 * climb off zero. With smoothing, `(0+1)/(0+1) = 1` for the new
 * map itself and `(0+1)/(N+1)` for anything else — small but
 * non-zero, which is what we want ("keep attenuating the popular
 * ones, let the newcomer absorb all its own supply").
 *
 * Monotonic in both arguments: rate is non-decreasing in minLive
 * and non-increasing in currentCount, so as the algorithm closes
 * the gap, all rates rise toward 1.
 */
export function computeAcceptRate(
  currentCount: number,
  minLiveCount: number,
): number {
  const num = Math.max(0, minLiveCount) + 1
  const den = Math.max(0, currentCount) + 1
  const rate = num / den
  return rate >= 1 ? 1 : rate
}

/** A pseudo-random generator returning a float in `[0, 1)`. */
export type RandomFn = () => number

/**
 * Deterministic seeded PRNG (xorshift32). Use for tests only —
 * production should use `Math.random`. Seed 0 is coerced to 1
 * because xorshift with an all-zero state stays at zero.
 */
export function createSeededRng(seed: number): RandomFn {
  let state = seed >>> 0
  if (state === 0) state = 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0x100000000
  }
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
    // decay out of the rolling window naturally, and we can't determine
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
