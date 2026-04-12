'use client'

import { useEffect, useState, useCallback } from 'react'
import type { BrawlerMetaResponse } from '@/lib/brawler-detail/types'

const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

interface CachedData {
  meta: BrawlerMetaResponse
  timestamp: number
}

function getCacheKey(brawlerId: number, window: number): string {
  return `brawlvalue:brawler-meta:${brawlerId}:${window}`
}

function readCache(brawlerId: number, window: number): BrawlerMetaResponse | null {
  try {
    const raw = localStorage.getItem(getCacheKey(brawlerId, window))
    if (!raw) return null
    const cached: CachedData = JSON.parse(raw)
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      localStorage.removeItem(getCacheKey(brawlerId, window))
      return null
    }
    return cached.meta
  } catch {
    return null
  }
}

function writeCache(brawlerId: number, window: number, meta: BrawlerMetaResponse): void {
  try {
    const data: CachedData = { meta, timestamp: Date.now() }
    localStorage.setItem(getCacheKey(brawlerId, window), JSON.stringify(data))
  } catch {
    // localStorage full or disabled — ignore
  }
}

export function useBrawlerMeta(brawlerId: number, window = 14) {
  const [data, setData] = useState<BrawlerMetaResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMeta = useCallback(() => {
    if (!brawlerId || Number.isNaN(brawlerId)) {
      setError('Invalid brawler ID')
      setIsLoading(false)
      return
    }

    // Check localStorage first
    const cached = readCache(brawlerId, window)
    if (cached) {
      setData(cached)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()

    setIsLoading(true)
    setError(null)

    globalThis
      .fetch(
        `/api/meta/brawler-detail?brawlerId=${brawlerId}&window=${window}`,
        { signal: controller.signal },
      )
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Error ${res.status}`)
        }
        return res.json()
      })
      .then((result: BrawlerMetaResponse) => {
        writeCache(brawlerId, window, result)
        setData(result)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return controller
  }, [brawlerId, window])

  useEffect(() => {
    // Input validation path sets state synchronously before the fetch
    // is even attempted. Refactoring to derived state would require
    // duplicating the isNaN check in render; left as-is intentionally.
    if (!brawlerId || Number.isNaN(brawlerId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('Invalid brawler ID')
      setIsLoading(false)
      return
    }

    const controller = fetchMeta()
    return () => controller?.abort()
  }, [brawlerId, window, fetchMeta])

  return { data, isLoading, error }
}
