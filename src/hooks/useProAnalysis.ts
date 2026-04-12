'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ProAnalysisResponse } from '@/lib/draft/pro-analysis'

interface UseProAnalysisResult {
  data: ProAnalysisResponse | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

// Client-side cache: map+mode+window -> response
const cache = new Map<string, ProAnalysisResponse>()

/**
 * Fetches PRO analysis data for a given map + mode.
 * Caches by map+mode+window key. Aborts on unmount or param change.
 * Returns null data when map or mode are null (no fetch triggered).
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

    // Check cache first
    const cached = cache.get(key)
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
        cache.set(key, json)
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
    // If params are set and we have a cache hit, use it immediately.
    // Cache-hit setState is intentional (classic pattern); refactoring
    // to derived state would break the shared module-level cache.
    if (cacheKey && cache.has(cacheKey)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(cache.get(cacheKey)!)
      setLoading(false)
      setError(null)
      return
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
