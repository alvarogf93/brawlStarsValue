import type { Battle } from '@/lib/supabase/types'
import type {
  PlayNowRecommendation, BrawlerRecommendation,
  CounterPickResult, BrawlerMapEntry, MatchupEntry, BrawlerSynergy,
} from './types'
import { MIN_GAMES } from './types'
import { wilsonPct, winRate, compositeKey, groupBy, isWin } from './stats'

interface EventSlot {
  startTime: string
  endTime: string
  event: { id: number; mode: string; map: string }
}

/**
 * Generate "Play Now" recommendations by crossing the current event
 * rotation with the player's historical performance per map/brawler.
 */
export function computePlayNowRecommendations(
  brawlerMapMatrix: BrawlerMapEntry[],
  brawlerSynergy: BrawlerSynergy[],
  events: EventSlot[],
): PlayNowRecommendation[] {
  const results: PlayNowRecommendation[] = []

  for (const slot of events) {
    const map = slot.event.map
    const mode = slot.event.mode

    // Find all brawlers the player has used on this map (or this mode if no map data)
    let candidates = brawlerMapMatrix.filter(e => e.map === map)

    // Fallback: if no map-specific data, use mode data
    if (candidates.length === 0) {
      candidates = brawlerMapMatrix.filter(e => e.mode === mode)
    }

    if (candidates.length === 0) continue

    // Sort by Wilson score (fair ranking accounting for sample size)
    const sorted = [...candidates].sort((a, b) => b.wilsonScore - a.wilsonScore)
    const topBrawlers = sorted.slice(0, 5)

    const recommendations: BrawlerRecommendation[] = topBrawlers.map(c => {
      // Find best teammate brawler for this combination
      const synergies = brawlerSynergy
        .filter(s => s.myBrawlerId === c.brawlerId && s.total >= MIN_GAMES)
        .sort((a, b) => b.wilsonScore - a.wilsonScore)

      const bestTm = synergies[0] ?? null

      return {
        brawlerId: c.brawlerId,
        brawlerName: c.brawlerName,
        winRate: c.winRate,
        gamesPlayed: c.total,
        wilsonScore: c.wilsonScore,
        bestTeammateBrawler: bestTm?.teammateBrawlerName ?? null,
        bestTeammateWR: bestTm ? bestTm.winRate : null,
      }
    })

    results.push({
      map,
      eventId: slot.event.id,
      mode,
      slotEndTime: slot.endTime,
      recommendations,
    })
  }

  return results
}

/**
 * Counter-pick advisor: given a list of opponent brawler names and
 * optionally a map, find the player's best brawler(s) against them.
 *
 * Strategy: for each of the player's brawlers, compute a combined score
 * against the specified opponents weighted by Wilson score.
 */
export function computeCounterPick(
  battles: Battle[],
  opponentBrawlerNames: string[],
  mapFilter?: string,
): CounterPickResult[] {
  const normalizedOpps = opponentBrawlerNames.map(n => n.toUpperCase())

  // Filter battles that include at least one of the specified opponents
  const relevantBattles = battles.filter(b => {
    if (mapFilter && b.map !== mapFilter) return false
    const oppBrawlers = (b.opponents ?? []) as Array<{ brawler: { name: string } }>
    return oppBrawlers.some(o => normalizedOpps.includes(o.brawler.name.toUpperCase()))
  })

  if (relevantBattles.length === 0) return []

  // Group by my brawler
  const grouped = groupBy(relevantBattles, b => b.my_brawler?.id ?? 0)
  const results: CounterPickResult[] = []

  for (const [brawlerId, group] of grouped) {
    if (group.length < MIN_GAMES) continue

    const wins = group.filter(b => isWin(b.result)).length

    // Per-opponent breakdown
    const vsBreakdown = normalizedOpps.map(oppName => {
      const vsMatches = group.filter(b => {
        const opps = (b.opponents ?? []) as Array<{ brawler: { name: string } }>
        return opps.some(o => o.brawler.name.toUpperCase() === oppName)
      })
      const vsWins = vsMatches.filter(b => isWin(b.result)).length
      return {
        opponentName: oppName,
        wins: vsWins,
        total: vsMatches.length,
        winRate: winRate(vsWins, vsMatches.length),
      }
    })

    results.push({
      brawlerId,
      brawlerName: group[0].my_brawler?.name ?? 'Unknown',
      winRate: winRate(wins, group.length),
      gamesPlayed: group.length,
      wilsonScore: wilsonPct(wins, group.length),
      vsBreakdown,
    })
  }

  return results.sort((a, b) => b.wilsonScore - a.wilsonScore)
}

/**
 * Find underused brawlers: high power level but few battles.
 * Requires player brawler data from the profile API.
 */
export interface UnderusedBrawler {
  id: number
  name: string
  power: number
  trophies: number
  battleCount: number
  suggestion: string
}

export function findUnderusedBrawlers(
  playerBrawlers: Array<{ id: number; name: string; power: number; trophies: number }>,
  battleCountByBrawler: Map<number, number>,
  minPower = 9,
  maxBattles = 5,
): UnderusedBrawler[] {
  const results: UnderusedBrawler[] = []

  for (const b of playerBrawlers) {
    if (b.power < minPower) continue
    const count = battleCountByBrawler.get(b.id) ?? 0
    if (count <= maxBattles) {
      results.push({
        id: b.id,
        name: b.name,
        power: b.power,
        trophies: b.trophies,
        battleCount: count,
        suggestion: count === 0
          ? 'Never played in recorded battles'
          : `Only ${count} recorded battles`,
      })
    }
  }

  return results.sort((a, b) => b.power - a.power)
}
