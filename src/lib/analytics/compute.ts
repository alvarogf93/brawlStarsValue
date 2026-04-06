import type { Battle } from '@/lib/supabase/types'
import type {
  AdvancedAnalytics, BrawlerPerformance, ModePerformance, MapPerformance,
  BrawlerMapEntry, BrawlerModeEntry, MatchupEntry, BrawlerSynergy,
  TeammateSynergy, HourPerformance, DailyTrend, BrawlerMastery, MasteryPoint,
  StreakInfo, TiltAnalysis, SessionInfo,
} from './types'
import { MIN_GAMES, MIN_GAMES_SOFT } from './types'
import {
  wilsonPct, winRate, groupBy, compositeKey, parseCompositeKey,
  isWin, isLoss, avg,
} from './stats'

// ── Session detection: gap > 30 min = new session ───────────────
const SESSION_GAP_MS = 30 * 60 * 1000

/**
 * Compute all advanced analytics from a list of battles.
 * Battles MUST be sorted by battle_time ascending (oldest first).
 * All heavy computation happens here (server-side).
 */
export function computeAdvancedAnalytics(rawBattles: Battle[]): AdvancedAnalytics {
  // Sort oldest-first for time-series analysis
  const battles = [...rawBattles].sort(
    (a, b) => new Date(a.battle_time).getTime() - new Date(b.battle_time).getTime()
  )

  return {
    overview: computeOverview(battles),
    byBrawler: computeByBrawler(battles),
    byMode: computeByMode(battles),
    byMap: computeByMap(battles),
    brawlerMapMatrix: computeBrawlerMapMatrix(battles),
    brawlerModeMatrix: computeBrawlerModeMatrix(battles),
    matchups: computeMatchups(battles),
    brawlerSynergy: computeBrawlerSynergy(battles),
    teammateSynergy: computeTeammateSynergy(battles),
    byHour: computeByHour(battles),
    dailyTrend: computeDailyTrend(battles),
    brawlerMastery: computeBrawlerMastery(battles),
    tilt: computeTiltAnalysis(battles),
    sessions: computeSessions(battles),
  }
}

// ── Overview ────────────────────────────────────────────────────

function computeOverview(battles: Battle[]): AdvancedAnalytics['overview'] {
  const wins = battles.filter(b => isWin(b.result)).length
  const total = battles.length
  const starCount = battles.filter(b => b.is_star_player).length
  const durations = battles.map(b => b.duration).filter((d): d is number => d != null && d > 0)
  const trophySum = battles.reduce((s, b) => s + (b.trophy_change ?? 0), 0)

  return {
    totalBattles: total,
    overallWinRate: winRate(wins, total),
    totalWins: wins,
    trophyChange: trophySum,
    starPlayerCount: starCount,
    starPlayerRate: winRate(starCount, total),
    avgDuration: avg(durations),
    streak: computeStreaks(battles),
  }
}

// ── Streaks ─────────────────────────────────────────────────────

function computeStreaks(battles: Battle[]): StreakInfo {
  let longestWin = 0, longestLoss = 0
  let currentWin = 0, currentLoss = 0

  // Iterate oldest → newest so "current" streak = most recent
  for (const b of battles) {
    if (isWin(b.result)) {
      currentWin++
      currentLoss = 0
      if (currentWin > longestWin) longestWin = currentWin
    } else if (isLoss(b.result)) {
      currentLoss++
      currentWin = 0
      if (currentLoss > longestLoss) longestLoss = currentLoss
    } else {
      // draws reset both
      currentWin = 0
      currentLoss = 0
    }
  }

  const currentType = currentWin > 0 ? 'win' : currentLoss > 0 ? 'loss' : 'none'
  const currentCount = currentWin > 0 ? currentWin : currentLoss > 0 ? currentLoss : 0

  return { currentType, currentCount, longestWin, longestLoss }
}

// ── By Brawler ──────────────────────────────────────────────────

function computeByBrawler(battles: Battle[]): BrawlerPerformance[] {
  const grouped = groupBy(battles, b => b.my_brawler?.id ?? 0)
  const results: BrawlerPerformance[] = []

  for (const [id, group] of grouped) {
    const wins = group.filter(b => isWin(b.result)).length
    const losses = group.filter(b => isLoss(b.result)).length
    const draws = group.length - wins - losses
    const total = group.length
    const starCount = group.filter(b => b.is_star_player).length
    const durations = group.map(b => b.duration).filter((d): d is number => d != null && d > 0)
    const trophyChanges = group.map(b => b.trophy_change ?? 0)

    results.push({
      id,
      name: group[0].my_brawler?.name ?? 'Unknown',
      wins, losses, draws, total,
      winRate: winRate(wins, total),
      wilsonScore: wilsonPct(wins, total),
      starPlayerCount: starCount,
      starPlayerRate: winRate(starCount, total),
      avgTrophyChange: avg(trophyChanges) ?? 0,
      avgDuration: avg(durations),
    })
  }

  return results.sort((a, b) => b.total - a.total)
}

// ── By Mode ─────────────────────────────────────────────────────

function computeByMode(battles: Battle[]): ModePerformance[] {
  const grouped = groupBy(battles, b => b.mode)
  const results: ModePerformance[] = []

  for (const [mode, group] of grouped) {
    const wins = group.filter(b => isWin(b.result)).length
    results.push({
      mode,
      wins,
      total: group.length,
      winRate: winRate(wins, group.length),
      wilsonScore: wilsonPct(wins, group.length),
    })
  }

  return results.sort((a, b) => b.total - a.total)
}

// ── By Map ──────────────────────────────────────────────────────

function computeByMap(battles: Battle[]): MapPerformance[] {
  const grouped = groupBy(battles, b => b.map ?? 'Unknown')
  const results: MapPerformance[] = []

  for (const [map, group] of grouped) {
    const wins = group.filter(b => isWin(b.result)).length
    results.push({
      map,
      mode: group[0].mode,
      wins,
      total: group.length,
      winRate: winRate(wins, group.length),
      wilsonScore: wilsonPct(wins, group.length),
    })
  }

  return results.sort((a, b) => b.total - a.total)
}

// ── Brawler × Map Matrix ────────────────────────────────────────

function computeBrawlerMapMatrix(battles: Battle[]): BrawlerMapEntry[] {
  const grouped = groupBy(battles, b =>
    compositeKey(b.my_brawler?.id ?? 0, b.map ?? 'Unknown')
  )
  const results: BrawlerMapEntry[] = []

  for (const [key, group] of grouped) {
    if (group.length < MIN_GAMES) continue
    const [idStr, map] = parseCompositeKey(key)
    const wins = group.filter(b => isWin(b.result)).length
    results.push({
      brawlerId: Number(idStr),
      brawlerName: group[0].my_brawler?.name ?? 'Unknown',
      map,
      mode: group[0].mode,
      eventId: group[0].event_id ?? null,
      wins,
      total: group.length,
      winRate: winRate(wins, group.length),
      wilsonScore: wilsonPct(wins, group.length),
    })
  }

  return results.sort((a, b) => b.wilsonScore - a.wilsonScore)
}

// ── Brawler × Mode Matrix ───────────────────────────────────────

function computeBrawlerModeMatrix(battles: Battle[]): BrawlerModeEntry[] {
  const grouped = groupBy(battles, b =>
    compositeKey(b.my_brawler?.id ?? 0, b.mode)
  )
  const results: BrawlerModeEntry[] = []

  for (const [key, group] of grouped) {
    if (group.length < MIN_GAMES) continue
    const [idStr, mode] = parseCompositeKey(key)
    const wins = group.filter(b => isWin(b.result)).length
    results.push({
      brawlerId: Number(idStr),
      brawlerName: group[0].my_brawler?.name ?? 'Unknown',
      mode,
      wins,
      total: group.length,
      winRate: winRate(wins, group.length),
      wilsonScore: wilsonPct(wins, group.length),
    })
  }

  return results.sort((a, b) => b.wilsonScore - a.wilsonScore)
}

// ── Opponent Matchups ───────────────────────────────────────────

function computeMatchups(battles: Battle[]): MatchupEntry[] {
  // For each battle, cross my_brawler with each opponent's brawler
  const acc = new Map<string, { wins: number; total: number; myName: string; oppName: string }>()

  for (const b of battles) {
    const myId = b.my_brawler?.id ?? 0
    const myName = b.my_brawler?.name ?? 'Unknown'
    const opponents = (b.opponents ?? []) as Array<{ brawler: { id: number; name: string } }>

    for (const opp of opponents) {
      const key = compositeKey(myId, opp.brawler.id)
      const entry = acc.get(key) ?? { wins: 0, total: 0, myName, oppName: opp.brawler.name }
      entry.total++
      if (isWin(b.result)) entry.wins++
      acc.set(key, entry)
    }
  }

  const results: MatchupEntry[] = []
  for (const [key, val] of acc) {
    if (val.total < MIN_GAMES) continue
    const [myIdStr, oppIdStr] = parseCompositeKey(key)
    results.push({
      myBrawlerId: Number(myIdStr),
      myBrawlerName: val.myName,
      opponentBrawlerId: Number(oppIdStr),
      opponentBrawlerName: val.oppName,
      wins: val.wins,
      total: val.total,
      winRate: winRate(val.wins, val.total),
      wilsonScore: wilsonPct(val.wins, val.total),
    })
  }

  return results.sort((a, b) => b.total - a.total)
}

// ── Brawler Synergy (my brawler × teammate brawler) ─────────────

function computeBrawlerSynergy(battles: Battle[]): BrawlerSynergy[] {
  const acc = new Map<string, { wins: number; total: number; myName: string; tmName: string }>()

  for (const b of battles) {
    const myId = b.my_brawler?.id ?? 0
    const myName = b.my_brawler?.name ?? 'Unknown'
    const teammates = (b.teammates ?? []) as Array<{ brawler: { id: number; name: string } }>

    for (const tm of teammates) {
      const key = compositeKey(myId, tm.brawler.id)
      const entry = acc.get(key) ?? { wins: 0, total: 0, myName, tmName: tm.brawler.name }
      entry.total++
      if (isWin(b.result)) entry.wins++
      acc.set(key, entry)
    }
  }

  const results: BrawlerSynergy[] = []
  for (const [key, val] of acc) {
    if (val.total < MIN_GAMES_SOFT) continue
    const [myIdStr, tmIdStr] = parseCompositeKey(key)
    results.push({
      myBrawlerId: Number(myIdStr),
      myBrawlerName: val.myName,
      teammateBrawlerId: Number(tmIdStr),
      teammateBrawlerName: val.tmName,
      wins: val.wins,
      total: val.total,
      winRate: winRate(val.wins, val.total),
      wilsonScore: wilsonPct(val.wins, val.total),
    })
  }

  return results.sort((a, b) => b.wilsonScore - a.wilsonScore)
}

// ── Teammate Synergy (by player tag) ────────────────────────────

function computeTeammateSynergy(battles: Battle[]): TeammateSynergy[] {
  const acc = new Map<string, {
    name: string; wins: number; total: number;
    byMode: Map<string, { wins: number; total: number }>
  }>()

  for (const b of battles) {
    const teammates = (b.teammates ?? []) as Array<{ tag: string; name: string }>

    for (const tm of teammates) {
      const entry = acc.get(tm.tag) ?? {
        name: tm.name, wins: 0, total: 0,
        byMode: new Map(),
      }
      entry.total++
      if (isWin(b.result)) entry.wins++

      // Track by mode
      const modeEntry = entry.byMode.get(b.mode) ?? { wins: 0, total: 0 }
      modeEntry.total++
      if (isWin(b.result)) modeEntry.wins++
      entry.byMode.set(b.mode, modeEntry)

      // Update name to latest
      entry.name = tm.name
      acc.set(tm.tag, entry)
    }
  }

  const results: TeammateSynergy[] = []
  for (const [tag, val] of acc) {
    if (val.total < MIN_GAMES_SOFT) continue

    // Find best mode (min 2 games)
    let bestMode: string | null = null
    let bestModeWR: number | null = null
    for (const [mode, stats] of val.byMode) {
      if (stats.total >= 2) {
        const wr = winRate(stats.wins, stats.total)
        if (bestModeWR === null || wr > bestModeWR) {
          bestMode = mode
          bestModeWR = wr
        }
      }
    }

    results.push({
      tag, name: val.name,
      wins: val.wins, total: val.total,
      winRate: winRate(val.wins, val.total),
      wilsonScore: wilsonPct(val.wins, val.total),
      bestMode, bestModeWR,
    })
  }

  return results.sort((a, b) => b.total - a.total)
}

// ── By Hour of Day ──────────────────────────────────────────────

function computeByHour(battles: Battle[]): HourPerformance[] {
  const hours: Array<{ wins: number; total: number }> = Array.from(
    { length: 24 }, () => ({ wins: 0, total: 0 })
  )

  for (const b of battles) {
    const h = new Date(b.battle_time).getUTCHours()
    hours[h].total++
    if (isWin(b.result)) hours[h].wins++
  }

  return hours.map((h, i) => ({
    hour: i,
    wins: h.wins,
    total: h.total,
    winRate: winRate(h.wins, h.total),
  }))
}

// ── Daily Trend ─────────────────────────────────────────────────

function computeDailyTrend(battles: Battle[]): DailyTrend[] {
  const grouped = groupBy(battles, b =>
    new Date(b.battle_time).toISOString().slice(0, 10)
  )

  let cumulativeTrophies = 0
  const results: DailyTrend[] = []

  for (const [date, group] of grouped) {
    const wins = group.filter(b => isWin(b.result)).length
    const trophyChange = group.reduce((s, b) => s + (b.trophy_change ?? 0), 0)
    cumulativeTrophies += trophyChange

    results.push({
      date,
      wins,
      total: group.length,
      winRate: winRate(wins, group.length),
      trophyChange,
      cumulativeTrophies,
    })
  }

  return results
}

// ── Brawler Mastery (WR evolution over time) ────────────────────

function computeBrawlerMastery(battles: Battle[]): BrawlerMastery[] {
  const grouped = groupBy(battles, b => b.my_brawler?.id ?? 0)
  const results: BrawlerMastery[] = []

  for (const [id, group] of grouped) {
    // Only show mastery for brawlers with enough data
    if (group.length < MIN_GAMES) continue

    // Group by date, accumulate
    const byDate = groupBy(group, b =>
      new Date(b.battle_time).toISOString().slice(0, 10)
    )

    let cumWins = 0, cumTotal = 0
    const points: MasteryPoint[] = []

    for (const [date, dayBattles] of byDate) {
      const dayWins = dayBattles.filter(b => isWin(b.result)).length
      cumWins += dayWins
      cumTotal += dayBattles.length

      points.push({
        date,
        wins: dayWins,
        total: dayBattles.length,
        winRate: winRate(cumWins, cumTotal),
        cumulativeWins: cumWins,
        cumulativeTotal: cumTotal,
      })
    }

    results.push({
      brawlerId: id,
      brawlerName: group[0].my_brawler?.name ?? 'Unknown',
      points,
    })
  }

  // Sort by total games descending
  return results.sort((a, b) => {
    const aTotal = a.points[a.points.length - 1]?.cumulativeTotal ?? 0
    const bTotal = b.points[b.points.length - 1]?.cumulativeTotal ?? 0
    return bTotal - aTotal
  })
}

// ── Tilt Analysis ───────────────────────────────────────────────
// Tilt = 3+ consecutive losses within a session.
// We measure WR *after* entering tilt vs normal play.

function computeTiltAnalysis(battles: Battle[]): TiltAnalysis {
  const sessions = computeSessions(battles)

  let tiltEpisodes = 0
  let tiltWins = 0, tiltTotal = 0
  let normalWins = 0, normalTotal = 0
  let tiltGamesSum = 0

  for (const session of sessions) {
    // Get actual battles in this session
    const sessionBattles = battles.filter(b => {
      const t = b.battle_time
      return t >= session.start && t <= session.end
    })

    let consecutiveLosses = 0
    let inTilt = false
    let tiltGamesThisSession = 0

    for (const b of sessionBattles) {
      if (isLoss(b.result)) {
        consecutiveLosses++
        if (consecutiveLosses >= 3 && !inTilt) {
          inTilt = true
          tiltEpisodes++
        }
      } else {
        consecutiveLosses = 0
      }

      if (inTilt) {
        tiltTotal++
        tiltGamesThisSession++
        if (isWin(b.result)) tiltWins++
      } else {
        normalTotal++
        if (isWin(b.result)) normalWins++
      }
    }

    if (tiltGamesThisSession > 0) {
      tiltGamesSum += tiltGamesThisSession
    }
  }

  const wrAfterTilt = tiltTotal >= MIN_GAMES ? winRate(tiltWins, tiltTotal) : null
  const wrNormal = normalTotal >= MIN_GAMES ? winRate(normalWins, normalTotal) : null
  const avgGamesInTilt = tiltEpisodes > 0 ? Math.round(tiltGamesSum / tiltEpisodes) : 0

  // Suggest stopping if tilt WR is significantly lower than normal
  const shouldStop = wrAfterTilt !== null && wrNormal !== null && (wrNormal - wrAfterTilt) > 15

  return { wrAfterTilt, wrNormal, tiltEpisodes, avgGamesInTilt, shouldStop }
}

// ── Sessions ────────────────────────────────────────────────────

function computeSessions(battles: Battle[]): SessionInfo[] {
  if (battles.length === 0) return []

  const sessions: SessionInfo[] = []
  let sessionStart = battles[0].battle_time
  let sessionEnd = battles[0].battle_time
  let wins = 0, total = 0, trophies = 0

  for (let i = 0; i < battles.length; i++) {
    const b = battles[i]
    const currentTime = new Date(b.battle_time).getTime()
    const prevTime = i > 0 ? new Date(battles[i - 1].battle_time).getTime() : currentTime

    if (i > 0 && currentTime - prevTime > SESSION_GAP_MS) {
      // Close previous session
      sessions.push({
        start: sessionStart,
        end: sessionEnd,
        battles: total,
        wins,
        winRate: winRate(wins, total),
        trophyChange: trophies,
      })
      // Start new session
      sessionStart = b.battle_time
      wins = 0
      total = 0
      trophies = 0
    }

    sessionEnd = b.battle_time
    total++
    if (isWin(b.result)) wins++
    trophies += b.trophy_change ?? 0
  }

  // Close last session
  if (total > 0) {
    sessions.push({
      start: sessionStart,
      end: sessionEnd,
      battles: total,
      wins,
      winRate: winRate(wins, total),
      trophyChange: trophies,
    })
  }

  return sessions
}
