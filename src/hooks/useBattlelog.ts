'use client'

import { useEffect, useState } from 'react'
import type { BattlelogEntry } from '@/lib/api'

const CACHE_TTL = 2 * 60 * 1000 // 2 min

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
}

function getCacheKey(tag: string) { return `brawlvalue:battlelog:${tag.toUpperCase()}` }

export function useBattlelog(tag: string) {
  const [data, setData] = useState<BattleStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tag) return

    // Check cache
    try {
      const raw = localStorage.getItem(getCacheKey(tag))
      if (raw) {
        const cached = JSON.parse(raw)
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          setData(cached.data)
          setIsLoading(false)
          return
        }
      }
    } catch { /* ignore */ }

    setIsLoading(true)
    fetch('/api/battlelog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerTag: tag }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`)
        return res.json()
      })
      .then((response) => {
        const battles: BattlelogEntry[] = response.items || []
        const stats = analyzeBattles(battles, tag)
        setData(stats)
        try { localStorage.setItem(getCacheKey(tag), JSON.stringify({ data: stats, timestamp: Date.now() })) } catch { /* ignore */ }
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [tag])

  return { data, isLoading, error }
}

function analyzeBattles(battles: BattlelogEntry[], playerTag: string): BattleStats {
  let wins = 0, losses = 0, draws = 0, totalDuration = 0, trophyChange = 0
  const modeCount: Record<string, number> = {}
  const brawlerCount: Record<string, number> = {}

  for (const b of battles) {
    if (b.battle.result === 'victory') wins++
    else if (b.battle.result === 'defeat') losses++
    else draws++

    totalDuration += b.battle.duration || 0
    trophyChange += b.battle.trophyChange || 0

    // Mode
    const mode = b.battle.mode || b.event.mode
    modeCount[mode] = (modeCount[mode] || 0) + 1

    // Find player's brawler in teams
    const allPlayers = (b.battle.teams || []).flat().concat(b.battle.players || [])
    const me = allPlayers.find(p => p.tag === playerTag)
    if (me) {
      brawlerCount[me.brawler.name] = (brawlerCount[me.brawler.name] || 0) + 1
    }
  }

  const total = wins + losses + draws
  const mostPlayedMode = Object.entries(modeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
  const mostPlayedBrawler = Object.entries(brawlerCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'

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
  }
}
