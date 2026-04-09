import type { Battle } from '@/lib/supabase/types'
import type {
  AdvancedAnalytics, BrawlerPerformance, ModePerformance, MapPerformance,
  BrawlerMapEntry, BrawlerModeEntry, MatchupEntry, TrioSynergy,
  TeammateSynergy, HourPerformance, DailyTrend, BrawlerMastery, MasteryPoint,
  StreakInfo, TiltAnalysis, SessionInfo,
  ClutchAnalysis, OpponentStrengthBreakdown, BrawlerComfort, PowerLevelImpact,
  SessionEfficiency, WarmUpAnalysis, CarryAnalysis, GadgetStarPowerImpact,
  RecoveryAnalysis, WeeklyPattern,
} from './types'
import { MIN_GAMES, MIN_GAMES_SOFT, CONFIDENT_GAMES, getConfidence } from './types'
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
export function computeAdvancedAnalytics(rawBattles: Battle[], timezone?: string): AdvancedAnalytics {
  // Sort oldest-first for time-series analysis
  const battles = [...rawBattles].sort(
    (a, b) => new Date(a.battle_time).getTime() - new Date(b.battle_time).getTime()
  )

  const sessions = computeSessions(battles)

  return {
    overview: computeOverview(battles),
    byBrawler: computeByBrawler(battles),
    byMode: computeByMode(battles),
    byMap: computeByMap(battles),
    brawlerMapMatrix: computeBrawlerMapMatrix(battles),
    brawlerModeMatrix: computeBrawlerModeMatrix(battles),
    matchups: computeMatchups(battles),
    trioSynergy: computeTrioSynergy(battles),
    teammateSynergy: computeTeammateSynergy(battles),
    byHour: computeByHour(battles, timezone),
    dailyTrend: computeDailyTrend(battles),
    brawlerMastery: computeBrawlerMastery(battles),
    tilt: computeTiltAnalysis(battles),
    sessions,
    // New metrics
    clutch: computeClutch(battles),
    opponentStrength: computeOpponentStrength(battles),
    brawlerComfort: computeBrawlerComfort(battles),
    powerLevelImpact: computePowerLevelImpact(battles),
    sessionEfficiency: computeSessionEfficiency(sessions),
    warmUp: computeWarmUp(battles, sessions),
    carry: computeCarry(battles),
    gadgetImpact: computeGadgetImpact(battles),
    recovery: computeRecovery(battles, sessions),
    weeklyPattern: computeWeeklyPattern(battles, timezone),
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
      confidence: getConfidence(total),
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
      confidence: getConfidence(group.length),
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
      confidence: getConfidence(group.length),
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
      confidence: getConfidence(val.total),
    })
  }

  return results.sort((a, b) => b.total - a.total)
}

// ── Trio Synergy (full 3-brawler teams) ──────────────────────────

// Standard competitive 3v3 modes — exclude PvE, special events, showdown
const STANDARD_3V3_MODES = new Set([
  'gemGrab', 'brawlBall', 'bounty', 'heist', 'hotZone',
  'knockout', 'wipeout', 'siege', 'basketBrawl', 'volleyBrawl',
  'paintBrawl', 'trophyThieves', 'holdTheTrophy', 'botDrop',
])

function computeTrioSynergy(battles: Battle[]): TrioSynergy[] {
  const acc = new Map<string, { wins: number; total: number; brawlers: Array<{ id: number; name: string }> }>()

  for (const b of battles) {
    // Only standard 3v3 modes
    if (!STANDARD_3V3_MODES.has(b.mode)) continue

    const myId = b.my_brawler?.id ?? 0
    const myName = b.my_brawler?.name ?? 'Unknown'
    const teammates = (b.teammates ?? []) as Array<{ brawler: { id: number; name: string } }>

    if (teammates.length !== 2) continue // Exactly 3v3

    // Sort by ID: ABC = ACB = BAC = BCA = CAB = CBA → same trio
    const trio = [
      { id: myId, name: myName },
      { id: teammates[0].brawler.id, name: teammates[0].brawler.name },
      { id: teammates[1].brawler.id, name: teammates[1].brawler.name },
    ].sort((a, b) => a.id - b.id)

    const key = trio.map(b => b.id).join(':')
    const entry = acc.get(key) ?? { wins: 0, total: 0, brawlers: trio }
    entry.total++
    if (isWin(b.result)) entry.wins++
    acc.set(key, entry)
  }

  const results: TrioSynergy[] = []
  for (const [, val] of acc) {
    if (val.total < MIN_GAMES_SOFT) continue
    results.push({
      brawlers: val.brawlers,
      wins: val.wins,
      total: val.total,
      winRate: winRate(val.wins, val.total),
      wilsonScore: wilsonPct(val.wins, val.total),
      confidence: getConfidence(val.total),
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
      confidence: getConfidence(val.total),
      bestMode, bestModeWR,
    })
  }

  return results.sort((a, b) => b.total - a.total)
}

// ── By Hour of Day ──────────────────────────────────────────────

function computeByHour(battles: Battle[], timezone?: string): HourPerformance[] {
  const hours: Array<{ wins: number; total: number }> = Array.from(
    { length: 24 }, () => ({ wins: 0, total: 0 })
  )

  for (const b of battles) {
    let h: number
    if (timezone) {
      // Convert to player's local timezone
      const localHour = new Date(b.battle_time).toLocaleString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      })
      h = parseInt(localHour, 10)
    } else {
      h = new Date(b.battle_time).getUTCHours()
    }
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
        inTilt = false
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

// ══════════════════════════════════════════════════════════════
//  NEW METRICS
// ══════════════════════════════════════════════════════════════

// ── Clutch Factor (Star Player correlation) ────────────────

function computeClutch(battles: Battle[]): ClutchAnalysis {
  const starBattles = battles.filter(b => b.is_star_player)
  const nonStarBattles = battles.filter(b => !b.is_star_player)
  const starWins = starBattles.filter(b => isWin(b.result)).length
  const nonStarWins = nonStarBattles.filter(b => isWin(b.result)).length

  const wrAsStar = starBattles.length >= MIN_GAMES ? winRate(starWins, starBattles.length) : null
  const wrNotStar = nonStarBattles.length >= MIN_GAMES ? winRate(nonStarWins, nonStarBattles.length) : null
  const delta = wrAsStar !== null && wrNotStar !== null ? Math.round((wrAsStar - wrNotStar) * 10) / 10 : null

  return { wrAsStar, wrNotStar, starGames: starBattles.length, nonStarGames: nonStarBattles.length, delta }
}

// ── Opponent Strength Index ────────────────────────────────

function computeOpponentStrength(battles: Battle[]): OpponentStrengthBreakdown[] {
  const tiers: Array<{ tier: 'weak' | 'even' | 'strong'; wins: number; total: number; trophySum: number }> = [
    { tier: 'weak', wins: 0, total: 0, trophySum: 0 },
    { tier: 'even', wins: 0, total: 0, trophySum: 0 },
    { tier: 'strong', wins: 0, total: 0, trophySum: 0 },
  ]

  for (const b of battles) {
    const myTrophies = b.my_brawler?.trophies ?? 0
    const opponents = (b.opponents ?? []) as Array<{ brawler: { trophies: number } }>
    if (opponents.length === 0) continue

    const avgOppTrophies = opponents.reduce((s, o) => s + (o.brawler.trophies ?? 0), 0) / opponents.length
    const diff = avgOppTrophies - myTrophies

    const tierIdx = diff < -50 ? 0 : diff > 50 ? 2 : 1
    tiers[tierIdx].total++
    tiers[tierIdx].trophySum += avgOppTrophies
    if (isWin(b.result)) tiers[tierIdx].wins++
  }

  return tiers.map(t => ({
    tier: t.tier,
    wins: t.wins,
    total: t.total,
    winRate: winRate(t.wins, t.total),
    avgOpponentTrophies: t.total > 0 ? Math.round(t.trophySum / t.total) : 0,
  }))
}

// ── Brawler Comfort Score ──────────────────────────────────

function computeBrawlerComfort(battles: Battle[]): BrawlerComfort[] {
  const grouped = groupBy(battles, b => b.my_brawler?.id ?? 0)
  const maxGames = Math.max(1, ...Array.from(grouped.values()).map(g => g.length))
  const results: BrawlerComfort[] = []

  for (const [id, group] of grouped) {
    if (group.length < CONFIDENT_GAMES) continue
    const wins = group.filter(b => isWin(b.result)).length
    const wr = winRate(wins, group.length)
    const wilson = wilsonPct(wins, group.length)
    // Consistency: std dev of results (0=loss, 1=win)
    const outcomes: number[] = group.map(b => isWin(b.result) ? 1 : 0)
    const mean = outcomes.reduce((s, v) => s + v, 0) / outcomes.length
    const variance = outcomes.reduce((s, v) => s + (v - mean) ** 2, 0) / outcomes.length
    const consistency = 1 - Math.sqrt(variance) // higher = more consistent

    const comfort = Math.round(
      wilson * 0.6 + (group.length / maxGames) * 30 + consistency * 10
    )

    results.push({
      brawlerId: id,
      brawlerName: group[0].my_brawler?.name ?? 'Unknown',
      comfortScore: Math.min(100, comfort),
      gamesPlayed: group.length,
      winRate: wr,
      wilsonScore: wilson,
      consistency,
    })
  }

  return results.sort((a, b) => b.comfortScore - a.comfortScore).slice(0, 10)
}

// ── Power Level Impact ─────────────────────────────────────

function computePowerLevelImpact(battles: Battle[]): PowerLevelImpact[] {
  const grouped = groupBy(battles, b => b.my_brawler?.power ?? 0)
  const results: PowerLevelImpact[] = []

  for (const [power, group] of grouped) {
    if (power === 0) continue
    const wins = group.filter(b => isWin(b.result)).length
    results.push({
      powerLevel: power,
      wins,
      total: group.length,
      winRate: winRate(wins, group.length),
    })
  }

  return results.sort((a, b) => a.powerLevel - b.powerLevel)
}

// ── Session Efficiency ─────────────────────────────────────

function computeSessionEfficiency(sessions: SessionInfo[]): SessionEfficiency[] {
  // Group sessions by length buckets: 1-3, 4-6, 7-10, 11-15, 16+
  const buckets: Array<{ min: number; max: number; label: number }> = [
    { min: 1, max: 3, label: 3 },
    { min: 4, max: 6, label: 6 },
    { min: 7, max: 10, label: 10 },
    { min: 11, max: 15, label: 15 },
    { min: 16, max: Infinity, label: 20 },
  ]

  return buckets.map(bucket => {
    const matching = sessions.filter(s => s.battles >= bucket.min && s.battles <= bucket.max)
    if (matching.length === 0) return { sessionLength: bucket.label, count: 0, avgWinRate: 0, avgTrophiesPerGame: 0 }

    const totalGames = matching.reduce((s, m) => s + m.battles, 0)
    const totalTrophies = matching.reduce((s, m) => s + m.trophyChange, 0)
    const avgWR = matching.reduce((s, m) => s + m.winRate, 0) / matching.length

    return {
      sessionLength: bucket.label,
      count: matching.length,
      avgWinRate: Math.round(avgWR * 10) / 10,
      avgTrophiesPerGame: totalGames > 0 ? Math.round((totalTrophies / totalGames) * 10) / 10 : 0,
    }
  }).filter(b => b.count > 0)
}

// ── Warm-Up Analysis ───────────────────────────────────────

function computeWarmUp(battles: Battle[], sessions: SessionInfo[]): WarmUpAnalysis {
  let warmUpWins = 0, warmUpTotal = 0
  let peakWins = 0, peakTotal = 0

  for (const session of sessions) {
    const sessionBattles = battles.filter(b => b.battle_time >= session.start && b.battle_time <= session.end)
    sessionBattles.forEach((b, idx) => {
      if (idx < 2) {
        warmUpTotal++
        if (isWin(b.result)) warmUpWins++
      } else {
        peakTotal++
        if (isWin(b.result)) peakWins++
      }
    })
  }

  const wrWarmUp = warmUpTotal >= MIN_GAMES ? winRate(warmUpWins, warmUpTotal) : null
  const wrPeak = peakTotal >= MIN_GAMES ? winRate(peakWins, peakTotal) : null
  const delta = wrWarmUp !== null && wrPeak !== null ? Math.round((wrPeak - wrWarmUp) * 10) / 10 : null

  return { warmUpWR: wrWarmUp, peakWR: wrPeak, warmUpGames: warmUpTotal, peakGames: peakTotal, delta }
}

// ── Carry Analysis ─────────────────────────────────────────

function computeCarry(battles: Battle[]): CarryAnalysis {
  let carryWins = 0, carryTotal = 0
  let normalWins = 0, normalTotal = 0

  for (const b of battles) {
    const teammates = (b.teammates ?? []) as Array<{ brawler: { trophies: number } }>
    const opponents = (b.opponents ?? []) as Array<{ brawler: { trophies: number } }>
    if (teammates.length === 0 || opponents.length === 0) continue

    const myTrophies = b.my_brawler?.trophies ?? 0
    const teamAvg = (teammates.reduce((s, t) => s + (t.brawler.trophies ?? 0), 0) + myTrophies) / (teammates.length + 1)
    const oppAvg = opponents.reduce((s, o) => s + (o.brawler.trophies ?? 0), 0) / opponents.length

    if (teamAvg < oppAvg - 30) {
      carryTotal++
      if (isWin(b.result)) carryWins++
    } else {
      normalTotal++
      if (isWin(b.result)) normalWins++
    }
  }

  return {
    carryWR: carryTotal >= MIN_GAMES ? winRate(carryWins, carryTotal) : null,
    normalWR: normalTotal >= MIN_GAMES ? winRate(normalWins, normalTotal) : null,
    carryGames: carryTotal,
    normalGames: normalTotal,
  }
}

// ── Gadget / Star Power Impact ─────────────────────────────

function computeGadgetImpact(battles: Battle[]): GadgetStarPowerImpact {
  const withG = battles.filter(b => (b.my_brawler?.gadgets?.length ?? 0) > 0)
  const withoutG = battles.filter(b => (b.my_brawler?.gadgets?.length ?? 0) === 0)
  const withSP = battles.filter(b => (b.my_brawler?.starPowers?.length ?? 0) > 0)
  const withoutSP = battles.filter(b => (b.my_brawler?.starPowers?.length ?? 0) === 0)

  const calc = (arr: Battle[]) => ({
    wins: arr.filter(b => isWin(b.result)).length,
    total: arr.length,
    winRate: winRate(arr.filter(b => isWin(b.result)).length, arr.length),
  })

  return {
    withGadgets: calc(withG),
    withoutGadgets: calc(withoutG),
    withStarPowers: calc(withSP),
    withoutStarPowers: calc(withoutSP),
  }
}

// ── Recovery Speed ─────────────────────────────────────────

function computeRecovery(battles: Battle[], sessions: SessionInfo[]): RecoveryAnalysis {
  let totalGamesToRecover = 0
  let recoveryEpisodes = 0
  let successfulRecoveries = 0

  for (const session of sessions) {
    const sessionBattles = battles.filter(b => b.battle_time >= session.start && b.battle_time <= session.end)
    let consecutiveLosses = 0
    let tiltTrophyDebt = 0
    let inRecovery = false

    for (const b of sessionBattles) {
      const change = b.trophy_change ?? 0

      if (!inRecovery && isLoss(b.result)) {
        consecutiveLosses++
        if (consecutiveLosses >= 3) {
          inRecovery = true
          tiltTrophyDebt = change // already negative
          recoveryEpisodes++
        }
      } else if (inRecovery) {
        tiltTrophyDebt += change
        totalGamesToRecover++
        if (tiltTrophyDebt >= 0) {
          successfulRecoveries++
          inRecovery = false
          consecutiveLosses = 0
          tiltTrophyDebt = 0
        }
      } else {
        consecutiveLosses = 0
      }
    }
  }

  return {
    avgGamesToRecover: recoveryEpisodes > 0 ? Math.round(totalGamesToRecover / recoveryEpisodes) : null,
    recoveryEpisodes,
    successRate: recoveryEpisodes > 0 ? winRate(successfulRecoveries, recoveryEpisodes) : null,
  }
}

// ── Weekly Pattern ─────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function computeWeeklyPattern(battles: Battle[], timezone?: string): WeeklyPattern[] {
  const days = Array.from({ length: 7 }, () => ({ wins: 0, total: 0 }))

  for (const b of battles) {
    let dayIdx: number
    if (timezone) {
      const localDay = new Date(b.battle_time).toLocaleString('en-US', {
        timeZone: timezone, weekday: 'short',
      })
      const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
      dayIdx = map[localDay] ?? new Date(b.battle_time).getDay()
    } else {
      dayIdx = new Date(b.battle_time).getUTCDay()
    }
    days[dayIdx].total++
    if (isWin(b.result)) days[dayIdx].wins++
  }

  return days.map((d, i) => ({
    dayOfWeek: i,
    dayName: DAY_NAMES[i],
    wins: d.wins,
    total: d.total,
    winRate: winRate(d.wins, d.total),
  }))
}
