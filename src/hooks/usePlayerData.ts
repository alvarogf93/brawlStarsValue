'use client'

import { useEffect, useState } from 'react'
import type { GemScore } from '@/lib/types'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface CachedData {
  gemScore: GemScore
  timestamp: number
}

function getCacheKey(tag: string): string {
  return `brawlvalue:player:${tag.toUpperCase()}`
}

function readCache(tag: string): GemScore | null {
  try {
    const raw = localStorage.getItem(getCacheKey(tag))
    if (!raw) return null
    const cached: CachedData = JSON.parse(raw)
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      localStorage.removeItem(getCacheKey(tag))
      return null
    }
    return cached.gemScore
  } catch {
    return null
  }
}

function writeCache(tag: string, gemScore: GemScore): void {
  try {
    const data: CachedData = { gemScore, timestamp: Date.now() }
    localStorage.setItem(getCacheKey(tag), JSON.stringify(data))
  } catch {
    // localStorage full or disabled — ignore
  }
}

export function usePlayerData(tag: string) {
  const [data, setData] = useState<GemScore | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tag) return

    // Check localStorage first
    const cached = readCache(tag)
    if (cached) {
      setData(cached)
      setIsLoading(false)
      return
    }

    // Fetch from API
    setIsLoading(true)
    setError(null)

    fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerTag: tag }),
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
        setError(err.message)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [tag])

  return { data, isLoading, error }
}
