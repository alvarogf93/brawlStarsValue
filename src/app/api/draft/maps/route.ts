import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchEventRotation } from '@/lib/api'
import { META_ROLLING_DAYS, isDraftMode } from '@/lib/draft/constants'
import { fetchWithRetry, getCircuitBreaker, BRAWLAPI_TIMEOUT_MS } from '@/lib/http'

const brawlapiBreaker = getCircuitBreaker('brawlapi')

export const dynamic = 'force-dynamic'

/**
 * PERF-04 — fetch BrawlAPI maps WITHOUT a module-level cache.
 *
 * Why no module cache?
 *   - The `next: { revalidate: 86400 }` option below makes Next.js's
 *     own data-cache de-dup concurrent calls within a 24 h window
 *     across the whole instance — same effect as our home-grown
 *     module Map<>, but coordinated by the framework so cold starts
 *     in N concurrent instances no longer cause N parallel BrawlAPI
 *     requests (the original "cache stampede" PERF-04 flagged).
 *   - Removing the `let brawlApiMaps` singleton also means BrawlAPI
 *     downtime no longer leaves a stale value in memory for 24 h.
 *     A failed fetch returns an empty Map; the next request retries
 *     (still respecting the circuit breaker's open window).
 *
 * The function name + signature stays so callers below are unchanged.
 */
async function getBrawlApiMaps(): Promise<Map<string, { id: number; imageUrl: string }>> {
  try {
    // PERF-01: timeout + idempotent GET retries + brawlapi breaker.
    // PERF-04: revalidate: 86400 lets Next.js's data-cache dedup
    // concurrent calls within the 24h window — no module-level Map needed.
    const res = await brawlapiBreaker.execute(() =>
      fetchWithRetry(
        'https://api.brawlapi.com/v1/maps',
        { next: { revalidate: 86400 } } as RequestInit,
        { retries: 2, timeoutMs: BRAWLAPI_TIMEOUT_MS },
      ),
    )
    if (!res.ok) return new Map()
    const data = await res.json()
    const list = (data.list ?? data) as Array<{ id: number; name: string; imageUrl?: string }>

    const map = new Map<string, { id: number; imageUrl: string }>()
    for (const m of list) {
      if (!m.imageUrl) continue
      // BrawlAPI uses hyphens and no apostrophes: "Belles-Rock" → we store "Belle's Rock".
      // Create multiple normalised keys to maximise matching.
      const withSpaces = m.name.replace(/-/g, ' ')
      map.set(withSpaces, { id: m.id, imageUrl: m.imageUrl })
      map.set(m.name, { id: m.id, imageUrl: m.imageUrl })
      const withApostrophe = withSpaces.replace(/(\w)s\s/g, "$1's ")
      if (withApostrophe !== withSpaces) {
        map.set(withApostrophe, { id: m.id, imageUrl: m.imageUrl })
      }
    }
    return map
  } catch {
    // Hard fail (timeout / circuit open / non-2xx not caught above) →
    // empty Map. The route below falls back to Brawlify CDN URLs by
    // eventId so users still see images.
    return new Map()
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
