import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchEventRotation } from '@/lib/api'
import { isDraftMode, META_ROLLING_DAYS } from '@/lib/draft/constants'
import { bayesianWinRate } from '@/lib/draft/scoring'

/**
 * GET /api/meta
 *
 * Returns current event rotation with top brawlers per map
 * based on aggregated meta_stats data. Public, no auth required.
 * Cached for 30 minutes via Next.js revalidation.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Fetch current event rotation
    const events = await fetchEventRotation()
    const draftEvents = events.filter(e => isDraftMode(e.event.mode))

    if (draftEvents.length === 0) {
      return NextResponse.json({ events: [] })
    }

    // 2. Fetch meta_stats for active maps
    const supabase = await createServiceClient()
    const cutoffDate = new Date(Date.now() - META_ROLLING_DAYS * 86400000).toISOString().slice(0, 10)
    const mapNames = [...new Set(draftEvents.map(e => e.event.map))]

    const { data: rawStats } = await supabase
      .from('meta_stats')
      .select('brawler_id, map, mode, wins, losses, total')
      .eq('source', 'global')
      .gte('date', cutoffDate)
      .in('map', mapNames)

    // 3. Aggregate by brawler per map+mode
    const metaMap = new Map<string, Map<number, { wins: number; losses: number; total: number }>>()
    for (const row of rawStats ?? []) {
      const key = `${row.map}|${row.mode}`
      if (!metaMap.has(key)) metaMap.set(key, new Map())
      const brawlerMap = metaMap.get(key)!
      const existing = brawlerMap.get(row.brawler_id)
      if (existing) {
        existing.wins += row.wins
        existing.losses += row.losses
        existing.total += row.total
      } else {
        brawlerMap.set(row.brawler_id, { wins: row.wins, losses: row.losses, total: row.total })
      }
    }

    // 4. Build response: event + top brawlers
    const result = draftEvents.map(event => {
      const key = `${event.event.map}|${event.event.mode}`
      const brawlers = metaMap.get(key)

      let topBrawlers: { brawlerId: number; winRate: number; pickCount: number }[] = []

      if (brawlers) {
        topBrawlers = Array.from(brawlers.entries())
          .map(([brawlerId, stats]) => ({
            brawlerId,
            winRate: Math.round(bayesianWinRate(stats.wins, stats.total) * 10) / 10,
            pickCount: stats.total,
          }))
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 10)
      }

      const totalBattles = brawlers
        ? Array.from(brawlers.values()).reduce((sum, s) => sum + s.total, 0)
        : 0

      return {
        mode: event.event.mode,
        map: event.event.map,
        eventId: event.event.id,
        startTime: event.startTime,
        endTime: event.endTime,
        totalBattles,
        topBrawlers,
      }
    })

    return NextResponse.json({ events: result })
  } catch (err) {
    console.error('[meta] Error:', err)
    return NextResponse.json({ events: [], error: 'Failed to load meta data' }, { status: 500 })
  }
}
