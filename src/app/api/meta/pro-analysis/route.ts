import { NextResponse } from 'next/server'
import {
  createClient as createCookieAuthClient,
  createServiceClientNoCookies,
} from '@/lib/supabase/server'
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
  type TeammateGroupEntry,
  type TeammateTrio,
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
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

  const supabase = createServiceClientNoCookies()

  // --- Auth check (cookie-based) ---
  // The single caller (useProAnalysis hook) fetches with `credentials: 'include'`,
  // so the user's session travels as cookies — not as a Bearer header. Use the
  // cookie-reading server client from @/lib/supabase/server to identify the
  // user. The service-role `supabase` client above is still used for the actual
  // data queries so meta_stats/meta_matchups/meta_trios reads bypass RLS.
  let userProfile: Profile | null = null
  let playerTag: string | null = null

  try {
    const authClient = await createCookieAuthClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      userProfile = profile as Profile | null
      playerTag = userProfile?.player_tag ?? null
    }
  } catch {
    // Anonymous request — no session cookie available. Free-tier response
    // still builds correctly; premium fields stay null.
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

  // ── Aggregation helper: raw stats + trend maps → top brawlers ──
  // Used by both Tier 1 (map+mode filter) and Tier 2 (mode-only
  // fallback when the map is empty). Takes trend maps as arguments
  // so Tier 2 can pass mode-level trends instead of map-level ones.
  type AggStat = { wins: number; losses: number; total: number }
  type StatRow = { brawler_id: number; wins: number; losses: number; total: number; date: string }

  function buildTrendMaps(
    rows: StatRow[] | null | undefined,
    windowStart: string,
  ): { current: Map<number, AggStat>; prev: Map<number, AggStat> } {
    const current = new Map<number, AggStat>()
    const prev = new Map<number, AggStat>()
    for (const row of rows ?? []) {
      const target = row.date >= windowStart ? current : prev
      const existing = target.get(row.brawler_id) ?? { wins: 0, losses: 0, total: 0 }
      existing.wins += row.wins
      existing.losses += row.losses
      existing.total += row.total
      target.set(row.brawler_id, existing)
    }
    return { current, prev }
  }

  function aggregateAllBrawlers(
    rows: StatRow[],
    trend7d: { current: Map<number, AggStat>; prev: Map<number, AggStat> },
    trend30d: { current: Map<number, AggStat>; prev: Map<number, AggStat> },
  ): { allBrawlers: TopBrawlerEntry[]; aggStats: Map<number, AggStat>; totalBattles: number } {
    const agg = new Map<number, AggStat>()
    let total = 0
    for (const row of rows) {
      const id = row.brawler_id
      const existing = agg.get(id) ?? { wins: 0, losses: 0, total: 0 }
      existing.wins += row.wins
      existing.losses += row.losses
      existing.total += row.total
      agg.set(id, existing)
      total += row.total
    }

    const result: TopBrawlerEntry[] = []
    for (const [id, stat] of agg) {
      if (stat.total < PRO_MIN_BATTLES_DISPLAY) continue

      const winRate = bayesianWinRate(stat.wins, stat.total)
      const pickRate = computePickRate(stat.total, total)

      // 7d trend
      const cur7 = trend7d.current.get(id)
      const prev7 = trend7d.prev.get(id)
      const trend7dDelta = computeTrendDelta(
        cur7 && cur7.total >= 5 ? bayesianWinRate(cur7.wins, cur7.total) : winRate,
        prev7 && prev7.total >= 5 ? bayesianWinRate(prev7.wins, prev7.total) : null,
      )

      // 30d trend
      const cur30 = trend30d.current.get(id)
      const prev30 = trend30d.prev.get(id)
      const trend30dDelta = computeTrendDelta(
        cur30 && cur30.total >= 10 ? bayesianWinRate(cur30.wins, cur30.total) : winRate,
        prev30 && prev30.total >= 10 ? bayesianWinRate(prev30.wins, prev30.total) : null,
      )

      result.push({
        brawlerId: id,
        name: getBrawlerName(brawlerNames, id),
        winRate: Number(winRate.toFixed(2)),
        pickRate: Number(pickRate.toFixed(2)),
        totalBattles: stat.total,
        trend7d: trend7dDelta,
        trend30d: trend30dDelta,
      })
    }
    result.sort((a, b) => b.winRate - a.winRate)
    return { allBrawlers: result, aggStats: agg, totalBattles: total }
  }

  // ── Tier 1: map+mode aggregation + trends ─────────────
  // Uses the existing map-filtered stats7d / stats30d queries.
  const tier1Trend7d = buildTrendMaps(stats7d as StatRow[] | null | undefined, trend7dStart)
  const tier1Trend30d = buildTrendMaps(stats30d as StatRow[] | null | undefined, trend30dStart)
  const tier1 = aggregateAllBrawlers(
    (statsRows ?? []) as StatRow[],
    tier1Trend7d,
    tier1Trend30d,
  )

  let allBrawlers = tier1.allBrawlers
  let aggStats = tier1.aggStats
  let totalProBattles = tier1.totalBattles
  let topBrawlersSource: 'map-mode' | 'mode-fallback' = 'map-mode'

  // ── Tier 2: mode-only fallback when map has no displayable brawlers ──
  // Spec §7.2 — re-query meta_stats WITHOUT the map filter so the user
  // sees mode-level aggregation instead of an empty list. Also re-query
  // 7d and 30d trends without the map filter so trends stay meaningful.
  if (allBrawlers.length === 0) {
    // Issue the 3 fallback queries in parallel (current + 7d + 30d)
    const [modeStatsRowsRes, modeStats7dRes, modeStats30dRes] = await Promise.all([
      supabase
        .from('meta_stats')
        .select('brawler_id, wins, losses, total, date')
        .eq('mode', mode)
        .eq('source', 'global')
        .gte('date', windowStart)
        .lte('date', todayStr),
      supabase
        .from('meta_stats')
        .select('brawler_id, wins, losses, total, date')
        .eq('mode', mode)
        .eq('source', 'global')
        .gte('date', prev7dStart)
        .lte('date', todayStr),
      supabase
        .from('meta_stats')
        .select('brawler_id, wins, losses, total, date')
        .eq('mode', mode)
        .eq('source', 'global')
        .gte('date', prev30dStart)
        .lte('date', todayStr),
    ])

    const modeStatsRows = modeStatsRowsRes.data
    if (modeStatsRows && modeStatsRows.length > 0) {
      const tier2Trend7d = buildTrendMaps(
        modeStats7dRes.data as StatRow[] | null | undefined,
        trend7dStart,
      )
      const tier2Trend30d = buildTrendMaps(
        modeStats30dRes.data as StatRow[] | null | undefined,
        trend30dStart,
      )
      const tier2 = aggregateAllBrawlers(
        modeStatsRows as StatRow[],
        tier2Trend7d,
        tier2Trend30d,
      )
      if (tier2.allBrawlers.length > 0) {
        allBrawlers = tier2.allBrawlers
        aggStats = tier2.aggStats
        totalProBattles = tier2.totalBattles
        topBrawlersSource = 'mode-fallback'
      }
    }
  }

  // Each battle has 6 players, so divide by 6 for unique battles.
  // Computed AFTER Tier 2 fallback so the count reflects whichever
  // tier actually populated allBrawlers.
  const totalUniqueBattles = Math.round(totalProBattles / 6)

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

  // --- Teammates per top brawler (shown to all users) ---
  // For each top brawler, find which trios the pros most often formed
  // when they picked that brawler on this map+mode. The anchor brawler
  // is excluded from `teammates` so the UI renders just the 2 other
  // portraits. Minimum 3 battles per trio to avoid single-sample noise.
  const TEAMMATE_MIN_BATTLES = 3
  const TEAMMATES_PER_BRAWLER = 3

  const { data: trioRows } = await supabase
    .from('meta_trios')
    .select('brawler1_id, brawler2_id, brawler3_id, wins, losses, total')
    .eq('map', map)
    .eq('mode', mode)
    .eq('source', 'global')
    .gte('date', windowStart)
    .lte('date', todayStr)

  // Aggregate trios across dates by canonical 3-id key
  const trioAgg = new Map<string, { ids: [number, number, number]; wins: number; total: number }>()
  for (const row of trioRows ?? []) {
    const key = `${row.brawler1_id}|${row.brawler2_id}|${row.brawler3_id}`
    const existing = trioAgg.get(key) ?? {
      ids: [row.brawler1_id, row.brawler2_id, row.brawler3_id] as [number, number, number],
      wins: 0,
      total: 0,
    }
    existing.wins += row.wins
    existing.total += row.total
    trioAgg.set(key, existing)
  }

  const topBrawlerIds = new Set(topBrawlers.map(b => b.brawlerId))
  const teammatesByBrawler = new Map<number, TeammateTrio[]>()
  for (const anchorId of topBrawlerIds) {
    const candidates: TeammateTrio[] = []
    for (const agg of trioAgg.values()) {
      if (agg.total < TEAMMATE_MIN_BATTLES) continue
      if (!agg.ids.includes(anchorId)) continue
      const teammates = agg.ids
        .filter(id => id !== anchorId)
        .map(id => ({ id, name: getBrawlerName(brawlerNames, id) }))
      candidates.push({
        teammates,
        winRate: Number(bayesianWinRate(agg.wins, agg.total).toFixed(2)),
        total: agg.total,
      })
    }
    // Sort by frequency (total) descending — most repeated pairing first
    candidates.sort((a, b) => b.total - a.total)
    teammatesByBrawler.set(anchorId, candidates.slice(0, TEAMMATES_PER_BRAWLER))
  }

  const topBrawlerTeammates: TeammateGroupEntry[] = topBrawlers
    .map(b => ({
      brawlerId: b.brawlerId,
      trios: teammatesByBrawler.get(b.brawlerId) ?? [],
    }))
    .filter(entry => entry.trios.length > 0)

  // --- PREMIUM: full pro trios (for TeamSynergyView cross-reference) ---
  // Derived from the same trioAgg to avoid a second query. Sorted by WR
  // (descending) and capped at 20 — the consumer uses this as a lookup
  // keyed by the canonical 3-id string, not as a visual ranking, but the
  // slice prevents over-serialisation for maps with thousands of trios.
  let proTrios: ProTrioEntry[] | null = null
  if (hasPremium) {
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
          const opponents = b.opponents as Array<{ brawler: { id: number } }> | null
          if (!opponents) continue
          for (const opp of opponents) {
            const key = `${brawlerId}|${opp.brawler.id}`
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
    topBrawlersSource,
    trending: {
      rising: rising.slice(0, 3),
      falling: falling.slice(0, 3),
    },
    counters,
    topBrawlerTeammates,
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
