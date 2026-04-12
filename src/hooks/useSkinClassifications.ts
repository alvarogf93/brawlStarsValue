'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { SKIN_TIER_PRICES, PIN_TIER_PRICES } from '@/lib/constants'

/** Map: tier/pin key → count */
export type CosmeticCounts = Record<string, number>

const STORAGE_KEY = 'brawlvalue:cosmetics'

const ALL_PRICES: Record<string, number> = { ...SKIN_TIER_PRICES, ...PIN_TIER_PRICES }

function getStorageKey(playerTag: string) {
  return `${STORAGE_KEY}:${playerTag.toUpperCase()}`
}

export function useSkinClassifications(playerTag: string) {
  const [counts, setCounts] = useState<CosmeticCounts>({})

  useEffect(() => {
    // Rehydrate counts from localStorage whenever the player changes.
    // Must be inside an effect because localStorage is browser-only.
    try {
      const raw = localStorage.getItem(getStorageKey(playerTag))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setCounts(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [playerTag])

  const setCount = useCallback((key: string, count: number) => {
    setCounts(prev => {
      const next = { ...prev, [key]: Math.max(0, count) }
      try { localStorage.setItem(getStorageKey(playerTag), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [playerTag])

  const totalSkinGems = useMemo(() => {
    return Object.entries(counts).reduce((sum, [key, count]) => {
      if (key.startsWith('pin')) return sum // pins counted separately
      return sum + (count || 0) * (SKIN_TIER_PRICES[key] || 0)
    }, 0)
  }, [counts])

  const totalPinGems = useMemo(() => {
    return Object.entries(counts).reduce((sum, [key, count]) => {
      if (!key.startsWith('pin')) return sum
      return sum + (count || 0) * (PIN_TIER_PRICES[key] || 0)
    }, 0)
  }, [counts])

  const totalCosmeticGems = totalSkinGems + totalPinGems

  const classifiedCount = useMemo(() => {
    return Object.values(counts).reduce((sum, c) => sum + (c || 0), 0)
  }, [counts])

  return { counts, setCount, totalSkinGems, totalPinGems, totalCosmeticGems, classifiedCount, ALL_PRICES }
}
