import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchEventRotation } from '@/lib/api'
import { META_ROLLING_DAYS, isDraftMode } from '@/lib/draft/constants'
import { fetchWithRetry, getCircuitBreaker } from '@/lib/http'

const brawlapiBreaker = getCircuitBreaker('brawlapi')

export const dynamic = 'force-dynamic'

// BrawlAPI map data cache (in-memory, refreshed every 24h)
let brawlApiMaps: Map<string, { id: number; imageUrl: string }> | null = null
let brawlApiMapsTs = 0

async function getBrawlApiMaps(): Promise<Map<string, { id: number; imageUrl: string }>> {
  if (brawlApiMaps && Date.now() - brawlApiMapsTs < 86400000) return brawlApiMaps

  try {
    // PERF-01: timeout + idempotent GET retries + brawlapi breaker.
    const res = await brawlapiBreaker.execute(() =>
      fetchWithRetry(
        'https://api.brawlapi.com/v1/maps',
        { next: { revalidate: 86400 } } as RequestInit,
        { retries: 2, timeoutMs: 8_000 },
      ),
    )
    if (!res.ok) return brawlApiMaps ?? new Map()
    const data = await res.json()
    const list = (data.list ?? data) as Array<{ id: number; name: string; imageUrl?: string }>

    const map = new Map<string, { id: number; imageUrl: string }>()
    for (const m of list) {
      if (!m.imageUrl) continue
      // BrawlAPI uses hyphens and no apostrophes: "Belles-Rock" → we store "Belle's Rock"
      // Create multiple normalized keys to maximize matching
      const withSpaces = m.name.replace(/-/g, ' ')
      map.set(withSpaces, { id: m.id, imageUrl: m.imageUrl })
      map.set(m.name, { id: m.id, imageUrl: m.imageUrl })
      // Also try common apostrophe patterns: "Belles Rock" → "Belle's Rock"
      const withApostrophe = withSpaces.replace(/(\w)s\s/g, "$1's ")
      if (withApostrophe !== withSpaces) {
        map.set(withApostrophe, { id: m.id, imageUrl: m.imageUrl })
      }
    }
    brawlApiMaps = map
    brawlApiMapsTs = Date.now()
    return map
  } catch {
    return brawlApiMaps ?? new Map()
  }
}

/**
 * GET /api/draft/maps?mode=gemGrab
 *
 * Returns all known maps for a mode:
 * - Currently active maps (from event rotation) marked as live
 * - Historical maps with meta data (from meta_stats)
 * All maps include image URLs from BrawlAPI
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode')

  if (!mode || !isDraftMode(mode)) {
    return NextResponse.json({ error: 'Valid draft mode is required' }, { status: 400 })
  }

  // 1. Get BrawlAPI map images
  const mapImages = await getBrawlApiMaps()

  // 2. Get currently active maps for this mode
  let activeMaps: { map: string; eventId: number }[] = []
  try {
    const events = await fetchEventRotation()
    activeMaps = events
      .filter(e => e.event.mode === mode)
      .map(e => ({ map: e.event.map, eventId: e.event.id }))
  } catch { /* ignore */ }

  const activeMapNames = new Set(activeMaps.map(m => m.map))

  // 3. Get historical maps with meta data
  const supabase = await createServiceClient()
  const cutoffDate = new Date(Date.now() - META_ROLLING_DAYS * 86400000).toISOString().slice(0, 10)

  const { data: historicalRows } = await supabase
    .from('meta_stats')
    .select('map')
    .eq('mode', mode)
    .eq('source', 'global')
    .gte('date', cutoffDate)

  const historicalMapNames = new Set<string>()
  for (const row of historicalRows ?? []) {
    if (row.map && !activeMapNames.has(row.map)) {
      historicalMapNames.add(row.map)
    }
  }

  // 4. Build response with image URLs
  function getMapImage(mapName: string, eventId?: number) {
    // First try BrawlAPI images (more complete)
    const brawlApi = mapImages.get(mapName)
    if (brawlApi) return { eventId: brawlApi.id, imageUrl: brawlApi.imageUrl }
    // Fallback to Brawlify CDN with eventId
    if (eventId) return { eventId, imageUrl: `https://cdn.brawlify.com/maps/regular/${eventId}.png` }
    return { eventId: null, imageUrl: null }
  }

  const maps = [
    ...activeMaps.map(m => {
      const img = getMapImage(m.map, m.eventId)
      return { map: m.map, eventId: img.eventId ?? m.eventId, imageUrl: img.imageUrl, isLive: true }
    }),
    ...Array.from(historicalMapNames).sort().map(mapName => {
      const img = getMapImage(mapName)
      return { map: mapName, eventId: img.eventId, imageUrl: img.imageUrl, isLive: false }
    }),
  ]

  return NextResponse.json({ maps })
}
