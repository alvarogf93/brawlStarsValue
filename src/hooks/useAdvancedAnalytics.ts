'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AdvancedAnalytics } from '@/lib/analytics/types'

interface UseAdvancedAnalyticsResult {
  data: AdvancedAnalytics | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useAdvancedAnalytics(enabled = true): UseAdvancedAnalyticsResult {
  const [data, setData] = useState<AdvancedAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const fetchAnalytics = useCallback(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setLoading(true)
    setError(null)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    fetch(`/api/analytics?tz=${encodeURIComponent(tz)}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (!json || typeof json !== 'object' || !('byBrawler' in json)) {
          throw new Error('Invalid analytics response')
        }
        setData(json as AdvancedAnalytics)
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (enabled) fetchAnalytics()
    return () => controllerRef.current?.abort()
  }, [enabled, fetchAnalytics])

  return { data, isLoading: loading, error, refresh: fetchAnalytics }
}
