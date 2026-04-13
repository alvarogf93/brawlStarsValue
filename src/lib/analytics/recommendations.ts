import type {
  PlayNowRecommendation, BrawlerRecommendation,
  BrawlerMapEntry, TrioSynergy,
} from './types'
import { MIN_GAMES, getConfidence } from './types'
import { winRate as computeWinRateFromCounts, wilsonPct } from './stats'

interface EventSlot {
  startTime: string
  endTime: string
  event: { id: number; mode: string; map: string }
}

/**
 * Aggregate a list of (brawler, map) entries into one entry per brawler.
 * Used by the fallback path of computePlayNowRecommendations — when the
 * user has no history on the current rotation map, we collapse all their
 * mode-level entries by brawlerId so the same brawler never appears
 * twice in the top list. Recomputes winRate, wilsonScore, and confidence
 * from the summed counts.
 *
 * Added in Sprint D Task 1 (2026-04-13) — fixes the Najia duplicate bug
 * where filter(e => e.mode === mode) returned multiple rows for the same
 * brawler (one per map they had played in that mode) and the subsequent
 * sort/slice did not dedupe.
 */
function aggregateByBrawler(entries: BrawlerMapEntry[]): BrawlerMapEntry[] {
  const byBrawler = new Map<number, { wins: number; total: number; brawlerName: string; mode: string }>()
  for (const e of entries) {
    const existing = byBrawler.get(e.brawlerId)
    if (existing) {
      existing.wins += e.wins
      existing.total += e.total
    } else {
      byBrawler.set(e.brawlerId, { wins: e.wins, total: e.total, brawlerName: e.brawlerName, mode: e.mode })
    }
  }
  const result: BrawlerMapEntry[] = []
  for (const [brawlerId, agg] of byBrawler) {
    result.push({
      brawlerId,
      brawlerName: agg.brawlerName,
      map: '',  // empty marker — fallback entries are cross-map
      mode: agg.mode,
      eventId: null,
      wins: agg.wins,
      total: agg.total,
      winRate: computeWinRateFromCounts(agg.wins, agg.total),
      wilsonScore: wilsonPct(agg.wins, agg.total),
      confidence: getConfidence(agg.total),
    })
  }
  return result
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

    // Tier 1: map-specific data (user has played this exact map)
    let candidates = brawlerMapMatrix.filter(e => e.map === map)
    let source: 'map-specific' | 'mode-aggregate' = 'map-specific'

    // Tier 2 fallback: if no map-specific data, aggregate across maps in
    // the same mode so each brawler appears exactly once with combined totals.
    if (candidates.length === 0) {
      const modeEntries = brawlerMapMatrix.filter(e => e.mode === mode)
      if (modeEntries.length > 0) {
        candidates = aggregateByBrawler(modeEntries)
        source = 'mode-aggregate'
      }
    }

    if (candidates.length === 0) continue

    // Sort by Wilson score (fair ranking accounting for sample size)
    const sorted = [...candidates].sort((a, b) => b.wilsonScore - a.wilsonScore)
    const topBrawlers = sorted.slice(0, 5)

    const recommendations: BrawlerRecommendation[] = topBrawlers.map(c => {
      // Find best trio that CONTAINS this brawler AND was actually played on
      // THIS map. A trio that works in mode X map Y won't necessarily work
      // on map Z, so global/mode-level trios are misleading here.
      // If the user has no map-specific trio data (including the Tier 2
      // fallback path where the user hasn't played the map at all), bestTrio
      // stays null and PlayNowDashboard hides the trio UI for that slot.
      const trioCandidates = trioSynergy
        .filter(trio => trio.map === map && trio.brawlers.some(b => b.id === c.brawlerId) && trio.total >= MIN_GAMES)
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
      source,
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
