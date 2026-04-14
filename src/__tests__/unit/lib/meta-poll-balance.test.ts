import { describe, it, expect } from 'vitest'
import {
  computeAcceptRate,
  computeMinLive,
  createSeededRng,
  findMapModeStragglers,
  mapModeKey,
  type MapModeCounts,
} from '@/lib/draft/meta-poll-balance'

describe('mapModeKey', () => {
  it('formats the key as "map|mode"', () => {
    expect(mapModeKey('Sneaky Fields', 'brawlBall')).toBe('Sneaky Fields|brawlBall')
    expect(mapModeKey('Hyperspace', 'brawlHockey')).toBe('Hyperspace|brawlHockey')
  })
})

describe('computeMinLive — lower bound over the live rotation', () => {
  it('returns 0 when liveKeys is empty', () => {
    expect(computeMinLive({}, new Set())).toBe(0)
  })

  it('returns 0 when a live key is missing from counts (treated as zero)', () => {
    const counts: MapModeCounts = { 'Sneaky Fields|brawlBall': 1500 }
    const live = new Set(['Sneaky Fields|brawlBall', 'Hyperspace|brawlHockey'])
    // Hyperspace is implicitly 0 → minLive = 0
    expect(computeMinLive(counts, live)).toBe(0)
  })

  it('ignores non-live keys even when they are smaller than every live one', () => {
    // Out-of-rotation map with a tiny count must NOT pull minLive down.
    const counts: MapModeCounts = {
      'Expired Map|brawlBall': 3,       // NOT live — ignore
      'Sneaky Fields|brawlBall': 1500,
      'Sunny Soccer|brawlBall': 83,
    }
    const live = new Set(['Sneaky Fields|brawlBall', 'Sunny Soccer|brawlBall'])
    expect(computeMinLive(counts, live)).toBe(83)
  })

  it('returns the min when all live keys are populated', () => {
    const counts: MapModeCounts = {
      'Sneaky Fields|brawlBall': 1500,
      'Sunny Soccer|brawlBall': 83,
      'Crab Claws|knockout': 400,
    }
    const live = new Set(Object.keys(counts))
    expect(computeMinLive(counts, live)).toBe(83)
  })
})

describe('computeAcceptRate — probabilistic sampler formula', () => {
  it('returns 1 when current ≤ minLive (the sparsest is always fully accepted)', () => {
    // (minLive + 1) / (current + 1) = 84/84 = 1
    expect(computeAcceptRate(83, 83)).toBe(1)
    // (minLive + 1) / (current + 1) = 84/51 > 1 → clamped
    expect(computeAcceptRate(50, 83)).toBe(1)
  })

  it('attenuates proportionally to inverse oversupply', () => {
    // current = 10 × minLive → rate ≈ 0.1
    // (83+1)/(830+1) = 84/831 ≈ 0.1011
    const rate = computeAcceptRate(830, 83)
    expect(rate).toBeGreaterThan(0.10)
    expect(rate).toBeLessThan(0.11)
  })

  it('never returns exactly 0 — even an extremely oversampled map gets some chance', () => {
    // Sneaky Fields at 1500 vs minLive = 1 → (2)/(1501) ≈ 0.0013
    const rate = computeAcceptRate(1500, 1)
    expect(rate).toBeGreaterThan(0)
    expect(rate).toBeLessThan(0.01)
  })

  it('handles minLive = 0 (new rotation) via Laplacian smoothing', () => {
    // current = 0, minLive = 0 → (1)/(1) = 1 (new map accepts itself fully)
    expect(computeAcceptRate(0, 0)).toBe(1)
    // current = 100, minLive = 0 → (1)/(101) ≈ 0.0099 (attenuated but non-zero)
    const rate = computeAcceptRate(100, 0)
    expect(rate).toBeGreaterThan(0)
    expect(rate).toBeLessThan(0.01)
  })

  it('clamps negative inputs to zero (defensive against bad counts)', () => {
    // A count of -5 should behave like 0 — no NaN, no negative probability.
    const rate = computeAcceptRate(-5, 10)
    expect(rate).toBe(1) // (11)/(1) = 11 → clamped to 1
  })

  it('is monotonic in both arguments', () => {
    // As current rises, rate should only go down (or stay equal).
    let prev = computeAcceptRate(10, 50)
    for (const c of [20, 50, 100, 500, 1000]) {
      const next = computeAcceptRate(c, 50)
      expect(next).toBeLessThanOrEqual(prev)
      prev = next
    }
    // As minLive rises, rate should only go up (or stay equal).
    prev = computeAcceptRate(1000, 10)
    for (const m of [20, 50, 100, 500, 1000]) {
      const next = computeAcceptRate(1000, m)
      expect(next).toBeGreaterThanOrEqual(prev)
      prev = next
    }
  })
})

describe('createSeededRng — deterministic PRNG for tests', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createSeededRng(42)
    const b = createSeededRng(42)
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b())
    }
  })

  it('produces different sequences for different seeds', () => {
    const a = createSeededRng(1)
    const b = createSeededRng(2)
    const aSeq = Array.from({ length: 5 }, () => a())
    const bSeq = Array.from({ length: 5 }, () => b())
    expect(aSeq).not.toEqual(bSeq)
  })

  it('returns values strictly in [0, 1)', () => {
    const rng = createSeededRng(12345)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('coerces seed 0 to a non-zero state (otherwise xorshift degenerates)', () => {
    const rng = createSeededRng(0)
    const first = rng()
    expect(first).toBeGreaterThan(0)
    // Subsequent draws should also be varied, not all zero.
    const next = rng()
    expect(next).not.toBe(first)
  })
})

describe('sampler convergence — simulated run with fixed seed', () => {
  it('closes the gap between a popular and a scarce map over many trials', () => {
    // Simulation: start with 1500/83 (Sneaky Fields / Sunny Soccer),
    // draw 10,000 incoming battles where 85% are Sneaky Fields and 15%
    // are Sunny Soccer (realistic supply ratio). Apply the sampler and
    // track how the counts evolve. Expectation: the gap ratio should
    // close meaningfully — NOT because Sneaky Fields loses data from
    // the DB, but because the sampler stops accepting most of its
    // inbound and the budget flows to Sunny Soccer instead.
    const counts: MapModeCounts = {
      'Sneaky Fields|brawlBall': 1500,
      'Sunny Soccer|brawlBall': 83,
    }
    const liveKeys = new Set(Object.keys(counts))
    const rng = createSeededRng(1337)

    for (let i = 0; i < 10000; i++) {
      const key = rng() < 0.85 ? 'Sneaky Fields|brawlBall' : 'Sunny Soccer|brawlBall'
      const minLive = computeMinLive(counts, liveKeys)
      const current = counts[key]
      const rate = computeAcceptRate(current, minLive)
      if (rng() < rate) {
        counts[key] += 1
      }
    }

    // The initial ratio was 1500/83 ≈ 18.07. After 10k weighted trials
    // with the sampler, the ratio should be meaningfully smaller.
    const finalRatio = counts['Sneaky Fields|brawlBall'] / counts['Sunny Soccer|brawlBall']
    const initialRatio = 1500 / 83
    expect(finalRatio).toBeLessThan(initialRatio)

    // Sunny Soccer grows (the scarce one receives disproportionate
    // acceptance) while Sneaky Fields barely moves — but NEITHER
    // decreases. No data loss in the container.
    expect(counts['Sunny Soccer|brawlBall']).toBeGreaterThan(83)
    expect(counts['Sneaky Fields|brawlBall']).toBeGreaterThanOrEqual(1500)
  })

  it('accepts brand-new zero-count rotations at a high rate on their first exposure', () => {
    // Hyperspace enters rotation fresh at 0. Other maps are at 100-500.
    // The Laplacian smoothing makes the new map's rate = 1 while it's
    // at 0, so every single incoming Hyperspace battle gets accepted.
    const counts: MapModeCounts = {
      'Sneaky Fields|brawlBall': 500,
      'Sunny Soccer|brawlBall': 100,
      'Hyperspace|brawlHockey': 0,
    }
    const liveKeys = new Set(Object.keys(counts))
    const rng = createSeededRng(2026)

    let hyperspaceAccepted = 0
    for (let i = 0; i < 50; i++) {
      const minLive = computeMinLive(counts, liveKeys)
      const current = counts['Hyperspace|brawlHockey']
      const rate = computeAcceptRate(current, minLive)
      if (rng() < rate) {
        counts['Hyperspace|brawlHockey'] += 1
        hyperspaceAccepted++
      }
    }
    // With minLive=0 and current starting at 0, rate = 1 for the first
    // battle. As current grows, the rate decays slowly because minLive
    // is still 0 — but we should accept most of the first batch.
    expect(hyperspaceAccepted).toBeGreaterThan(20)
  })
})

describe('findMapModeStragglers — self-healing mis-classification detector', () => {
  it('returns empty when every map in counts is under its canonical mode', () => {
    const counts: MapModeCounts = {
      'Sunny Soccer|brawlBall': 400,
      'Tip Toe|brawlHockey': 300,
      'Picturesque|gemGrab': 200,
    }
    const liveKeys = new Set(Object.keys(counts))
    expect(findMapModeStragglers(counts, liveKeys)).toEqual([])
  })

  it('flags a map that has rows in a wrong mode while being live under a different canonical mode', () => {
    // The exact Hyperspace pattern: rows under brawlBall while the
    // live rotation has Hyperspace under brawlHockey.
    const counts: MapModeCounts = {
      'Hyperspace|brawlBall': 596,    // mis-classified
      'Hyperspace|brawlHockey': 5,    // new correct rows
    }
    const liveKeys = new Set(['Hyperspace|brawlHockey'])
    const stragglers = findMapModeStragglers(counts, liveKeys)
    expect(stragglers).toHaveLength(1)
    expect(stragglers[0]).toEqual({
      map: 'Hyperspace',
      wrongMode: 'brawlBall',
      canonicalMode: 'brawlHockey',
    })
  })

  it('IGNORES maps whose rows are NOT currently in the live rotation (can\'t determine canonical)', () => {
    // Historical Sneaky Fields data under brawlBall — Sneaky Fields is
    // NOT currently live (rotated out), so we don't know if it should
    // stay brawlBall (true) or be hockey (false). Leave it alone; the
    // rolling decay will handle it.
    const counts: MapModeCounts = {
      'Sneaky Fields|brawlBall': 8672,
      'Tip Toe|brawlHockey': 5,
    }
    const liveKeys = new Set(['Tip Toe|brawlHockey']) // Sneaky Fields not live
    const stragglers = findMapModeStragglers(counts, liveKeys)
    expect(stragglers).toEqual([])
  })

  it('flags multiple maps independently in a single call', () => {
    // Two maps mis-classified simultaneously — both hockey, both live.
    const counts: MapModeCounts = {
      'Hyperspace|brawlBall': 596,
      'Tip Toe|brawlBall': 291,
      'Sunny Soccer|brawlBall': 400, // correctly brawlBall (live under brawlBall)
    }
    const liveKeys = new Set([
      'Hyperspace|brawlHockey',
      'Tip Toe|brawlHockey',
      'Sunny Soccer|brawlBall',
    ])
    const stragglers = findMapModeStragglers(counts, liveKeys)
    expect(stragglers).toHaveLength(2)
    const maps = stragglers.map(s => s.map).sort()
    expect(maps).toEqual(['Hyperspace', 'Tip Toe'])
    for (const s of stragglers) {
      expect(s.wrongMode).toBe('brawlBall')
      expect(s.canonicalMode).toBe('brawlHockey')
    }
  })

  it('does not flag a (map, mode) key with zero count — nothing to clean', () => {
    const counts: MapModeCounts = {
      'Hyperspace|brawlBall': 0,       // empty, shouldn't be flagged
      'Hyperspace|brawlHockey': 100,
    }
    const liveKeys = new Set(['Hyperspace|brawlHockey'])
    const stragglers = findMapModeStragglers(counts, liveKeys)
    expect(stragglers).toEqual([])
  })

  it('handles map names containing the pipe separator gracefully (split uses FIRST pipe)', () => {
    // Defensive: if a map name ever had a literal "|" in it, the split
    // on indexOf('|') takes the first pipe so map = everything before,
    // mode = everything after. Brawl Stars doesn't use pipes in map
    // names, but this guards against future Supercell weirdness.
    const counts: MapModeCounts = {
      'Weird|Name|brawlBall': 50,
    }
    const liveKeys = new Set(['Weird|Name|brawlHockey'])
    const stragglers = findMapModeStragglers(counts, liveKeys)
    // split at first pipe: map='Weird', mode='Name|brawlBall'
    // canonicalByMap.get('Weird') === 'Name|brawlHockey'
    // mode !== canonical → flagged
    expect(stragglers).toHaveLength(1)
    expect(stragglers[0].map).toBe('Weird')
  })
})
