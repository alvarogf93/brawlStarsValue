import type { Battle } from '@/lib/supabase/types'
import type {
  PlayNowRecommendation, BrawlerRecommendation,
  CounterPickResult, BrawlerMapEntry, MatchupEntry, TrioSynergy,
} from './types'
import { MIN_GAMES } from './types'
import { wilsonPct, winRate, compositeKey, isWin } from './stats'

interface EventSlot {
  startTime: string
  endTime: string
  event: { id: number; mode: string; map: string }
}

/**
 * Generate "Play Now" recommendations by crossing the current event
 * rotation with the player's historical performance per map/brawler.
 * Uses trio synergy to recommend the best full team (3 brawlers).
 */
export function computePlayNowRecommendations(
  brawlerMapMatrix: BrawlerMapEntry[],
  trioSynergy: TrioSynergy[],
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
      // Find best trio that CONTAINS this brawler (use global aggregates)
      const trioCandidates = trioSynergy
        .filter(trio => trio.map === null && trio.brawlers.some(b => b.id === c.brawlerId) && trio.total >= MIN_GAMES)
        .sort((a, b) => b.wilsonScore - a.wilsonScore)

      const bestTrio = trioCandidates[0] ?? null

      return {
        brawlerId: c.brawlerId,
        brawlerName: c.brawlerName,
        winRate: c.winRate,
        gamesPlayed: c.total,
        wilsonScore: c.wilsonScore,
        bestTrio: bestTrio ? {
          brawlers: bestTrio.brawlers,
          winRate: bestTrio.winRate,
          total: bestTrio.total,
        } : null,
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
