import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { bayesianWinRate } from '@/lib/draft/scoring'
import { META_ROLLING_DAYS } from '@/lib/draft/constants'
import type { BrawlerMetaResponse, MapStat, MatchupStat } from '@/lib/brawler-detail/types'

/** Minimum battles required to include a map or matchup in rankings.
 *  Low threshold because Bayesian WR already handles small sample sizes. */
const MIN_GAMES = 3

/**
 * GET /api/meta/brawler-detail?brawlerId=X&window=14
 *
 * Returns aggregated meta stats, best/worst maps, and matchup data
 * for a single brawler over a rolling window.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawBrawlerId = searchParams.get('brawlerId')
  const rawWindow = searchParams.get('window')

  // 1. Validate brawlerId (required, numeric)
  if (!rawBrawlerId || !/^\d+$/.test(rawBrawlerId)) {
    return NextResponse.json({ error: 'brawlerId is required and must be numeric' }, { status: 400 })
  }
  const brawlerId = Number(rawBrawlerId)

  // 2. Parse window (default META_ROLLING_DAYS), compute cutoff date
  const window = rawWindow && /^\d+$/.test(rawWindow) ? Number(rawWindow) : META_ROLLING_DAYS
  const cutoffDate = new Date(Date.now() - window * 86400000).toISOString().slice(0, 10)

  const serviceSupabase = await createServiceClient()

  // 3. Fetch meta_stats for this brawler (all sources: global + users)
  const { data: rawStats, error: statsError } = await serviceSupabase
    .from('meta_stats')
    .select('brawler_id, map, mode, wins, losses, total')
    .eq('brawler_id', brawlerId)
    .gte('date', cutoffDate)

  if (statsError) {
    return NextResponse.json({ error: 'Failed to fetch meta stats' }, { status: 500 })
  }

  // 4. Fetch meta_matchups for this brawler (all sources)
  const { data: rawMatchups, error: matchupsError } = await serviceSupabase
    .from('meta_matchups')
    .select('brawler_id, opponent_id, wins, losses, total')
    .eq('brawler_id', brawlerId)
    .gte('date', cutoffDate)

  if (matchupsError) {
    return NextResponse.json({ error: 'Failed to fetch matchups' }, { status: 500 })
  }

  // 5. Fetch total battles across ALL brawlers for pick rate calculation
  const { data: totalBattlesData, error: totalError } = await serviceSupabase
    .from('meta_stats')
    .select('total')
    .gte('date', cutoffDate)

  if (totalError) {
    return NextResponse.json({ error: 'Failed to fetch total battles' }, { status: 500 })
  }

  const allGames = (totalBattlesData ?? []).reduce((sum, r) => sum + r.total, 0)

  // 6. Aggregate stats by map (sum wins/losses/total across dates)
  const mapAgg = new Map<string, { map: string; mode: string; wins: number; losses: number; total: number }>()
  let brawlerWins = 0
  let brawlerGames = 0

  for (const r of rawStats ?? []) {
    brawlerWins += r.wins
    brawlerGames += r.total

    const key = `${r.map}|${r.mode}`
    const existing = mapAgg.get(key)
    if (existing) {
      existing.wins += r.wins
      existing.losses += r.losses
      existing.total += r.total
    } else {
      mapAgg.set(key, {
        map: r.map,
        mode: r.mode,
        wins: r.wins,
        losses: r.losses,
        total: r.total,
      })
    }
  }

  // 7. Compute global WR using Bayesian win rate
  const globalWinRate = bayesianWinRate(brawlerWins, brawlerGames)

  // 8. Compute pick rate
  const pickRate = allGames > 0 ? (brawlerGames / allGames) * 100 : 0

  // 9. Rank maps by Bayesian WR — bestMaps (top 5), worstMaps (bottom 5)
  const mapStats: (MapStat & { bayesianWR: number })[] = []
  for (const agg of mapAgg.values()) {
    if (agg.total < MIN_GAMES) continue
    const wr = bayesianWinRate(agg.wins, agg.total)
    mapStats.push({
      map: agg.map,
      mode: agg.mode,
      eventId: null,
      winRate: Math.round(wr * 100) / 100,
      totalBattles: agg.total,
      bayesianWR: wr,
    })
  }

  mapStats.sort((a, b) => b.bayesianWR - a.bayesianWR)

  const bestMaps: MapStat[] = mapStats.slice(0, 5).map(({ bayesianWR: _, ...rest }) => rest)
  const worstMaps: MapStat[] = mapStats.slice(-5).reverse().map(({ bayesianWR: _, ...rest }) => rest)

  // 10. Aggregate matchups by opponent_id
  const matchupAgg = new Map<number, { opponentId: number; wins: number; losses: number; total: number }>()
  for (const r of rawMatchups ?? []) {
    const existing = matchupAgg.get(r.opponent_id)
    if (existing) {
      existing.wins += r.wins
      existing.losses += r.losses
      existing.total += r.total
    } else {
      matchupAgg.set(r.opponent_id, {
        opponentId: r.opponent_id,
        wins: r.wins,
        losses: r.losses,
        total: r.total,
      })
    }
  }

  const matchupStats: (MatchupStat & { bayesianWR: number })[] = []
  for (const agg of matchupAgg.values()) {
    if (agg.total < MIN_GAMES) continue
    const wr = bayesianWinRate(agg.wins, agg.total)
    matchupStats.push({
      opponentId: agg.opponentId,
      opponentName: '', // Resolved client-side with brawler name map
      winRate: Math.round(wr * 100) / 100,
      totalBattles: agg.total,
      bayesianWR: wr,
    })
  }

  matchupStats.sort((a, b) => b.bayesianWR - a.bayesianWR)

  const strongAgainst: MatchupStat[] = matchupStats.slice(0, 5).map(({ bayesianWR: _, ...rest }) => rest)
  const weakAgainst: MatchupStat[] = matchupStats.slice(-5).reverse().map(({ bayesianWR: _, ...rest }) => rest)

  // 11. Build response
  const response: BrawlerMetaResponse = {
    brawlerId,
    globalStats: {
      winRate: Math.round(globalWinRate * 100) / 100,
      pickRate: Math.round(pickRate * 100) / 100,
      totalBattles: brawlerGames,
      trend7d: 0, // v1 simplified — no trend calculation yet
    },
    bestMaps,
    worstMaps,
    strongAgainst,
    weakAgainst,
    bestTeammates: [], // Populated client-side in v1
  }

  return NextResponse.json(response)
}
