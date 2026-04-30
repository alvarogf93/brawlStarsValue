'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ClubMember } from '@/lib/api'

const CACHE_TTL = 15 * 60 * 1000 // 15 min — member data doesn't change fast
const BATCH_SIZE = 5 // parallel requests per batch
const STORAGE_PREFIX = 'brawlvalue:club-member:'

export interface EnrichedMember extends ClubMember {
  totalGems?: number
  brawlerCount?: number
  powerLevelsGems?: number
  totalVictories?: number
  winRateUsed?: number
  estimatedHoursPlayed?: number
  highestTrophies?: number
  totalPrestigeLevel?: number
  expLevel?: number
  loaded: boolean
  error: boolean
}

interface UseClubEnrichedResult {
  members: EnrichedMember[]
  progress: number // 0-100
  isLoading: boolean
  totalLoaded: number
}

function getCacheKey(tag: string) {
  return `${STORAGE_PREFIX}${tag.toUpperCase().replace('#', '')}`
}

function getCached(tag: string): Partial<EnrichedMember> | null {
  try {
    const raw = localStorage.getItem(getCacheKey(tag))
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (Date.now() - cached._ts > CACHE_TTL) {
      localStorage.removeItem(getCacheKey(tag))
      return null
    }
    return cached
  } catch { return null }
}

function setCache(tag: string, data: Partial<EnrichedMember>) {
  try {
    localStorage.setItem(getCacheKey(tag), JSON.stringify({ ...data, _ts: Date.now() }))
  } catch { /* full storage */ }
}

async function fetchMemberData(tag: string): Promise<Partial<EnrichedMember>> {
  // ARQ-14 — the lightweight /api/player/club-summary endpoint replaces
  // /api/calculate for this fan-out: skips the redundant club lookup and
  // the anonymous-visit tracking, returns only the 9 fields the UI uses,
  // and is rate-limited per IP via Upstash. ~33% faster Supercell-side
  // and a smaller payload over the wire.
  const res = await fetch(
    `/api/player/club-summary?tag=${encodeURIComponent(tag)}`,
    { credentials: 'omit' },
  )
  if (!res.ok) throw new Error(`${res.status}`)
  const data = await res.json()
  return {
    totalGems: data.totalGems,
    brawlerCount: data.brawlerCount ?? 0,
    powerLevelsGems: data.powerLevelsGems ?? 0,
    totalVictories: data.totalVictories ?? 0,
    winRateUsed: data.winRateUsed ?? 0.5,
    estimatedHoursPlayed: data.estimatedHoursPlayed ?? 0,
    highestTrophies: data.highestTrophies ?? 0,
    totalPrestigeLevel: data.totalPrestigeLevel ?? 0,
    expLevel: data.expLevel ?? 0,
  }
}

export function useClubEnriched(members: ClubMember[] | null): UseClubEnrichedResult {
  const [enriched, setEnriched] = useState<Map<string, Partial<EnrichedMember>>>(new Map())
  const [totalLoaded, setTotalLoaded] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const memberCount = members?.length ?? 0

  const loadMembers = useCallback(async (memberList: ClubMember[]) => {
    setIsLoading(true)
    let loaded = 0

    // Process in batches
    for (let i = 0; i < memberList.length; i += BATCH_SIZE) {
      const batch = memberList.slice(i, i + BATCH_SIZE)

      const results = await Promise.allSettled(
        batch.map(async (m) => {
          // Check cache first
          const cached = getCached(m.tag)
          if (cached) return { tag: m.tag, data: cached }

          const data = await fetchMemberData(m.tag)
          setCache(m.tag, data)
          return { tag: m.tag, data }
        })
      )

      setEnriched(prev => {
        const next = new Map(prev)
        for (const result of results) {
          if (result.status === 'fulfilled') {
            next.set(result.value.tag, result.value.data)
          } else {
            // Mark as errored
            loaded++ // still count
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
    loadMembers(members)
  }, [members, loadMembers])

  // Merge enriched data with original members
  const result: EnrichedMember[] = (members ?? []).map(m => ({
    ...m,
    ...enriched.get(m.tag),
    loaded: enriched.has(m.tag),
    error: false,
  }))

  const progress = memberCount > 0 ? Math.round((totalLoaded / memberCount) * 100) : 0

  return { members: result, progress, isLoading, totalLoaded }
}
