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

    // 3. Aggregate by brawler per map+mode (Tier 1)
    type AggStat = { wins: number; losses: number; total: number }
    const metaMap = new Map<string, Map<number, AggStat>>()
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

    // 4. Detect sparse maps and collect their modes for Tier 2 fallback
    // A map is "sparse" if the sum of all its brawler totals is below
    // the display threshold. We collect the distinct modes that have
    // at least one sparse map so we can issue ONE batch Tier 2 query.
    const SPARSE_THRESHOLD = 30  // minimum total battles across all brawlers on a map
    const sparseModes = new Set<string>()
    for (const event of draftEvents) {
      const key = `${event.event.map}|${event.event.mode}`
      const brawlers = metaMap.get(key)
      const total = brawlers
        ? Array.from(brawlers.values()).reduce((s, b) => s + b.total, 0)
        : 0
      if (total < SPARSE_THRESHOLD) {
        sparseModes.add(event.event.mode)
      }
    }

    // 5. Tier 2 batch fallback query (one round-trip, not one per sparse map)
    const modeFallback = new Map<string, Map<number, AggStat>>()
    if (sparseModes.size > 0) {
      const { data: modeStats } = await supabase
        .from('meta_stats')
        .select('brawler_id, mode, wins, losses, total')
        .eq('source', 'global')
        .gte('date', cutoffDate)
        .in('mode', Array.from(sparseModes))

      for (const row of modeStats ?? []) {
        if (!modeFallback.has(row.mode)) modeFallback.set(row.mode, new Map())
        const brawlerMap = modeFallback.get(row.mode)!
        const existing = brawlerMap.get(row.brawler_id)
        if (existing) {
          existing.wins += row.wins
          existing.losses += row.losses
          existing.total += row.total
        } else {
          brawlerMap.set(row.brawler_id, { wins: row.wins, losses: row.losses, total: row.total })
        }
      }
    }

    // 6. Build response: event + top brawlers, with source flag per map
    const result = draftEvents.map(event => {
      const key = `${event.event.map}|${event.event.mode}`
      let brawlers = metaMap.get(key)
      let totalBattles = brawlers
        ? Array.from(brawlers.values()).reduce((sum, s) => sum + s.total, 0)
        : 0
      let source: 'map-mode' | 'mode-fallback' = 'map-mode'

      // Fallback if this specific map is sparse
      if (totalBattles < SPARSE_THRESHOLD) {
        const fallback = modeFallback.get(event.event.mode)
        if (fallback && fallback.size > 0) {
          brawlers = fallback
          totalBattles = Array.from(fallback.values()).reduce((sum, s) => sum + s.total, 0)
          source = 'mode-fallback'
        }
      }

      let topBrawlers: { brawlerId: number; winRate: number; pickCount: number }[] = []
      if (brawlers && brawlers.size > 0) {
        topBrawlers = Array.from(brawlers.entries())
          .map(([brawlerId, stats]) => ({
            brawlerId,
            winRate: Math.round(bayesianWinRate(stats.wins, stats.total) * 10) / 10,
            pickCount: stats.total,
          }))
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 10)
      }

      return {
        mode: event.event.mode,
        map: event.event.map,
        eventId: event.event.id,
        startTime: event.startTime,
        endTime: event.endTime,
        totalBattles,
        topBrawlers,
        source,
      }
    })

    // 7. Return with Cache-Control matching /api/meta/pro-analysis
    // Pre-existing gap: this endpoint previously had no cache headers,
    // so every request hit the DB. Spec §7.5.
    return NextResponse.json(
      { events: result },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
        },
      },
    )
  } catch (err) {
    console.error('[meta] Error:', err)
    return NextResponse.json({ events: [], error: 'Failed to load meta data' }, { status: 500 })
  }
}
