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
    // If we already have images from cache init, skip fetch
    if (Object.keys(images).length > 0) return

    const controller = new AbortController()

    fetch('/api/maps', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(data => {
        setImages(data)
        try {
          localStorage.setItem(LS_KEY, JSON.stringify({ data, ts: Date.now() }))
        } catch { /* storage full */ }
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        console.warn('[useMapImages] Failed to fetch maps:', err.message)
      })

    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps — run once on mount, images is read from init state

  return images
}
