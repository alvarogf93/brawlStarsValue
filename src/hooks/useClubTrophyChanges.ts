'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { readLocalCache, writeLocalCache } from '@/lib/local-cache'

const CACHE_TTL = 5 * 60 * 1000
const BATCH_SIZE = 3
const STORAGE_PREFIX = 'brawlvalue:club-tc:'
// LOG-13 — bump on changes to FetchResult shape (BattlePoint, progression).
const CACHE_VERSION = 1

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
}

function getCacheKey(tag: string) {
  return `${STORAGE_PREFIX}${tag.toUpperCase().replace('#', '')}`
}

function getCached(tag: string): CachedData | null {
  return readLocalCache<CachedData>(getCacheKey(tag), CACHE_VERSION, CACHE_TTL)
}

function setCache(tag: string, data: CachedData) {
  writeLocalCache(getCacheKey(tag), CACHE_VERSION, data)
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

  // LOG-11 — abort controller for the cross-batch load. Without it, when
  // `members` changes mid-load (user picks a different club, or the parent
  // hook refreshes), the current Promise.allSettled keeps resolving and
  // setResults() merges rows from the OLD club into the new state map.
  // The visible symptom was 30+ seconds of mixed-club rows after a switch.
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback(async (
    list: { tag: string; name: string }[],
    signal: AbortSignal,
  ) => {
    setIsLoading(true)
    let loaded = 0

    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      if (signal.aborted) return
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

      // Drop the batch entirely if a newer load() has started — no torn
      // state, no half-loaded mix from the old club.
      if (signal.aborted) return

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

    if (!signal.aborted) setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!members?.length) return
    // Cancel any in-flight load (previous club). load() reads the signal
    // between every fetch boundary; once aborted, it returns without
    // mutating state. The new controller drives the new load.
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    // Reset accumulated state so the previous club's rows don't briefly
    // leak into the new render before the first batch lands.
    setResults(new Map())
    setTotalLoaded(0)
    // load() is a useCallback that internally setStates (results map +
    // isLoading). This is the classic on-mount fetch pattern; the
    // alternative (derived state over members) would recompute on every
    // render which is worse for a hook with N async fetches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(members, controller.signal)
    return () => controller.abort()
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
