'use client'

import { useState, useEffect } from 'react'

const LS_KEY = 'brawlvalue:map-images'
const LS_TTL = 24 * 60 * 60 * 1000 // 24h

/** Cache of mapName → imageUrl from BrawlAPI */
export function useMapImages(): Record<string, string> {
  const [images, setImages] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return {}
      const { data, ts } = JSON.parse(raw)
      if (Date.now() - ts > LS_TTL) return {}
      return data
    } catch { return {} }
  })

  useEffect(() => {
    if (Object.keys(images).length > 0) return // Already cached

    fetch('/api/maps')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        setImages(data)
        try {
          localStorage.setItem(LS_KEY, JSON.stringify({ data, ts: Date.now() }))
        } catch { /* ignore */ }
      })
      .catch(() => {})
  }, [images])

  return images
}
