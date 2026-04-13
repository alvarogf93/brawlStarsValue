import {
  GEM_COSTS,
  PER_BRAWLER_MAX,
  CURRENT_MAX_BUFFIES,
  POWER_LEVEL_GEM_COST,
} from './constants'

/**
 * Denominators for the stats page completion charts. All values are
 * game-wide maxes assuming every brawler is maxed out.
 *
 * Power levels: each brawler at power 11 costs POWER_LEVEL_GEM_COST[11]
 * gems → per-brawler gem budget.
 *
 * Gadgets / Star Powers: Supercell's /brawlers endpoint tells us how
 * many slots each brawler has → we take that sum directly from the
 * registry (not all brawlers have 2 SPs — some legacy ones have 1).
 *
 * Gears: 6 slots per brawler × brawlerCount (constant, not in API).
 * Hypercharges: 1 per brawler × brawlerCount once released.
 * Buffies: a game-wide constant that grows as Supercell releases more
 * (see CURRENT_MAX_BUFFIES in constants.ts).
 */
export interface MaxGems {
  powerLevels: number
  gadgets: number
  starPowers: number
  hypercharges: number
  buffies: number
  gears: number
  /** Sum of all categories — the denominator for the main gem-score donut */
  total: number
}

export interface MaxCounts {
  brawlers: number
  gadgets: number
  starPowers: number
  hypercharges: number
  buffies: number
  gears: number
}

export interface RegistryInput {
  brawlerCount: number
  maxGadgets: number
  maxStarPowers: number
}

/**
 * Compute per-category MAX gem spend for a 100%-complete account.
 * Numerator (player's actual spend) is measured separately in
 * calculate.ts — this function only produces the denominators.
 */
export function computeMaxGems(registry: RegistryInput): MaxGems {
  const { brawlerCount, maxGadgets, maxStarPowers } = registry

  // Power levels: POWER_LEVEL_GEM_COST[11] = total gem cost to take
  // a brawler from 1 → 11. Multiplied by the full roster.
  const powerLevels = (POWER_LEVEL_GEM_COST[11] ?? 0) * brawlerCount

  const gadgets = maxGadgets * GEM_COSTS.gadget
  const starPowers = maxStarPowers * GEM_COSTS.starPower
  const hypercharges = brawlerCount * PER_BRAWLER_MAX.hypercharges * GEM_COSTS.hypercharge
  const gears = brawlerCount * PER_BRAWLER_MAX.gears * GEM_COSTS.gear
  const buffies = CURRENT_MAX_BUFFIES * GEM_COSTS.buffie

  const total = powerLevels + gadgets + starPowers + hypercharges + buffies + gears

  return { powerLevels, gadgets, starPowers, hypercharges, buffies, gears, total }
}

/** Same idea but for raw unlock counts (not gem-weighted). */
export function computeMaxCounts(registry: RegistryInput): MaxCounts {
  return {
    brawlers: registry.brawlerCount,
    gadgets: registry.maxGadgets,
    starPowers: registry.maxStarPowers,
    hypercharges: registry.brawlerCount * PER_BRAWLER_MAX.hypercharges,
    buffies: CURRENT_MAX_BUFFIES,
    gears: registry.brawlerCount * PER_BRAWLER_MAX.gears,
  }
}

/**
 * Percentage of completion for a numerator / denominator pair.
 * Clamped to [0, 100] and floored so the UI never shows a partial
 * or over-100 value from rounding.
 *
 * **NaN / undefined safety**: every comparison with NaN is `false`
 * in JavaScript, so naive clamps like `if (x > 100) return 100` do
 * NOT catch NaN — the value falls through and ends up as "NaN%" in
 * the DOM. We explicitly guard the inputs and the computed `raw`
 * value using `Number.isFinite`. Same class of bug as the "NaNm"
 * countdown badge fix in `parseSupercellTime`.
 */
export function completionPct(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0
  if (denominator <= 0) return 0
  const raw = (numerator / denominator) * 100
  if (!Number.isFinite(raw) || raw <= 0) return 0
  if (raw >= 100) return 100
  return Math.floor(raw)
}

/**
 * Format a (potentially undefined / NaN) number as a localized string.
 * Used by the stats page so cached payloads from older versions of the
 * GemScore type don't render "NaN" or crash on `.toLocaleString()`.
 * Returns "0" for any non-finite input.
 */
export function safeNumber(value: number | undefined | null): number {
  if (value === undefined || value === null) return 0
  if (!Number.isFinite(value)) return 0
  return value
}
