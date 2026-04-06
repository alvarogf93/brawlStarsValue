import type { Battle } from '@/lib/supabase/types'

export interface ModeStats { mode: string; wins: number; total: number; winRate: number }
export interface BrawlerStats { id: number; name: string; wins: number; total: number; winRate: number }
export interface MapStats { map: string; wins: number; total: number; winRate: number }
export interface TeammateStats { tag: string; name: string; gamesPlayed: number; wins: number; winRate: number }

export interface Analytics {
  overallWinRate: number
  totalBattles: number
  totalWins: number
  trophyChange: number
  starPlayerCount: number
  byMode: ModeStats[]
  byBrawler: BrawlerStats[]
  byMap: MapStats[]
  bestTeammates: TeammateStats[]
}

export function aggregateAnalytics(battles: Battle[]): Analytics {
  if (battles.length === 0) {
    return { overallWinRate: 0, totalBattles: 0, totalWins: 0, trophyChange: 0, starPlayerCount: 0, byMode: [], byBrawler: [], byMap: [], bestTeammates: [] }
  }

  const totalWins = battles.filter(b => b.result === 'victory').length
  const trophyChange = battles.reduce((sum, b) => sum + (b.trophy_change ?? 0), 0)
  const starPlayerCount = battles.filter(b => b.is_star_player).length

  // By mode
  const modeMap = new Map<string, { wins: number; total: number }>()
  for (const b of battles) {
    const entry = modeMap.get(b.mode) ?? { wins: 0, total: 0 }
    entry.total++
    if (b.result === 'victory') entry.wins++
    modeMap.set(b.mode, entry)
  }
  const byMode = [...modeMap.entries()]
    .map(([mode, s]) => ({ mode, ...s, winRate: Math.round((s.wins / s.total) * 100) }))
    .sort((a, b) => b.total - a.total)

  // By brawler
  const brawlerMap = new Map<string, { id: number; wins: number; total: number }>()
  for (const b of battles) {
    const key = b.my_brawler.name
    const entry = brawlerMap.get(key) ?? { id: b.my_brawler.id, wins: 0, total: 0 }
    entry.total++
    if (b.result === 'victory') entry.wins++
    brawlerMap.set(key, entry)
  }
  const byBrawler = [...brawlerMap.entries()]
    .map(([name, s]) => ({ name, ...s, winRate: Math.round((s.wins / s.total) * 100) }))
    .sort((a, b) => b.total - a.total)

  // By map
  const mapMap = new Map<string, { wins: number; total: number }>()
  for (const b of battles) {
    if (!b.map) continue
    const entry = mapMap.get(b.map) ?? { wins: 0, total: 0 }
    entry.total++
    if (b.result === 'victory') entry.wins++
    mapMap.set(b.map, entry)
  }
  const byMap = [...mapMap.entries()]
    .map(([map, s]) => ({ map, ...s, winRate: Math.round((s.wins / s.total) * 100) }))
    .sort((a, b) => b.total - a.total)

  // Best teammates
  const tmMap = new Map<string, { name: string; wins: number; total: number }>()
  for (const b of battles) {
    for (const tm of (b.teammates ?? [])) {
      const entry = tmMap.get(tm.tag) ?? { name: tm.name, wins: 0, total: 0 }
      entry.total++
      if (b.result === 'victory') entry.wins++
      tmMap.set(tm.tag, entry)
    }
  }
  const bestTeammates = [...tmMap.entries()]
    .map(([tag, s]) => ({ tag, name: s.name, gamesPlayed: s.total, wins: s.wins, winRate: Math.round((s.wins / s.total) * 100) }))
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
    .slice(0, 10)

  return { overallWinRate: Math.round((totalWins / battles.length) * 100), totalBattles: battles.length, totalWins, trophyChange, starPlayerCount, byMode, byBrawler, byMap, bestTeammates }
}
