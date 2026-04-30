'use client'

import { useEffect, useState } from 'react'
import type { GemScore } from '@/lib/types'
import { playerCacheKey } from '@/lib/storage'
import { readLocalCache, writeLocalCache } from '@/lib/local-cache'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
// LOG-13 — bump on changes to GemScore shape (new fields, renames).
const CACHE_VERSION = 1

const getCacheKey = playerCacheKey

function readCache(tag: string): GemScore | null {
  return readLocalCache<GemScore>(getCacheKey(tag), CACHE_VERSION, CACHE_TTL)
}

function writeCache(tag: string, gemScore: GemScore): void {
  writeLocalCache(getCacheKey(tag), CACHE_VERSION, gemScore)
}

export function usePlayerData(
  tag: string,
  opts?: { fromLanding?: boolean; locale?: string },
) {
  const [data, setData] = useState<GemScore | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tag) return

    // Check localStorage first. The setState-in-effect below is intentional:
    // this is the classic "cache hit on mount" pattern. Refactoring it to a
    // lazy useState initializer would couple cache reads to render, which
    // is worse for SSR/hydration than the single extra render on cache hit.
    const cached = readCache(tag)
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(cached)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()

    // Fetch from API
    setIsLoading(true)
    setError(null)

    fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerTag: tag,
        ...(opts?.fromLanding ? { fromLanding: true } : {}),
        ...(opts?.locale ? { locale: opts.locale } : {}),
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Error ${res.status}`)
        }
        return res.json()
      })
      .then((result: GemScore) => {
        writeCache(tag, result)
        setData(result)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [tag, opts?.fromLanding, opts?.locale])

  return { data, isLoading, error }
}
