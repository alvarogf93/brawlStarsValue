import type { SupabaseClient } from '@supabase/supabase-js'
import { META_ROLLING_DAYS } from '@/lib/draft/constants'
import { bayesianWinRate } from '@/lib/draft/scoring'

/**
 * Tier 1 / Tier 2 cascade aggregator for meta_stats.
 *
 * Used by both `/api/meta` (anon GET, JSON) and `/[locale]/picks/page.tsx`
 * (server component, public draft simulator). Before ARQ-03 the same
 * 100+ LoC of aggregation lived inline in both files — diverging by hand
 * was a real risk. CLAUDE.md explicitly tracked the duplication as
 * "YAGNI-acceptable for a single cross-file reuse"; once a third caller
 * appeared (or once the cascade gained a Tier 3), centralising became
 * necessary.
 *
 * Both Tier queries are filtered to `source='global'` (LOG-01 lesson
 * applies — never mix users' personal stats into the public meta).
 *
 * Tier 1: per (map, mode) aggregation. Returned when the (map, mode)
 *         pair has at least SPARSE_THRESHOLD total battles.
 * Tier 2: per (mode) aggregation. Used as fallback when a map is sparse;
 *         shows a generic "good in this mode" picture instead of empty.
 *
 * The single round-trip Tier 2 query batches all sparse modes — a
 * map showing both 'gemGrab' and 'brawlBall' as sparse only fires
 * one extra query, not N. This was the original justification for
 * accepting the duplication ("don't add a query for the helper itself").
 */

export const META_CASCADE_SPARSE_THRESHOLD = 30

export interface DraftEventInput {
  event: {
    id: number
    mode: string
    map: string
  }
  startTime: string
  endTime: string
}

export interface MetaTopBrawler {
  brawlerId: number
  winRate: number
  pickCount: number
}

export interface MetaEventResult {
  mode: string
  map: string
  eventId: number
  startTime: string
  endTime: string
  totalBattles: number
  topBrawlers: MetaTopBrawler[]
  source: 'map-mode' | 'mode-fallback'
}

interface AggStat { wins: number; losses: number; total: number }

interface RawStatsRow {
  brawler_id: number
  map: string
  mode: string
  wins: number
  losses: number
  total: number
}

interface RawModeRow {
  brawler_id: number
  mode: string
  wins: number
  losses: number
  total: number
}

/**
 * Produce the Tier-1+Tier-2 cascaded event list for a given draftEvents
 * snapshot. The result is *display-ready* — top 10 brawlers per (map,mode)
 * sorted by Bayesian win-rate, with a `source` flag so the UI can label
 * mode-fallback differently from a map-specific result.
 *
 * Empty inputs yield an empty array. Errors propagate (callers wrap in
 * try/catch — matches the legacy behaviour).
 */
export async function buildEventsWithCascade(
  supabase: SupabaseClient,
  draftEvents: DraftEventInput[],
): Promise<MetaEventResult[]> {
  if (draftEvents.length === 0) return []

  const cutoffDate = new Date(Date.now() - META_ROLLING_DAYS * 86400000)
    .toISOString()
    .slice(0, 10)
  const mapNames = [...new Set(draftEvents.map(e => e.event.map))]

  // Tier 1: per (map, mode)
  const { data: rawStats } = await supabase
    .from('meta_stats')
    .select('brawler_id, map, mode, wins, losses, total')
    .eq('source', 'global')
    .gte('date', cutoffDate)
    .in('map', mapNames)

  const metaMap = new Map<string, Map<number, AggStat>>()
  for (const row of (rawStats ?? []) as RawStatsRow[]) {
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

  // Sparse-map detection — collect distinct modes that have at least one
  // map below threshold so a single Tier 2 query covers them all.
  const sparseModes = new Set<string>()
  for (const event of draftEvents) {
    const key = `${event.event.map}|${event.event.mode}`
    const brawlers = metaMap.get(key)
    const total = brawlers
      ? Array.from(brawlers.values()).reduce((s, b) => s + b.total, 0)
      : 0
    if (total < META_CASCADE_SPARSE_THRESHOLD) {
      sparseModes.add(event.event.mode)
    }
  }

  // Tier 2: one query covering all sparse modes (mode-level only).
  const modeFallback = new Map<string, Map<number, AggStat>>()
  if (sparseModes.size > 0) {
    const { data: modeStats } = await supabase
      .from('meta_stats')
      .select('brawler_id, mode, wins, losses, total')
      .eq('source', 'global')
      .gte('date', cutoffDate)
      .in('mode', Array.from(sparseModes))

    for (const row of (modeStats ?? []) as RawModeRow[]) {
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

  // Build response: event + top-10 brawlers, with source flag per map.
  return draftEvents.map(event => {
    const key = `${event.event.map}|${event.event.mode}`
    let brawlers = metaMap.get(key)
    let totalBattles = brawlers
      ? Array.from(brawlers.values()).reduce((s, x) => s + x.total, 0)
      : 0
    let source: 'map-mode' | 'mode-fallback' = 'map-mode'

    if (totalBattles < META_CASCADE_SPARSE_THRESHOLD) {
      const fallback = modeFallback.get(event.event.mode)
      if (fallback && fallback.size > 0) {
        brawlers = fallback
        totalBattles = Array.from(fallback.values()).reduce((s, x) => s + x.total, 0)
        source = 'mode-fallback'
      }
    }

    let topBrawlers: MetaTopBrawler[] = []
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
}
