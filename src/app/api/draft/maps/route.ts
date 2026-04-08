import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchEventRotation } from '@/lib/api'
import { isDraftMode, META_ROLLING_DAYS } from '@/lib/draft/constants'

export const dynamic = 'force-dynamic'

/**
 * GET /api/draft/maps?mode=gemGrab
 *
 * Returns all known maps for a mode:
 * - Currently active maps (from event rotation) marked as live
 * - Historical maps with meta data (from meta_stats)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode')

  if (!mode) {
    return NextResponse.json({ error: 'mode is required' }, { status: 400 })
  }

  // 1. Get currently active maps for this mode
  let activeMaps: { map: string; eventId: number }[] = []
  try {
    const events = await fetchEventRotation()
    activeMaps = events
      .filter(e => e.event.mode === mode)
      .map(e => ({ map: e.event.map, eventId: e.event.id }))
  } catch { /* ignore — we'll still show historical maps */ }

  const activeMapNames = new Set(activeMaps.map(m => m.map))

  // 2. Get historical maps with meta data from meta_stats
  const supabase = await createServiceClient()
  const cutoffDate = new Date(Date.now() - META_ROLLING_DAYS * 86400000).toISOString().slice(0, 10)

  const { data: historicalRows } = await supabase
    .from('meta_stats')
    .select('map')
    .eq('mode', mode)
    .eq('source', 'global')
    .gte('date', cutoffDate)

  // Deduplicate map names
  const historicalMapNames = new Set<string>()
  for (const row of historicalRows ?? []) {
    if (row.map && !activeMapNames.has(row.map)) {
      historicalMapNames.add(row.map)
    }
  }

  // 3. Build response: active maps first, then historical
  const maps = [
    ...activeMaps.map(m => ({ map: m.map, eventId: m.eventId, isLive: true })),
    ...Array.from(historicalMapNames).sort().map(map => ({ map, eventId: null as number | null, isLive: false })),
  ]

  return NextResponse.json({ maps })
}
