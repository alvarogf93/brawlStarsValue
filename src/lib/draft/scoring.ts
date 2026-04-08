import { BAYESIAN_STRENGTH } from './constants'
import type { MetaStat, MetaMatchup } from './types'

/**
 * Bayesian-adjusted win rate.
 * Shrinks small samples towards 50% to prevent noise from dominating rankings.
 *
 * With α=30: bayesianWR(3, 3) ≈ 54.5% instead of 100%
 *            bayesianWR(100, 150) ≈ 63.9% (close to raw 66.7%)
 */
export function bayesianWinRate(wins: number, total: number, prior = 0.5, strength = BAYESIAN_STRENGTH): number {
  if (total === 0) return prior * 100
  return ((wins + strength * prior) / (total + strength)) * 100
}

export interface RecommendationInput {
  meta: MetaStat[]
  matchups: MetaMatchup[]
  blueTeam: number[]
  redTeam: number[]
  pickedIds: Set<number>
  personal?: MetaStat[]
}

export interface Recommendation {
  brawlerId: number
  finalScore: number
  metaScore: number
  counterScore: number
  personalScore: number
}

/**
 * Compute ranked recommendations for the next pick.
 * All computation is done in-memory — no API calls.
 */
export function computeRecommendations(input: RecommendationInput): Recommendation[] {
  const { meta, matchups, blueTeam, redTeam, pickedIds, personal } = input

  // Build lookup maps for O(1) access
  const matchupMap = new Map<string, { wins: number; total: number }>()
  for (const m of matchups) {
    matchupMap.set(`${m.brawlerId}-${m.opponentId}`, { wins: m.wins, total: m.total })
  }

  const personalMap = new Map<number, MetaStat>()
  if (personal) {
    for (const p of personal) {
      personalMap.set(p.brawlerId, p)
    }
  }

  const hasEnemies = redTeam.length > 0
  const hasPersonal = personalMap.size > 0

  const recommendations: Recommendation[] = []

  for (const stat of meta) {
    // Skip already picked brawlers
    if (pickedIds.has(stat.brawlerId)) continue

    // 1. Meta score (bayesian win rate on this map)
    const metaScore = bayesianWinRate(stat.wins, stat.total)

    // 2. Counter score (average matchup WR vs known enemies)
    let counterScore = 0
    if (hasEnemies) {
      let counterSum = 0
      let counterCount = 0
      for (const enemyId of redTeam) {
        const key = `${stat.brawlerId}-${enemyId}`
        const matchup = matchupMap.get(key)
        if (matchup && matchup.total > 0) {
          counterSum += bayesianWinRate(matchup.wins, matchup.total)
          counterCount++
        }
      }
      if (counterCount > 0) {
        counterScore = counterSum / counterCount
      }
    }

    // 3. Personal score (user's own history)
    let personalScore = 0
    const pStat = personalMap.get(stat.brawlerId)
    if (pStat && pStat.total >= 3) {
      personalScore = bayesianWinRate(pStat.wins, pStat.total)
    }

    // 4. Compute weighted final score
    let wMeta = 0.5
    let wCounter = 0.0
    let wPersonal = 0.0

    if (hasEnemies) {
      wMeta = 0.25
      wCounter = 0.5
    }

    if (hasPersonal && personalScore > 0) {
      wPersonal = 0.2
      wMeta -= 0.1
      if (hasEnemies) wCounter -= 0.1
    }

    // Normalize weights to sum to 1
    const wSum = wMeta + wCounter + wPersonal
    const finalScore = wSum > 0
      ? (wMeta / wSum * metaScore) + (wCounter / wSum * counterScore) + (wPersonal / wSum * personalScore)
      : metaScore

    recommendations.push({
      brawlerId: stat.brawlerId,
      finalScore,
      metaScore,
      counterScore,
      personalScore,
    })
  }

  // Sort by final score descending
  recommendations.sort((a, b) => b.finalScore - a.finalScore)

  return recommendations
}
