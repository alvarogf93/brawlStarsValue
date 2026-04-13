import { describe, it, expect } from 'vitest'
import {
  computeModeTarget,
  findUnderTargetModes,
  type ModeCounts,
} from '@/lib/draft/meta-poll-balance'
import { DRAFT_MODES } from '@/lib/draft/constants'

describe('computeModeTarget — adaptive top-up target', () => {
  it('returns the min-target floor when all counts are zero', () => {
    const counts: ModeCounts = {}
    // 0.6 * 0 = 0 → min-target wins
    expect(computeModeTarget(counts, 0.6, 50)).toBe(50)
  })

  it('returns ratio * max when max * ratio exceeds the min-target', () => {
    const counts: ModeCounts = { brawlBall: 300, gemGrab: 100 }
    // max=300, target = 300 * 0.6 = 180
    expect(computeModeTarget(counts, 0.6, 50)).toBe(180)
  })

  it('returns the min-target when max * ratio is below the floor', () => {
    const counts: ModeCounts = { brawlBall: 60, gemGrab: 40 }
    // max=60, target = 60 * 0.6 = 36 → below floor 50 → floor wins
    expect(computeModeTarget(counts, 0.6, 50)).toBe(50)
  })

  it('only considers DRAFT_MODES when finding the max', () => {
    const counts: ModeCounts = {
      brawlBall: 100,
      duoShowdown: 9999,  // not a draft mode — must be ignored
    }
    // max from draft-only = 100, target = 60
    expect(computeModeTarget(counts, 0.6, 50)).toBe(60)
  })

  it('handles the realistic Sprint D Sneaky Fields scenario', () => {
    // User's complaint scenario: flagship modes ~200, niche modes ~30
    const counts: ModeCounts = {
      brawlBall: 200,
      gemGrab: 180,
      knockout: 170,
      bounty: 150,
      heist: 140,
      hotZone: 90,
      wipeout: 45,
      brawlHockey: 30,
      basketBrawl: 25,
    }
    // target = 200 * 0.6 = 120 — pushes niche modes to catch up
    expect(computeModeTarget(counts, 0.6, 50)).toBe(120)
  })

  it('uses the default ratio and min-target when not specified', () => {
    const counts: ModeCounts = { brawlBall: 200 }
    // Defaults: ratio=0.6, minTarget=50 → 120
    expect(computeModeTarget(counts)).toBe(120)
  })
})

describe('findUnderTargetModes — set of modes that need more data', () => {
  it('returns all draft modes when counts are empty', () => {
    const under = findUnderTargetModes({}, 50)
    expect(under.size).toBe(DRAFT_MODES.length)
    for (const mode of DRAFT_MODES) {
      expect(under.has(mode)).toBe(true)
    }
  })

  it('returns an empty set when every mode is at or above target', () => {
    const counts: ModeCounts = {}
    for (const mode of DRAFT_MODES) counts[mode] = 200
    const under = findUnderTargetModes(counts, 150)
    expect(under.size).toBe(0)
  })

  it('returns only the modes strictly below target (equal does not count as under)', () => {
    const counts: ModeCounts = {
      brawlBall: 200,   // above
      gemGrab: 120,     // at target (equal → NOT under)
      basketBrawl: 119, // strictly below
    }
    const under = findUnderTargetModes(counts, 120)
    expect(under.has('basketBrawl')).toBe(true)
    expect(under.has('gemGrab')).toBe(false)
    expect(under.has('brawlBall')).toBe(false)
    // All other draft modes default to 0 → under target
    expect(under.size).toBe(DRAFT_MODES.length - 2) // all except brawlBall and gemGrab
  })

  it('correctly identifies the Sneaky Fields scenario under-target set', () => {
    const counts: ModeCounts = {
      brawlBall: 200, gemGrab: 180, knockout: 170, bounty: 150,
      heist: 140, hotZone: 90, wipeout: 45, brawlHockey: 30, basketBrawl: 25,
    }
    const target = computeModeTarget(counts, 0.6, 50) // 120
    const under = findUnderTargetModes(counts, target)
    // Modes below 120: hotZone(90), wipeout(45), brawlHockey(30), basketBrawl(25)
    expect(under.has('hotZone')).toBe(true)
    expect(under.has('wipeout')).toBe(true)
    expect(under.has('brawlHockey')).toBe(true)
    expect(under.has('basketBrawl')).toBe(true)
    // Modes ≥120 stay out
    expect(under.has('brawlBall')).toBe(false)
    expect(under.has('gemGrab')).toBe(false)
    expect(under.has('knockout')).toBe(false)
    expect(under.has('bounty')).toBe(false)
    expect(under.has('heist')).toBe(false)
  })
})
