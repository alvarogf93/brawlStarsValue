import { describe, it, expect } from 'vitest'
import {
  computeMapModeTarget,
  findUnderTargetMapModes,
  mapModeKey,
  type MapModeCounts,
} from '@/lib/draft/meta-poll-balance'

describe('mapModeKey', () => {
  it('formats the key as "map|mode"', () => {
    expect(mapModeKey('Sneaky Fields', 'brawlBall')).toBe('Sneaky Fields|brawlBall')
    expect(mapModeKey('Hyperspace', 'brawlHockey')).toBe('Hyperspace|brawlHockey')
  })
})

describe('computeMapModeTarget — cumulative per-(map, mode) balancing', () => {
  it('returns the min-target floor when every live pair is at zero', () => {
    const counts: MapModeCounts = {}
    const live = new Set([
      mapModeKey('Sneaky Fields', 'brawlBall'),
      mapModeKey('Hyperspace', 'brawlHockey'),
    ])
    // 0.6 * 0 = 0 → min-target wins
    expect(computeMapModeTarget(counts, live, 0.6, 50)).toBe(50)
  })

  it('returns ratio * max(live counts) when above the floor', () => {
    const counts: MapModeCounts = {
      'Sneaky Fields|brawlBall': 3000,
      'Hyperspace|brawlHockey': 200,
    }
    const live = new Set([
      'Sneaky Fields|brawlBall',
      'Hyperspace|brawlHockey',
    ])
    // max = 3000, target = 3000 × 0.6 = 1800
    expect(computeMapModeTarget(counts, live, 0.6, 50)).toBe(1800)
  })

  it('IGNORES out-of-rotation pairs when computing the max', () => {
    // Out-of-rotation maps may still have huge historical counts in
    // the 14-day window — they must NOT pull the target upward,
    // because the cron cannot refresh them (pros don't play them).
    const counts: MapModeCounts = {
      'Sneaky Fields|brawlBall': 7000,      // out-of-rotation leftover
      'Crab Claws|knockout': 300,           // currently live
      'Hyperspace|brawlHockey': 50,          // currently live
    }
    const live = new Set([
      'Crab Claws|knockout',
      'Hyperspace|brawlHockey',
    ])
    // max over LIVE only = 300 (not 7000)
    // target = max(50, 300 × 0.6) = 180
    expect(computeMapModeTarget(counts, live, 0.6, 50)).toBe(180)
  })

  it('returns the min-target when max * ratio is below the floor', () => {
    const counts: MapModeCounts = {
      'Sneaky Fields|brawlBall': 60,
      'Hyperspace|brawlHockey': 40,
    }
    const live = new Set([
      'Sneaky Fields|brawlBall',
      'Hyperspace|brawlHockey',
    ])
    // max = 60, target = 60 × 0.6 = 36 → below floor 50 → floor wins
    expect(computeMapModeTarget(counts, live, 0.6, 50)).toBe(50)
  })

  it('treats missing keys as zero', () => {
    const counts: MapModeCounts = {
      'Sneaky Fields|brawlBall': 500,
      // Hyperspace intentionally missing
    }
    const live = new Set([
      'Sneaky Fields|brawlBall',
      'Hyperspace|brawlHockey', // 0
    ])
    // max = 500, target = 300
    expect(computeMapModeTarget(counts, live, 0.6, 50)).toBe(300)
  })

  it('handles the Sprint E realistic scenario', () => {
    // Real production data shape as of 2026-04-14 (before fix):
    // brawlBall dominates, hockey at 0, niche modes way under.
    const counts: MapModeCounts = {
      'Sneaky Fields|brawlBall': 1511,
      'Crab Claws|knockout': 399,
      'Choral Chambers|bounty': 323,
      'Triple-Double|basketBrawl': 266,
      'Tax Evasion|hotZone': 125,
      'Hyperspace|brawlHockey': 0,
    }
    const live = new Set(Object.keys(counts))
    // target = 1511 × 0.6 = 906.6 → floor to 906
    expect(computeMapModeTarget(counts, live, 0.6, 50)).toBe(906)
  })
})

describe('findUnderTargetMapModes — the accept filter', () => {
  it('returns every live key when counts are empty', () => {
    const counts: MapModeCounts = {}
    const live = new Set([
      'Sneaky Fields|brawlBall',
      'Crab Claws|knockout',
      'Hyperspace|brawlHockey',
    ])
    const under = findUnderTargetMapModes(counts, live, 50)
    expect(under.size).toBe(3)
    expect(under).toEqual(live)
  })

  it('returns an empty set when every live pair is at or above target', () => {
    const counts: MapModeCounts = {
      'Sneaky Fields|brawlBall': 200,
      'Crab Claws|knockout': 200,
      'Hyperspace|brawlHockey': 200,
    }
    const live = new Set(Object.keys(counts))
    const under = findUnderTargetMapModes(counts, live, 150)
    expect(under.size).toBe(0)
  })

  it('treats equal-to-target as NOT under (strict less-than)', () => {
    const counts: MapModeCounts = {
      'Sneaky Fields|brawlBall': 200,      // strictly above
      'Crab Claws|knockout': 180,           // equal — NOT under
      'Hyperspace|brawlHockey': 179,        // strictly below
    }
    const live = new Set(Object.keys(counts))
    const under = findUnderTargetMapModes(counts, live, 180)
    expect(under.has('Hyperspace|brawlHockey')).toBe(true)
    expect(under.has('Crab Claws|knockout')).toBe(false)
    expect(under.has('Sneaky Fields|brawlBall')).toBe(false)
  })

  it('NEVER includes a key that is not in liveKeys, even if it is below target', () => {
    const counts: MapModeCounts = {
      'Expired Map|brawlBall': 10,        // NOT live
      'Sneaky Fields|brawlBall': 500,     // live
      'Hyperspace|brawlHockey': 5,        // live, under
    }
    const live = new Set([
      'Sneaky Fields|brawlBall',
      'Hyperspace|brawlHockey',
    ])
    const under = findUnderTargetMapModes(counts, live, 100)
    expect(under.has('Expired Map|brawlBall')).toBe(false)
    expect(under.has('Hyperspace|brawlHockey')).toBe(true)
    expect(under.has('Sneaky Fields|brawlBall')).toBe(false) // over target
    expect(under.size).toBe(1)
  })

  it('correctly identifies the Sprint E under-target set', () => {
    const counts: MapModeCounts = {
      'Sneaky Fields|brawlBall': 1511,
      'Crab Claws|knockout': 399,
      'Choral Chambers|bounty': 323,
      'Triple-Double|basketBrawl': 266,
      'Tax Evasion|hotZone': 125,
      'Hyperspace|brawlHockey': 0,
    }
    const live = new Set(Object.keys(counts))
    const target = computeMapModeTarget(counts, live, 0.6, 50) // 906
    const under = findUnderTargetMapModes(counts, live, target)
    // Under 906: everything except Sneaky Fields
    expect(under.size).toBe(5)
    expect(under.has('Sneaky Fields|brawlBall')).toBe(false)
    expect(under.has('Crab Claws|knockout')).toBe(true)
    expect(under.has('Hyperspace|brawlHockey')).toBe(true)
  })
})
