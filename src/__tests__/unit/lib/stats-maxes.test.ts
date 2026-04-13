import { describe, it, expect } from 'vitest'
import {
  computeMaxGems,
  computeMaxCounts,
  completionPct,
  safeNumber,
} from '@/lib/stats-maxes'
import {
  GEM_COSTS,
  PER_BRAWLER_MAX,
  CURRENT_MAX_BUFFIES,
  POWER_LEVEL_GEM_COST,
} from '@/lib/constants'

describe('computeMaxGems — gem denominators for stats completion', () => {
  it('computes per-category maxes from a realistic registry (101 brawlers)', () => {
    const registry = { brawlerCount: 101, maxGadgets: 202, maxStarPowers: 202 }
    const max = computeMaxGems(registry)

    // Power levels: 101 × 1151 gems per maxed brawler = 116_251
    expect(max.powerLevels).toBe(101 * POWER_LEVEL_GEM_COST[11])
    // Gadgets: 202 × 100 gems = 20_200
    expect(max.gadgets).toBe(202 * GEM_COSTS.gadget)
    // Star powers: 202 × 200 gems = 40_400
    expect(max.starPowers).toBe(202 * GEM_COSTS.starPower)
    // Hypercharges: 101 × 1 × 500 = 50_500
    expect(max.hypercharges).toBe(101 * PER_BRAWLER_MAX.hypercharges * GEM_COSTS.hypercharge)
    // Gears: 101 × 6 × 100 = 60_600
    expect(max.gears).toBe(101 * PER_BRAWLER_MAX.gears * GEM_COSTS.gear)
    // Buffies: 36 × 300 = 10_800 (game-wide current max)
    expect(max.buffies).toBe(CURRENT_MAX_BUFFIES * GEM_COSTS.buffie)

    // Total is the sum of the six
    const expectedTotal =
      max.powerLevels + max.gadgets + max.starPowers +
      max.hypercharges + max.buffies + max.gears
    expect(max.total).toBe(expectedTotal)
  })

  it('scales linearly when the brawler count grows', () => {
    const small = computeMaxGems({ brawlerCount: 50, maxGadgets: 100, maxStarPowers: 100 })
    const big = computeMaxGems({ brawlerCount: 100, maxGadgets: 200, maxStarPowers: 200 })

    // Power levels, hypercharges, gears and gadgets/SPs are all proportional
    expect(big.powerLevels).toBe(small.powerLevels * 2)
    expect(big.gadgets).toBe(small.gadgets * 2)
    expect(big.starPowers).toBe(small.starPowers * 2)
    expect(big.hypercharges).toBe(small.hypercharges * 2)
    expect(big.gears).toBe(small.gears * 2)
    // Buffies are a flat constant and DO NOT scale with registry size
    expect(big.buffies).toBe(small.buffies)
  })

  it('handles a zero-brawler registry without divide-by-zero', () => {
    const max = computeMaxGems({ brawlerCount: 0, maxGadgets: 0, maxStarPowers: 0 })
    expect(max.powerLevels).toBe(0)
    expect(max.gadgets).toBe(0)
    expect(max.starPowers).toBe(0)
    expect(max.hypercharges).toBe(0)
    expect(max.gears).toBe(0)
    // Buffies are a flat constant independent of brawler count
    expect(max.buffies).toBe(CURRENT_MAX_BUFFIES * GEM_COSTS.buffie)
    expect(max.total).toBe(max.buffies)
  })
})

describe('computeMaxCounts — raw unlock-count denominators', () => {
  it('mirrors computeMaxGems categories at count granularity', () => {
    const counts = computeMaxCounts({ brawlerCount: 101, maxGadgets: 202, maxStarPowers: 202 })
    expect(counts.brawlers).toBe(101)
    expect(counts.gadgets).toBe(202)
    expect(counts.starPowers).toBe(202)
    expect(counts.hypercharges).toBe(101)
    expect(counts.gears).toBe(101 * 6)
    expect(counts.buffies).toBe(CURRENT_MAX_BUFFIES)
  })
})

describe('completionPct — safe percentage helper', () => {
  it('returns 0 when denominator is 0', () => {
    expect(completionPct(100, 0)).toBe(0)
  })

  it('returns 0 when numerator is 0', () => {
    expect(completionPct(0, 100)).toBe(0)
  })

  it('floors fractional values (no partial percentages in the UI)', () => {
    expect(completionPct(33, 100)).toBe(33)
    expect(completionPct(1, 3)).toBe(33) // 33.33% → 33
  })

  it('clamps to 100 when numerator exceeds denominator', () => {
    expect(completionPct(150, 100)).toBe(100)
  })

  it('clamps to 0 for negative numerators (defensive)', () => {
    expect(completionPct(-10, 100)).toBe(0)
  })

  it('returns 100 exactly when numerator equals denominator', () => {
    expect(completionPct(100, 100)).toBe(100)
  })

  // ── NaN / undefined safety (regression for the "NaN in calculations" bug)

  it('returns 0 for NaN numerator', () => {
    expect(completionPct(NaN, 100)).toBe(0)
  })

  it('returns 0 for NaN denominator', () => {
    expect(completionPct(50, NaN)).toBe(0)
  })

  it('returns 0 for undefined inputs (cast through any)', () => {
    expect(completionPct(undefined as unknown as number, 100)).toBe(0)
    expect(completionPct(50, undefined as unknown as number)).toBe(0)
  })

  it('returns 0 when both inputs are NaN', () => {
    expect(completionPct(NaN, NaN)).toBe(0)
  })

  it('returns 0 for Infinity inputs', () => {
    expect(completionPct(Infinity, 100)).toBe(0)
    expect(completionPct(50, Infinity)).toBe(0)
  })
})

describe('safeNumber — NaN/undefined-safe number coercion', () => {
  it('passes through finite numbers unchanged', () => {
    expect(safeNumber(0)).toBe(0)
    expect(safeNumber(42)).toBe(42)
    expect(safeNumber(-5)).toBe(-5)
    expect(safeNumber(3.14)).toBe(3.14)
  })

  it('returns 0 for NaN', () => {
    expect(safeNumber(NaN)).toBe(0)
  })

  it('returns 0 for undefined and null', () => {
    expect(safeNumber(undefined)).toBe(0)
    expect(safeNumber(null)).toBe(0)
  })

  it('returns 0 for Infinity', () => {
    expect(safeNumber(Infinity)).toBe(0)
    expect(safeNumber(-Infinity)).toBe(0)
  })
})
