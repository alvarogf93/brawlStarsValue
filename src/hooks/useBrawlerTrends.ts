'use client'

import { useEffect, useState } from 'react'

/**
 * Bulk trend hook: loads `{ brawlerId: trend7dDelta | null }` for
 * every brawler once, cached in localStorage for 10 minutes. Used
 * by the `/brawlers` roster page to show a per-card trend badge
 * and offer a "sort by trend" option.
 *
 * `null` means the API couldn't compute a trend for that brawler
 * (insufficient battles in either the recent or previous 7-day
 * window — see `compute7dTrend`).
 *
 * Consumers should treat an empty object as "loading, no data yet"
 * — the hook returns `{}` until the first fetch lands.
 */

type TrendsMap = Record<string, number | null>
const CACHE_KEY = 'brawlvalue:brawler-trends'
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

interface Cached {
  trends: TrendsMap
  timestamp: number
}

function readCache(): TrendsMap | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached: Cached = JSON.parse(raw)
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return cached.trends
  } catch {
    return null
  }
}

function writeCache(trends: TrendsMap): void {
  try {
    const data: Cached = { trends, timestamp: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // localStorage full / disabled / SSR — ignore
  }
}

export function useBrawlerTrends(): {
  trends: TrendsMap
  isLoading: boolean
} {
  const [trends, setTrends] = useState<TrendsMap>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      setTrends(cached)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    fetch('/api/meta/brawler-trends', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { trends: {} }))
      .then((body: { trends: TrendsMap }) => {
        const next = body.trends ?? {}
        writeCache(next)
        setTrends(next)
      })
      .catch(() => {
        // Network error — leave trends empty, UI falls back to "no data".
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [])

  return { trends, isLoading }
}
