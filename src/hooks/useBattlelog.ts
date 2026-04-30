'use client'

import { useEffect, useState } from 'react'
import type { BattlelogEntry } from '@/lib/api'
import { readLocalCache, writeLocalCache } from '@/lib/local-cache'

const CACHE_TTL = 2 * 60 * 1000 // 2 min
// LOG-13 — bump when BattleStats shape changes (new field, renamed key,
// changed nesting). Old payloads with a different version are dropped on
// read, avoiding `undefined` crashes in consumers that destructure the
// new shape.
const CACHE_VERSION = 1

export interface ModeWinRate {
  mode: string
  wins: number
  losses: number
  draws: number
  total: number
  winRate: number
}

export interface TeammateStats {
  tag: string
  name: string
  gamesPlayed: number
  wins: number
  winRate: number
}

interface BattleStats {
  battles: BattlelogEntry[]
  recentWins: number
  recentLosses: number
  recentDraws: number
  winRate: number
  mostPlayedMode: string
  mostPlayedBrawler: string
  avgDuration: number
  trophyChange: number
  starPlayerCount: number
  starPlayerPct: number
  modeWinRates: ModeWinRate[]
  teammates: TeammateStats[]
}

function getCacheKey(tag: string) { return `brawlvalue:battlelog:${tag.toUpperCase()}` }

export function useBattlelog(tag: string) {
  const [data, setData] = useState<BattleStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tag) return

    // Check localStorage cache (version + TTL aware). Cache-hit on mount is
    // the classic pattern; moving to derived state would couple cache reads
    // to render and break SSR/hydration.
    const cached = readLocalCache<BattleStats>(getCacheKey(tag), CACHE_VERSION, CACHE_TTL)
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(cached)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    fetch('/api/battlelog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerTag: tag }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`)
        return res.json()
      })
      .then((response) => {
        const battles: BattlelogEntry[] = response.items || []
        const stats = analyzeBattles(battles, tag)
        setData(stats)
        writeLocalCache(getCacheKey(tag), CACHE_VERSION, stats)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [tag])

  return { data, isLoading, error }
}

function analyzeBattles(battles: BattlelogEntry[], playerTag: string): BattleStats {
  let wins = 0, losses = 0, draws = 0, totalDuration = 0, trophyChange = 0, starPlayerCount = 0
  const modeCount: Record<string, number> = {}
  const brawlerCount: Record<string, number> = {}
  const modeStats: Record<string, { wins: number; losses: number; draws: number }> = {}
  const teammateMap: Record<string, { name: string; games: number; wins: number }> = {}

  for (const b of battles) {
    const result = b.battle.result
    if (result === 'victory') wins++
    else if (result === 'defeat') losses++
    else draws++

    totalDuration += b.battle.duration || 0
    trophyChange += b.battle.trophyChange || 0

    // Star Player
    if (b.battle.starPlayer?.tag === playerTag) starPlayerCount++

    // Mode
    const mode = b.battle.mode || b.event.mode
    modeCount[mode] = (modeCount[mode] || 0) + 1
    if (!modeStats[mode]) modeStats[mode] = { wins: 0, losses: 0, draws: 0 }
    if (result === 'victory') modeStats[mode].wins++
    else if (result === 'defeat') modeStats[mode].losses++
    else modeStats[mode].draws++

    // Find player + teammates in teams
    const allPlayers = (b.battle.teams || []).flat().concat(b.battle.players || [])
    const me = allPlayers.find(p => p.tag === playerTag)
    if (me) {
      brawlerCount[me.brawler.name] = (brawlerCount[me.brawler.name] || 0) + 1
    }

    // Teammate analysis (same team only, 3v3 modes)
    if (b.battle.teams) {
      const myTeam = b.battle.teams.find(team => team.some(p => p.tag === playerTag))
      if (myTeam) {
        for (const p of myTeam) {
          if (p.tag === playerTag) continue
          if (!teammateMap[p.tag]) teammateMap[p.tag] = { name: p.name, games: 0, wins: 0 }
          teammateMap[p.tag].games++
          if (result === 'victory') teammateMap[p.tag].wins++
        }
      }
    }
  }

  const total = wins + losses + draws
  const mostPlayedMode = Object.entries(modeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
  const mostPlayedBrawler = Object.entries(brawlerCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'

  // Win rate per mode
  const modeWinRates: ModeWinRate[] = Object.entries(modeStats)
    .map(([mode, s]) => {
      const t = s.wins + s.losses + s.draws
      return { mode, ...s, total: t, winRate: t > 0 ? Math.round((s.wins / t) * 100) : 0 }
    })
    .sort((a, b) => b.total - a.total)

  // Top teammates
  const teammates: TeammateStats[] = Object.entries(teammateMap)
    .map(([tag, s]) => ({ tag, name: s.name, gamesPlayed: s.games, wins: s.wins, winRate: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0 }))
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
    .slice(0, 10)

  return {
    battles,
    recentWins: wins,
    recentLosses: losses,
    recentDraws: draws,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    mostPlayedMode,
    mostPlayedBrawler,
    avgDuration: total > 0 ? Math.round(totalDuration / total) : 0,
    trophyChange,
    starPlayerCount,
    starPlayerPct: total > 0 ? Math.round((starPlayerCount / total) * 100) : 0,
    modeWinRates,
    teammates,
  }
}
