import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { bayesianWinRate } from '@/lib/draft/scoring'
import { PRO_MIN_BATTLES_DISPLAY, PRO_TREND_DAYS_SHORT, PRO_TREND_DAYS_LONG } from '@/lib/draft/constants'
import {
  computeTrendDelta,
  computeGapVerdict,
  computePickRate,
  type ProAnalysisResponse,
  type TopBrawlerEntry,
  type TrendEntry,
  type CounterEntry,
  type CounterMatchup,
  type DailyTrendEntry,
  type ProTrioEntry,
  type GapEntry,
  type MatchupGapEntry,
} from '@/lib/draft/pro-analysis'
import { loadBrawlerNames, getBrawlerName } from '@/lib/draft/brawler-names'
import { isPremium } from '@/lib/premium'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

const ALLOWED_WINDOWS = [7, 14, 30, 90]
const CACHE_MAX_AGE = 1800 // 30 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const map = searchParams.get('map')
  const mode = searchParams.get('mode')
  const windowParam = parseInt(searchParams.get('window') ?? '14', 10)
  const window = ALLOWED_WINDOWS.includes(windowParam) ? windowParam : 14

  if (!map || !mode) {
    return NextResponse.json(
      { error: 'map and mode are required query parameters' },
      { status: 400 },
    )
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )

  // --- Auth check ---
  const authHeader = request.headers.get('authorization')
  let userProfile: Profile | null = null
  let playerTag: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      userProfile = profile as Profile | null
      playerTag = userProfile?.player_tag ?? null
    }
  }

  const hasPremium = isPremium(userProfile)

  // --- Date calculations ---
  const now = new Date()
  const windowStart = new Date(now.getTime() - window * 86400000).toISOString().slice(0, 10)
  const trend7dStart = new Date(now.getTime() - PRO_TREND_DAYS_SHORT * 86400000).toISOString().slice(0, 10)
  const prev7dStart = new Date(now.getTime() - PRO_TREND_DAYS_SHORT * 2 * 86400000).toISOString().slice(0, 10)
  const trend30dStart = new Date(now.getTime() - PRO_TREND_DAYS_LONG * 86400000).toISOString().slice(0, 10)
  const prev30dStart = new Date(now.getTime() - PRO_TREND_DAYS_LONG * 2 * 86400000).toISOString().slice(0, 10)
  const todayStr = now.toISOString().slice(0, 10)

  // --- Load brawler names ---
  const brawlerNames = await loadBrawlerNames()

  // --- Query 1: meta_stats for current window ---
  const { data: statsRows } = await supabase
    .from('meta_stats')
    .select('brawler_id, wins, losses, total, date')
    .eq('map', map)
    .eq('mode', mode)
    .eq('source', 'global')
    .gte('date', windowStart)
    .lte('date', todayStr)

  // --- Query 2: meta_stats for 7d window + previous 7d (for trend) ---
  const { data: stats7d } = await supabase
    .from('meta_stats')
    .select('brawler_id, wins, losses, total, date')
    .eq('map', map)
    .eq('mode', mode)
    .eq('source', 'global')
    .gte('date', prev7dStart)
    .lte('date', todayStr)

  // --- Query 3: meta_stats for 30d window + previous 30d (for trend) ---
  const { data: stats30d } = await supabase
    .from('meta_stats')
    .select('brawler_id, wins, losses, total, date')
    .eq('map', map)
    .eq('mode', mode)
    .eq('source', 'global')
    .gte('date', prev30dStart)
    .lte('date', todayStr)

  // --- Query 4: meta_matchups for current window ---
  const { data: matchupRows } = await supabase
    .from('meta_matchups')
    .select('brawler_id, opponent_id, wins, losses, total, date')
    .eq('mode', mode)
    .eq('source', 'global')
    .gte('date', windowStart)
    .lte('date', todayStr)

  // --- Aggregate stats by brawler ---
  type AggStat = { wins: number; losses: number; total: number }
  const aggStats = new Map<number, AggStat>()
  let totalProBattles = 0

  for (const row of statsRows ?? []) {
    const id = row.brawler_id
    const existing = aggStats.get(id) ?? { wins: 0, losses: 0, total: 0 }
    existing.wins += row.wins
    existing.losses += row.losses
    existing.total += row.total
    aggStats.set(id, existing)
    totalProBattles += row.total
  }
  // Each battle has 6 players, so divide by 6 for unique battles
  const totalUniqueBattles = Math.round(totalProBattles / 6)

  // --- Compute 7d trends ---
  const agg7dCurrent = new Map<number, AggStat>()
  const agg7dPrev = new Map<number, AggStat>()
  for (const row of stats7d ?? []) {
    const target = row.date >= trend7dStart ? agg7dCurrent : agg7dPrev
    const existing = target.get(row.brawler_id) ?? { wins: 0, losses: 0, total: 0 }
    existing.wins += row.wins
    existing.losses += row.losses
    existing.total += row.total
    target.set(row.brawler_id, existing)
  }

  // --- Compute 30d trends ---
  const agg30dCurrent = new Map<number, AggStat>()
  const agg30dPrev = new Map<number, AggStat>()
  for (const row of stats30d ?? []) {
    const target = row.date >= trend30dStart ? agg30dCurrent : agg30dPrev
    const existing = target.get(row.brawler_id) ?? { wins: 0, losses: 0, total: 0 }
    existing.wins += row.wins
    existing.losses += row.losses
    existing.total += row.total
    target.set(row.brawler_id, existing)
  }

  // --- Build topBrawlers ---
  const allBrawlers: TopBrawlerEntry[] = []
  for (const [id, stat] of aggStats) {
    if (stat.total < PRO_MIN_BATTLES_DISPLAY) continue

    const winRate = bayesianWinRate(stat.wins, stat.total)
    const pickRate = computePickRate(stat.total, totalProBattles)

    // 7d trend
    const cur7 = agg7dCurrent.get(id)
    const prev7 = agg7dPrev.get(id)
    const trend7d = computeTrendDelta(
      cur7 && cur7.total >= 5 ? bayesianWinRate(cur7.wins, cur7.total) : winRate,
      prev7 && prev7.total >= 5 ? bayesianWinRate(prev7.wins, prev7.total) : null,
    )

    // 30d trend
    const cur30 = agg30dCurrent.get(id)
    const prev30 = agg30dPrev.get(id)
    const trend30d = computeTrendDelta(
      cur30 && cur30.total >= 10 ? bayesianWinRate(cur30.wins, cur30.total) : winRate,
      prev30 && prev30.total >= 10 ? bayesianWinRate(prev30.wins, prev30.total) : null,
    )

    allBrawlers.push({
      brawlerId: id,
      name: getBrawlerName(brawlerNames, id),
      winRate: Number(winRate.toFixed(2)),
      pickRate: Number(pickRate.toFixed(2)),
      totalBattles: stat.total,
      trend7d,
      trend30d,
    })
  }

  allBrawlers.sort((a, b) => b.winRate - a.winRate)

  // --- Build trending ---
  const rising: TrendEntry[] = []
  const falling: TrendEntry[] = []
  for (const b of allBrawlers) {
    if (b.trend7d !== null && b.trend7d > 2) {
      rising.push({ brawlerId: b.brawlerId, name: b.name, delta7d: b.trend7d })
    } else if (b.trend7d !== null && b.trend7d < -2) {
      falling.push({ brawlerId: b.brawlerId, name: b.name, delta7d: b.trend7d })
    }
  }
  rising.sort((a, b) => b.delta7d - a.delta7d)
  falling.sort((a, b) => a.delta7d - b.delta7d)

  // --- Build counters ---
  const matchupAgg = new Map<string, AggStat>()
  for (const row of matchupRows ?? []) {
    const key = `${row.brawler_id}|${row.opponent_id}`
    const existing = matchupAgg.get(key) ?? { wins: 0, losses: 0, total: 0 }
    existing.wins += row.wins
    existing.losses += row.losses
    existing.total += row.total
    matchupAgg.set(key, existing)
  }

  const counters: CounterEntry[] = []
  const brawlerIds = Array.from(aggStats.keys()).filter(id => (aggStats.get(id)?.total ?? 0) >= PRO_MIN_BATTLES_DISPLAY)

  for (const bId of brawlerIds) {
    const matchups: Array<{ opponentId: number; wr: number; total: number }> = []
    for (const oppId of brawlerIds) {
      if (oppId === bId) continue
      const key = `${bId}|${oppId}`
      const stat = matchupAgg.get(key)
      if (!stat || stat.total < 5) continue
      matchups.push({
        opponentId: oppId,
        wr: bayesianWinRate(stat.wins, stat.total),
        total: stat.total,
      })
    }

    matchups.sort((a, b) => b.wr - a.wr)

    const counterLimit = hasPremium ? matchups.length : 3
    const bestCounters: CounterMatchup[] = matchups.slice(0, counterLimit).map(m => ({
      opponentId: m.opponentId,
      name: getBrawlerName(brawlerNames, m.opponentId),
      winRate: Number(m.wr.toFixed(2)),
      total: m.total,
    }))
    const worstMatchups: CounterMatchup[] = matchups.slice(-counterLimit).reverse().map(m => ({
      opponentId: m.opponentId,
      name: getBrawlerName(brawlerNames, m.opponentId),
      winRate: Number(m.wr.toFixed(2)),
      total: m.total,
    }))

    counters.push({
      brawlerId: bId,
      name: getBrawlerName(brawlerNames, bId),
      bestCounters,
      worstMatchups,
    })
  }

  // --- Tier gating for topBrawlers ---
  const topBrawlers = hasPremium ? allBrawlers.slice(0, 10) : allBrawlers.slice(0, 5)

  // --- PREMIUM: daily trend data (30d) ---
  let dailyTrend: DailyTrendEntry[] | null = null
  if (hasPremium) {
    const dailyMap = new Map<string, Map<number, { wins: number; total: number }>>()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)

    for (const row of statsRows ?? []) {
      if (row.date < thirtyDaysAgo) continue
      if (!dailyMap.has(row.date)) dailyMap.set(row.date, new Map())
      const dayMap = dailyMap.get(row.date)!
      const existing = dayMap.get(row.brawler_id) ?? { wins: 0, total: 0 }
      existing.wins += row.wins
      existing.total += row.total
      dayMap.set(row.brawler_id, existing)
    }

    dailyTrend = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, brawlers]) => ({
        date,
        brawlers: Array.from(brawlers.entries()).map(([brawlerId, stat]) => ({
          brawlerId,
          winRate: Number(bayesianWinRate(stat.wins, stat.total).toFixed(2)),
          picks: stat.total,
        })),
      }))
  }

  // --- PREMIUM: pro trios ---
  let proTrios: ProTrioEntry[] | null = null
  if (hasPremium) {
    const { data: trioRows } = await supabase
      .from('meta_trios')
      .select('brawler1_id, brawler2_id, brawler3_id, wins, losses, total')
      .eq('map', map)
      .eq('mode', mode)
      .eq('source', 'global')
      .gte('date', windowStart)
      .lte('date', todayStr)

    // Aggregate trios across dates
    const trioAgg = new Map<string, { ids: number[]; wins: number; total: number }>()
    for (const row of trioRows ?? []) {
      const key = `${row.brawler1_id}|${row.brawler2_id}|${row.brawler3_id}`
      const existing = trioAgg.get(key) ?? {
        ids: [row.brawler1_id, row.brawler2_id, row.brawler3_id],
        wins: 0,
        total: 0,
      }
      existing.wins += row.wins
      existing.total += row.total
      trioAgg.set(key, existing)
    }

    proTrios = Array.from(trioAgg.values())
      .filter(t => t.total >= PRO_MIN_BATTLES_DISPLAY)
      .map(t => ({
        brawlers: t.ids.map(id => ({ id, name: getBrawlerName(brawlerNames, id) })),
        winRate: Number(bayesianWinRate(t.wins, t.total).toFixed(2)),
        total: t.total,
      }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 20)
  }

  // --- PREMIUM + TAG: personal gap analysis ---
  let personalGap: GapEntry[] | null = null
  let matchupGaps: MatchupGapEntry[] | null = null

  if (hasPremium && playerTag) {
    // Query user's battles on this map+mode
    const { data: userBattles } = await supabase
      .from('battles')
      .select('my_brawler, result')
      .eq('player_tag', playerTag)
      .eq('map', map)
      .eq('mode', mode)

    if (userBattles && userBattles.length > 0) {
      // Aggregate user's stats by brawler
      const userStats = new Map<number, AggStat>()
      for (const b of userBattles) {
        const brawlerId = typeof b.my_brawler === 'object' ? (b.my_brawler as { id: number }).id : null
        if (!brawlerId) continue
        const existing = userStats.get(brawlerId) ?? { wins: 0, losses: 0, total: 0 }
        existing.total++
        if (b.result === 'victory') existing.wins++
        else existing.losses++
        userStats.set(brawlerId, existing)
      }

      // Compute gaps
      personalGap = []
      for (const [brawlerId, userStat] of userStats) {
        const proStat = aggStats.get(brawlerId)
        if (!proStat || proStat.total < PRO_MIN_BATTLES_DISPLAY) continue

        const yourWR = Number(bayesianWinRate(userStat.wins, userStat.total).toFixed(2))
        const proWR = Number(bayesianWinRate(proStat.wins, proStat.total).toFixed(2))
        const gap = Number((yourWR - proWR).toFixed(2))

        personalGap.push({
          brawlerId,
          name: getBrawlerName(brawlerNames, brawlerId),
          yourWR,
          proWR,
          gap,
          yourTotal: userStat.total,
          proTotal: proStat.total,
          verdict: computeGapVerdict(yourWR, proWR),
        })
      }
      personalGap.sort((a, b) => a.gap - b.gap) // Worst gaps first

      // Matchup gaps: query user's matchup data from battles
      const { data: userBattlesDetailed } = await supabase
        .from('battles')
        .select('my_brawler, opponents, result')
        .eq('player_tag', playerTag)
        .eq('mode', mode)

      if (userBattlesDetailed && userBattlesDetailed.length > 0) {
        const userMatchups = new Map<string, AggStat>()
        for (const b of userBattlesDetailed) {
          const brawlerId = typeof b.my_brawler === 'object' ? (b.my_brawler as { id: number }).id : null
          if (!brawlerId) continue
          const opponents = b.opponents as Array<{ id: number }> | null
          if (!opponents) continue
          for (const opp of opponents) {
            const key = `${brawlerId}|${opp.id}`
            const existing = userMatchups.get(key) ?? { wins: 0, losses: 0, total: 0 }
            existing.total++
            if (b.result === 'victory') existing.wins++
            else existing.losses++
            userMatchups.set(key, existing)
          }
        }

        matchupGaps = []
        for (const [key, userStat] of userMatchups) {
          if (userStat.total < 3) continue
          const [bIdStr, oppIdStr] = key.split('|')
          const bId = Number(bIdStr)
          const oppId = Number(oppIdStr)

          const proKey = `${bId}|${oppId}`
          const proStat = matchupAgg.get(proKey)
          if (!proStat || proStat.total < 5) continue

          const yourWR = Number(bayesianWinRate(userStat.wins, userStat.total).toFixed(2))
          const proWR = Number(bayesianWinRate(proStat.wins, proStat.total).toFixed(2))
          const gap = Number((yourWR - proWR).toFixed(2))

          matchupGaps.push({
            brawlerId: bId,
            opponentId: oppId,
            brawlerName: getBrawlerName(brawlerNames, bId),
            opponentName: getBrawlerName(brawlerNames, oppId),
            yourWR,
            proWR,
            gap,
          })
        }
        matchupGaps.sort((a, b) => a.gap - b.gap)
        matchupGaps = matchupGaps.slice(0, 30)
      }
    }
  }

  // --- Build response ---
  const response: ProAnalysisResponse = {
    topBrawlers,
    totalProBattles: totalUniqueBattles,
    windowDays: window,
    trending: {
      rising: rising.slice(0, 3),
      falling: falling.slice(0, 3),
    },
    counters,
    dailyTrend,
    proTrios,
    personalGap,
    matchupGaps,
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': `public, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_MAX_AGE * 2}`,
    },
  })
}
