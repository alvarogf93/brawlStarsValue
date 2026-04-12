'use client'

import { useState, useEffect, useCallback } from 'react'

const CACHE_TTL = 5 * 60 * 1000
const BATCH_SIZE = 3
const STORAGE_PREFIX = 'brawlvalue:club-tc:'

/** Per-battle data point for the chart */
export interface BattlePoint {
  change: number
  cumulative: number
  result: 'victory' | 'defeat' | 'draw'
  mode: string
  map: string
  isStarPlayer: boolean
}

export interface MemberTrophyChange {
  tag: string
  name: string
  netChange: number
  totalBattles: number
  progression: number[]
  /** Detailed per-battle data for rich tooltips */
  battlePoints: BattlePoint[]
  loaded: boolean
}

interface CachedData {
  netChange: number
  totalBattles: number
  progression: number[]
  battlePoints: BattlePoint[]
  _ts: number
}

function getCacheKey(tag: string) {
  return `${STORAGE_PREFIX}${tag.toUpperCase().replace('#', '')}`
}

function getCached(tag: string): Omit<CachedData, '_ts'> | null {
  try {
    const raw = localStorage.getItem(getCacheKey(tag))
    if (!raw) return null
    const cached: CachedData = JSON.parse(raw)
    if (Date.now() - cached._ts > CACHE_TTL) return null
    return { netChange: cached.netChange, totalBattles: cached.totalBattles, progression: cached.progression, battlePoints: cached.battlePoints }
  } catch { return null }
}

function setCache(tag: string, data: Omit<CachedData, '_ts'>) {
  try {
    localStorage.setItem(getCacheKey(tag), JSON.stringify({ ...data, _ts: Date.now() }))
  } catch { /* full storage */ }
}

interface FetchResult {
  netChange: number
  totalBattles: number
  progression: number[]
  battlePoints: BattlePoint[]
}

async function fetchTrophyChange(tag: string): Promise<FetchResult> {
  const res = await fetch('/api/battlelog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerTag: tag }),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  const data = await res.json()
  const battles = data.items || []

  // Build detailed progression (oldest first)
  const reversed = [...battles].reverse()
  let cum = 0
  const progression: number[] = []
  const battlePoints: BattlePoint[] = []

  for (const b of reversed) {
    const change = b.battle?.trophyChange ?? 0
    cum += change
    progression.push(cum)
    battlePoints.push({
      change,
      cumulative: cum,
      result: b.battle?.result ?? 'draw',
      mode: b.battle?.mode || b.event?.mode || '',
      map: b.event?.map || '',
      isStarPlayer: b.battle?.starPlayer?.tag === tag,
    })
  }

  return { netChange: cum, totalBattles: battles.length, progression, battlePoints }
}

export function useClubTrophyChanges(members: { tag: string; name: string }[] | null) {
  const [results, setResults] = useState<Map<string, FetchResult>>(new Map())
  const [totalLoaded, setTotalLoaded] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const load = useCallback(async (list: { tag: string; name: string }[]) => {
    setIsLoading(true)
    let loaded = 0

    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      const batch = list.slice(i, i + BATCH_SIZE)

      const settled = await Promise.allSettled(
        batch.map(async (m) => {
          const cached = getCached(m.tag)
          if (cached) return { tag: m.tag, ...cached }
          const data = await fetchTrophyChange(m.tag)
          setCache(m.tag, data)
          return { tag: m.tag, ...data }
        })
      )

      setResults(prev => {
        const next = new Map(prev)
        for (const r of settled) {
          if (r.status === 'fulfilled') {
            next.set(r.value.tag, {
              netChange: r.value.netChange,
              totalBattles: r.value.totalBattles,
              progression: r.value.progression,
              battlePoints: r.value.battlePoints,
            })
          }
        }
        return next
      })

      loaded += batch.length
      setTotalLoaded(loaded)
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!members?.length) return
    // load() is a useCallback that internally setStates (results map +
    // isLoading). This is the classic on-mount fetch pattern; the
    // alternative (derived state over members) would recompute on every
    // render which is worse for a hook with N async fetches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(members)
  }, [members, load])

  const data: MemberTrophyChange[] = (members ?? []).map(m => {
    const result = results.get(m.tag)
    return {
      tag: m.tag,
      name: m.name,
      netChange: result?.netChange ?? 0,
      totalBattles: result?.totalBattles ?? 0,
      progression: result?.progression ?? [],
      battlePoints: result?.battlePoints ?? [],
      loaded: results.has(m.tag),
    }
  })

  const progress = members?.length ? Math.round((totalLoaded / members.length) * 100) : 0

  return { data, progress, isLoading, totalLoaded }
}
