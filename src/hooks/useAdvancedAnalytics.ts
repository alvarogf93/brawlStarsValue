'use client'

import { useState, useEffect } from 'react'
import type { AdvancedAnalytics } from '@/lib/analytics/types'

interface UseAdvancedAnalyticsResult {
  data: AdvancedAnalytics | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useAdvancedAnalytics(enabled = true): UseAdvancedAnalyticsResult {
  const [data, setData] = useState<AdvancedAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = () => {
    setLoading(true)
    setError(null)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    fetch(`/api/analytics?tz=${encodeURIComponent(tz)}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => setData(json as AdvancedAnalytics))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (enabled) fetchAnalytics()
  }, [enabled])

  return { data, loading, error, refresh: fetchAnalytics }
}
