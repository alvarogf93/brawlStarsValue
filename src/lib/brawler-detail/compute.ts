import type { MapStat, MatchupStat, Recommendation, CalendarDay } from './types'

/** Minimum win-rate difference (percentage points) to trigger a recommendation */
const MIN_GAP = 10

/** Maximum number of recommendations returned */
const MAX_RECOMMENDATIONS = 5

/** Minimum personal games required to consider a stat meaningful */
const MIN_PERSONAL_GAMES = 3

/**
 * Generate actionable recommendations by comparing personal performance against
 * meta averages. Pure function -- no side effects.
 *
 * - "play" when personal WR exceeds meta by MIN_GAP on a map
 * - "avoid" when personal matchup WR is below meta by MIN_GAP
 * - Sorted by absolute diff descending, capped at MAX_RECOMMENDATIONS
 */
export function generateRecommendations(
  brawlerName: string,
  personalMaps: MapStat[],
  metaMaps: MapStat[],
  personalMatchups: MatchupStat[],
  metaMatchups: MatchupStat[],
  _locale: string,
): Recommendation[] {
  const recommendations: Recommendation[] = []

  // Index meta maps by map name for O(1) lookup
  const metaMapIndex = new Map<string, MapStat>()
  for (const m of metaMaps) {
    metaMapIndex.set(m.map, m)
  }

  // "play" recommendations: personal map WR exceeds meta
  for (const pm of personalMaps) {
    if (pm.totalBattles < MIN_PERSONAL_GAMES) continue
    const meta = metaMapIndex.get(pm.map)
    if (!meta) continue
    const diff = pm.winRate - meta.winRate
    if (diff >= MIN_GAP) {
      recommendations.push({
        type: 'play',
        brawlerName,
        context: pm.map,
        yourWR: pm.winRate,
        metaWR: meta.winRate,
        diff,
      })
    }
  }

  // Index meta matchups by opponentId for O(1) lookup
  const metaMatchupIndex = new Map<number, MatchupStat>()
  for (const m of metaMatchups) {
    metaMatchupIndex.set(m.opponentId, m)
  }

  // "avoid" recommendations: personal matchup WR below meta
  for (const pm of personalMatchups) {
    if (pm.totalBattles < MIN_PERSONAL_GAMES) continue
    const meta = metaMatchupIndex.get(pm.opponentId)
    if (!meta) continue
    const diff = pm.winRate - meta.winRate
    if (diff <= -MIN_GAP) {
      recommendations.push({
        type: 'avoid',
        brawlerName,
        context: pm.opponentName,
        yourWR: pm.winRate,
        metaWR: meta.winRate,
        diff,
      })
    }
  }

  // Sort by absolute diff descending
  recommendations.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

  // Cap at MAX_RECOMMENDATIONS
  return recommendations.slice(0, MAX_RECOMMENDATIONS)
}

/**
 * Parse a Brawl Stars battle_time string (format: "YYYYMMDDTHHmmss.000Z")
 * into a YYYY-MM-DD date string.
 */
function parseBattleDate(battleTime: string): string {
  const year = battleTime.slice(0, 4)
  const month = battleTime.slice(4, 6)
  const day = battleTime.slice(6, 8)
  return `${year}-${month}-${day}`
}

/**
 * Group an array of battles into daily buckets for a calendar heatmap.
 * Pure function -- no side effects.
 *
 * Each battle has a battle_time in Brawl Stars format and a result.
 * Returns CalendarDay[] sorted chronologically.
 */
export function bucketBattlesToCalendar(
  battles: { battle_time: string; result: 'victory' | 'defeat' | 'draw' }[],
): CalendarDay[] {
  if (battles.length === 0) return []

  const buckets = new Map<string, { games: number; wins: number }>()

  for (const battle of battles) {
    const date = parseBattleDate(battle.battle_time)
    const bucket = buckets.get(date) ?? { games: 0, wins: 0 }
    bucket.games += 1
    if (battle.result === 'victory') {
      bucket.wins += 1
    }
    buckets.set(date, bucket)
  }

  const days: CalendarDay[] = []
  for (const [date, stats] of buckets) {
    days.push({ date, games: stats.games, wins: stats.wins })
  }

  // Sort chronologically
  days.sort((a, b) => a.date.localeCompare(b.date))

  return days
}
