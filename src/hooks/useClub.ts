'use client'

import { useEffect, useState } from 'react'
import type { ClubResponse } from '@/lib/api'

const CACHE_TTL = 10 * 60 * 1000 // 10 min

function getCacheKey(tag: string) { return `brawlvalue:club:${tag.toUpperCase()}` }

export function useClub(clubTag: string | null) {
  const [data, setData] = useState<ClubResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clubTag) return

    try {
      const raw = localStorage.getItem(getCacheKey(clubTag))
      if (raw) {
        const cached = JSON.parse(raw)
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          setData(cached.data)
          return
        }
      }
    } catch { /* ignore */ }

    setIsLoading(true)
    fetch('/api/club', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubTag }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`)
        return res.json()
      })
      .then((result: ClubResponse) => {
        setData(result)
        try { localStorage.setItem(getCacheKey(clubTag), JSON.stringify({ data: result, timestamp: Date.now() })) } catch { /* ignore */ }
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [clubTag])

  return { data, isLoading, error }
}
