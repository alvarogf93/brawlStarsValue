'use client'

import { useEffect, useState } from 'react'
import { readLocalCache, writeLocalCache } from '@/lib/local-cache'

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
// LOG-13 — bump on TrendsMap shape change (e.g. adding metadata).
const CACHE_VERSION = 1

function readCache(): TrendsMap | null {
  return readLocalCache<TrendsMap>(CACHE_KEY, CACHE_VERSION, CACHE_TTL)
}

function writeCache(trends: TrendsMap): void {
  writeLocalCache(CACHE_KEY, CACHE_VERSION, trends)
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
      // TODO: ARQ-10 — localStorage hydration; should move to useSyncExternalStore
      // so React reads the cache during render instead of via an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTrends(cached)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    fetch('/api/meta/brawler-trends', { signal: controller.signal })
      .then(async (res) => {
        // Only treat 2xx as success — otherwise throw so the catch
        // path runs and we DON'T write an empty map to localStorage.
        // Prior version swallowed non-2xx into `{ trends: {} }` and
        // cached that for 10 minutes, so a single API blip would
        // hide every trend badge across the whole session until the
        // TTL expired (flagged by code review — I1).
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json() as Promise<{ trends: TrendsMap }>
      })
      .then((body) => {
        if (controller.signal.aborted) return
        const next = body.trends ?? {}
        writeCache(next)
        setTrends(next)
      })
      .catch(() => {
        // Network error OR non-2xx — leave trends empty in memory,
        // and do NOT write to cache so the next page load retries.
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [])

  return { trends, isLoading }
}
