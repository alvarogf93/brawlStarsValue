// Server-only. Do not import from client components.
// The `server-only` package is not used in this repo — this comment
// block serves as the marker (same pattern as anonymous-visits.ts).

import {
  createClient as createSupabaseAdmin,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { bucketByDay } from './formatters'
import type {
  Queries,
  StatsData,
} from './types'

// ── Memoised admin client ──────────────────────────────────────

let _admin: SupabaseClient | null = null

export function getAdmin(): SupabaseClient {
  if (_admin) return _admin
  _admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  return _admin
}

// ── getStats ───────────────────────────────────────────────────
// ~14 parallel queries. Keep the order stable — unit tests feed
// fixtures in the same sequence.

async function getStats(): Promise<StatsData> {
  const admin = getAdmin()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const d7Ago  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()
  const d30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const d24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const [
    totalUsers,
    premiumCount,
    trialCount,
    anonCount30d,
    anonLast7d,
    totalBattles,
    battlesToday,
    battlesLast7d,
    metaRowsToday,
    metaRowsTotal,
    activeCursors,
    staleCursors,
    latestCursor,
    todayMetaRows,
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).in('tier', ['premium', 'pro']),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gt('trial_ends_at', now.toISOString()),
    admin.from('anonymous_visits').select('*', { count: 'exact', head: true }).gte('first_visit_at', d30Ago),
    admin.from('anonymous_visits').select('first_visit_at').gte('first_visit_at', d7Ago),
    admin.from('battles').select('*', { count: 'exact', head: true }),
    admin.from('battles').select('*', { count: 'exact', head: true }).gte('battle_time', `${today}T00:00:00Z`),
    admin.from('battles').select('battle_time').gte('battle_time', d7Ago),
    admin.from('meta_stats').select('*', { count: 'exact', head: true }).eq('date', today).eq('source', 'global'),
    admin.from('meta_stats').select('*', { count: 'exact', head: true }),
    admin.from('meta_poll_cursors').select('*', { count: 'exact', head: true }).gt('last_battle_time', d24hAgo),
    admin.from('meta_poll_cursors').select('*', { count: 'exact', head: true }).lt('last_battle_time', d24hAgo),
    admin.from('meta_poll_cursors').select('last_battle_time').order('last_battle_time', { ascending: false }).limit(1).maybeSingle(),
    admin.from('meta_stats').select('brawler_id, map, mode, total, wins, losses').eq('date', today).eq('source', 'global'),
  ])

  // Sparklines
  const anonSparkline   = bucketByDay(anonLast7d.data ?? [], 'first_visit_at', 7, now.getTime())
  const battleSparkline = bucketByDay(battlesLast7d.data ?? [], 'battle_time', 7, now.getTime())

  // Top 3 maps: sum total by (map, mode), descending
  const mapAgg = new Map<string, { map: string; mode: string; battles: number }>()
  for (const row of (todayMetaRows.data ?? []) as Array<{ map: string; mode: string; total: number }>) {
    const key = `${row.mode}::${row.map}`
    const e = mapAgg.get(key) ?? { map: row.map, mode: row.mode, battles: 0 }
    e.battles += row.total ?? 0
    mapAgg.set(key, e)
  }
  const top3Maps = Array.from(mapAgg.values())
    .sort((a, b) => b.battles - a.battles)
    .slice(0, 3)

  // Top 3 brawlers by win rate (min 30 battles aggregated across maps today)
  const brAgg = new Map<number, { brawlerId: number; wins: number; total: number }>()
  for (const row of (todayMetaRows.data ?? []) as Array<{ brawler_id: number; wins: number; total: number }>) {
    const e = brAgg.get(row.brawler_id) ?? { brawlerId: row.brawler_id, wins: 0, total: 0 }
    e.wins  += row.wins  ?? 0
    e.total += row.total ?? 0
    brAgg.set(row.brawler_id, e)
  }
  const top3Brawlers = Array.from(brAgg.values())
    .filter((e) => e.total >= 30)
    .map((e) => ({ brawlerId: e.brawlerId, winRate: e.wins / e.total, total: e.total }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 3)

  return {
    totalUsers: totalUsers.count ?? 0,
    premiumCount: premiumCount.count ?? 0,
    trialCount: trialCount.count ?? 0,
    anonCount30d: anonCount30d.count ?? 0,
    anonSparkline,
    totalBattles: totalBattles.count ?? 0,
    battlesToday: battlesToday.count ?? 0,
    battleSparkline,
    metaRowsToday: metaRowsToday.count ?? 0,
    metaRowsTotal: metaRowsTotal.count ?? 0,
    activeCursors: activeCursors.count ?? 0,
    staleCursors: staleCursors.count ?? 0,
    latestMetaActivity: (latestCursor.data as { last_battle_time: string } | null)?.last_battle_time ?? null,
    top3Maps,
    top3Brawlers,
  }
}

// ── Public export ─────────────────────────────────────────────
// NOTE: other query functions (getBattles, getPremium, getCronStatus,
// getMapList, findMapByPrefix, getMapData) are appended in subsequent
// tasks. The `queries` export below is extended accordingly.

export const queries: Queries = {
  getStats,
  // Placeholders filled in by later tasks:
  async getBattles() { throw new Error('not implemented yet (task 5)') },
  async getPremium() { throw new Error('not implemented yet (task 5)') },
  async getCronStatus() { throw new Error('not implemented yet (task 6)') },
  async getMapList() { throw new Error('not implemented yet (task 7)') },
  async findMapByPrefix() { throw new Error('not implemented yet (task 7)') },
  async getMapData() { throw new Error('not implemented yet (task 7)') },
}
