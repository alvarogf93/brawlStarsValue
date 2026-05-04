'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GemScore } from '@/lib/types'
import { playerCacheKey } from '@/lib/storage'
import { readLocalCache, writeLocalCache, clearLocalCache } from '@/lib/local-cache'

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
  // Track when the in-memory `data` was last hydrated so the
  // visibilitychange handler can decide whether refetch is warranted.
  // 0 means "never fetched in this mount" — first load goes through
  // the main effect.
  const lastFetchedAt = useRef(0)

  const doFetch = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerTag: tag,
          ...(opts?.fromLanding ? { fromLanding: true } : {}),
          ...(opts?.locale ? { locale: opts.locale } : {}),
        }),
        signal,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }
      const result: GemScore = await res.json()
      writeCache(tag, result)
      setData(result)
      lastFetchedAt.current = Date.now()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [tag, opts?.fromLanding, opts?.locale])

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
      lastFetchedAt.current = Date.now()
      return
    }

    const controller = new AbortController()
    void doFetch(controller.signal)
    return () => controller.abort()
  }, [tag, doFetch])

  // PWA staleness fix (2026-05-04) — installed PWAs don't unmount
  // components between sessions the way the browser does. A user who
  // opened the app yesterday, unlocked DAMIAN, and reopened the PWA
  // today saw the pre-unlock data because `usePlayerData` only fetches
  // on mount + the in-memory state never aged. visibilitychange fires
  // every time the user comes back to the tab/PWA, so it's the right
  // signal to gate "should we re-check the API".
  //
  // Only refetch if the in-memory data is older than CACHE_TTL — under
  // that threshold the existing cached data is still considered fresh
  // and we don't want to thrash the upstream Supercell API on every
  // app-switch.
  useEffect(() => {
    if (!tag) return
    if (typeof document === 'undefined') return

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const age = Date.now() - lastFetchedAt.current
      if (lastFetchedAt.current === 0 || age <= CACHE_TTL) return
      // Drop the localStorage entry too so a sibling page mounting
      // mid-refetch doesn't seed itself with the now-stale cache.
      clearLocalCache(getCacheKey(tag))
      void doFetch()
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [tag, doFetch])

  return { data, isLoading, error }
}
