'use client'

import { useEffect, useState } from 'react'
import type { ClubResponse } from '@/lib/api'
import { readLocalCache, writeLocalCache } from '@/lib/local-cache'

const CACHE_TTL = 10 * 60 * 1000 // 10 min
// LOG-13 — bump on changes to ClubResponse shape from /api/club.
const CACHE_VERSION = 1

function getCacheKey(tag: string) { return `brawlvalue:club:${tag.toUpperCase()}` }

export function useClub(clubTag: string | null) {
  const [data, setData] = useState<ClubResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clubTag) return

    const cached = readLocalCache<ClubResponse>(
      getCacheKey(clubTag),
      CACHE_VERSION,
      CACHE_TTL,
    )
    if (cached) {
      // Cache-hit on mount — setState here is intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(cached)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    fetch('/api/club', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubTag }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`)
        return res.json()
      })
      .then((result: ClubResponse) => {
        setData(result)
        writeLocalCache(getCacheKey(clubTag), CACHE_VERSION, result)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [clubTag])

  return { data, isLoading, error }
}
