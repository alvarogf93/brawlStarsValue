import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { bayesianWinRate } from '@/lib/draft/scoring'
import { META_ROLLING_DAYS } from '@/lib/draft/constants'
import { compute7dTrend } from '@/lib/brawler-detail/trend'
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

  // 3-5. Fetch the three independent datasets in parallel. Previously
  // these ran serially (~150-300 ms each); the totalBattles query was
  // unpaginated and silently truncated at PostgREST's 1000-row cap,
  // corrupting the pickRate denominator. Switched to RPC scalar sum
  // (migration 023) and Promise.all.
  //
  // All three queries restrict to source='global' so they line up with
  // the SQL bulk function (migration 022) and with /api/meta/pro-analysis.
  // Without it, premium users' personal data would leak into the public
  // brawler page (skewing winRate, mapAgg, matchups, and detaching the
  // pickRate numerator from its denominator). The previous comment
  // claimed "all sources: global + users" but the code's own
  // compute7dTrend invariant (CLAUDE.md "compute7dTrend logic lives in
  // TWO places and MUST stay in sync") requires single-source data.
  const [statsResp, matchupsResp, totalResp] = await Promise.all([
    serviceSupabase
      .from('meta_stats')
      .select('brawler_id, map, mode, date, wins, losses, total')
      .eq('brawler_id', brawlerId)
      .eq('source', 'global')
      .gte('date', cutoffDate),
    serviceSupabase
      .from('meta_matchups')
      .select('brawler_id, opponent_id, wins, losses, total')
      .eq('brawler_id', brawlerId)
      .eq('source', 'global')
      .gte('date', cutoffDate),
    serviceSupabase.rpc('sum_meta_stats_total', { p_since: cutoffDate, p_source: 'global' }),
  ])

  const { data: rawStats, error: statsError } = statsResp
  if (statsError) {
    return NextResponse.json({ error: 'Failed to fetch meta stats' }, { status: 500 })
  }

  const { data: rawMatchups, error: matchupsError } = matchupsResp
  if (matchupsError) {
    return NextResponse.json({ error: 'Failed to fetch matchups' }, { status: 500 })
  }

  const { data: totalScalar, error: totalError } = totalResp
  if (totalError) {
    return NextResponse.json({ error: 'Failed to fetch total battles' }, { status: 500 })
  }

  // PostgREST returns BIGINT as number (BigInt deserialization is
  // off by default); guarded with Number() in case future versions
  // change to string serialization.
  const allGames = Number(totalScalar ?? 0)

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

  // 11. Calculate trend via the pure helper. Returns null when
  // either window has fewer than MIN_BATTLES_PER_TREND_WINDOW battles
  // — the UI shows "—" / "Sin datos" instead of a fake "Estable".
  // Sprint D 2026-04-13: extracted from inline code where it
  // returned 0 on insufficient data, masking the case where the
  // cron simply hadn't been collecting long enough.
  const trend7d = compute7dTrend(
    (rawStats ?? []).map((r) => ({
      date: (r as { date?: string }).date ?? '',
      wins: r.wins,
      total: r.total,
    })),
  )

  // 11. Build response
  const response: BrawlerMetaResponse = {
    brawlerId,
    globalStats: {
      winRate: Math.round(globalWinRate * 100) / 100,
      pickRate: Math.round(pickRate * 100) / 100,
      totalBattles: brawlerGames,
      trend7d,
    },
    bestMaps,
    worstMaps,
    strongAgainst,
    weakAgainst,
    bestTeammates: [], // Populated client-side in v1
  }

  return NextResponse.json(response)
}
