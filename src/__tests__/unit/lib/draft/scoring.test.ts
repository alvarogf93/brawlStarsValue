import { describe, it, expect } from 'vitest'
import { bayesianWinRate, computeRecommendations } from '@/lib/draft/scoring'
import type { MetaStat, MetaMatchup } from '@/lib/draft/types'

describe('bayesianWinRate', () => {
  it('shrinks small samples towards 50%', () => {
    // 3 wins, 0 losses → should be ~54.5%, not 100%
    const wr = bayesianWinRate(3, 3)
    expect(wr).toBeGreaterThan(50)
    expect(wr).toBeLessThan(60)
  })

  it('large samples converge to raw win rate', () => {
    // 100 wins, 50 losses → raw 66.7%, bayesian ~63.9%
    const wr = bayesianWinRate(100, 150)
    expect(wr).toBeGreaterThan(60)
    expect(wr).toBeLessThan(68)
  })

  it('returns 50% for zero games', () => {
    expect(bayesianWinRate(0, 0)).toBe(50)
  })

  it('returns 50% for balanced small sample', () => {
    const wr = bayesianWinRate(1, 2)
    // With bayesian: (1 + 15) / (2 + 30) = 50%
    expect(wr).toBe(50)
  })
})

describe('computeRecommendations', () => {
  const meta: MetaStat[] = [
    { brawlerId: 1, wins: 60, losses: 40, total: 100 },  // 60% raw
    { brawlerId: 2, wins: 80, losses: 20, total: 100 },  // 80% raw
    { brawlerId: 3, wins: 3, losses: 0, total: 3 },      // 100% raw but tiny sample
  ]

  const matchups: MetaMatchup[] = [
    { brawlerId: 1, opponentId: 10, wins: 7, losses: 3, total: 10 },
    { brawlerId: 2, opponentId: 10, wins: 3, losses: 7, total: 10 },
  ]

  it('returns brawlers sorted by score (highest first)', () => {
    const recs = computeRecommendations({
      meta,
      matchups,
      blueTeam: [],
      redTeam: [],
      pickedIds: new Set(),
    })

    expect(recs.length).toBe(3)
    // Brawler 2 (80% raw) should rank above Brawler 1 (60%)
    expect(recs[0].brawlerId).toBe(2)
    // Brawler 3 (100% raw but 3 games) should rank below due to bayesian
    expect(recs[2].brawlerId).toBe(3)
  })

  it('excludes already-picked brawlers', () => {
    const recs = computeRecommendations({
      meta,
      matchups,
      blueTeam: [],
      redTeam: [],
      pickedIds: new Set([2]),
    })

    expect(recs.find(r => r.brawlerId === 2)).toBeUndefined()
    expect(recs.length).toBe(2)
  })

  it('factors in counter matchups when enemies are known', () => {
    // Brawler 1 is strong vs opponent 10 (70% WR)
    // Brawler 2 is weak vs opponent 10 (30% WR)
    const recs = computeRecommendations({
      meta,
      matchups,
      blueTeam: [],
      redTeam: [10],
      pickedIds: new Set(),
    })

    // With enemy known, brawler 1 should get boosted by good matchup
    // and brawler 2 penalized by bad matchup
    const b1 = recs.find(r => r.brawlerId === 1)!
    const b2 = recs.find(r => r.brawlerId === 2)!
    // b1 has worse meta but much better matchup vs enemy 10
    // The exact ranking depends on weights, but counterScore should matter
    expect(b1.counterScore).toBeGreaterThan(b2.counterScore)
  })

  it('incorporates personal data when provided', () => {
    const personal: MetaStat[] = [
      { brawlerId: 1, wins: 9, losses: 1, total: 10 }, // 90% personal
    ]

    const recs = computeRecommendations({
      meta,
      matchups,
      blueTeam: [],
      redTeam: [],
      pickedIds: new Set(),
      personal,
    })

    const b1 = recs.find(r => r.brawlerId === 1)!
    expect(b1.personalScore).toBeGreaterThan(0)
  })

  it('handles empty meta gracefully', () => {
    const recs = computeRecommendations({
      meta: [],
      matchups: [],
      blueTeam: [],
      redTeam: [],
      pickedIds: new Set(),
    })
    expect(recs).toEqual([])
  })
})
