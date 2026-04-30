'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ProAnalysisResponse } from '@/lib/draft/pro-analysis'

interface UseProAnalysisResult {
  data: ProAnalysisResponse | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

// LOG-10 — bounded TTL+LRU client-side cache.
//
// The previous implementation was an unbounded Map<string, ProAnalysisResponse>.
// A premium user navigating 50 maps × 8 modes × 4 windows = 1600 entries.
// Each ~50-100 KB → resident memory grew to ~80 MB and never released, even
// across tab life. The TTL also matched nothing — a stale draft from 31 min
// ago kept serving while the server's `s-maxage=1800` had already moved on.
//
// CACHE_TTL_MS matches the server's `s-maxage` for /api/meta/pro-analysis.
// CACHE_MAX_SIZE caps memory and gives the LRU something to evict.
const CACHE_TTL_MS = 30 * 60 * 1000
const CACHE_MAX_SIZE = 50

interface CacheEntry {
  value: ProAnalysisResponse
  storedAt: number
}

/**
 * Map iteration order in JS is insertion order, so LRU is implemented by
 * delete-then-set on every read (moves the entry to the end). Eviction
 * trims the oldest (head) when size exceeds the cap.
 */
const cache = new Map<string, CacheEntry>()

function cacheGet(key: string, now: number): ProAnalysisResponse | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (now - entry.storedAt > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  // LRU touch — re-insert at the tail.
  cache.delete(key)
  cache.set(key, entry)
  return entry.value
}

function cacheSet(key: string, value: ProAnalysisResponse, now: number): void {
  cache.delete(key)
  cache.set(key, { value, storedAt: now })
  while (cache.size > CACHE_MAX_SIZE) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

/**
 * Test-only: clear the module-level cache. Not exported in production paths.
 */
export function __resetProAnalysisCacheForTests(): void {
  cache.clear()
}

/**
 * Fetches PRO analysis data for a given map + mode.
 * Caches by map+mode+window key (TTL 30 min, LRU maxSize 50).
 * Aborts on unmount or param change. Returns null data when map or mode
 * are null (no fetch triggered).
 */
export function useProAnalysis(
  map: string | null,
  mode: string | null,
  window: number = 14,
): UseProAnalysisResult {
  const [data, setData] = useState<ProAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const cacheKey = map && mode ? `${map}|${mode}|${window}` : null

  const fetchData = useCallback(() => {
    if (!map || !mode) return

    const key = `${map}|${mode}|${window}`

    // Check cache first.
    const cached = cacheGet(key, Date.now())
    if (cached) {
      setData(cached)
      setLoading(false)
      setError(null)
      return
    }

    // Abort previous request
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ map, mode, window: String(window) })

    fetch(`/api/meta/pro-analysis?${params}`, {
      signal: controller.signal,
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json: ProAnalysisResponse) => {
        cacheSet(key, json, Date.now())
        setData(json)
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
  }, [map, mode, window])

  useEffect(() => {
    // If params are set and we have a fresh cache hit, use it immediately.
    // Cache-hit setState is intentional (classic pattern); refactoring
    // to derived state would break the shared module-level cache.
    if (cacheKey) {
      const cached = cacheGet(cacheKey, Date.now())
      if (cached) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setData(cached)
        setLoading(false)
        setError(null)
        return
      }
    }

    if (map && mode) {
      fetchData()
    } else {
      setData(null)
      setLoading(false)
      setError(null)
    }

    return () => controllerRef.current?.abort()
  }, [map, mode, window, cacheKey, fetchData])

  const refresh = useCallback(() => {
    if (cacheKey) cache.delete(cacheKey)
    fetchData()
  }, [cacheKey, fetchData])

  return { data, isLoading: loading, error, refresh }
}
