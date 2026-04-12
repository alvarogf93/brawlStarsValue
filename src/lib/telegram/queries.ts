// Server-only. Do not import from client components.
// The `server-only` package is not used in this repo — this comment
// block serves as the marker (same pattern as anonymous-visits.ts).

import {
  createClient as createSupabaseAdmin,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { bucketByDay } from './formatters'
import type {
  BattlesData,
  PremiumData,
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

// ── getBattles ─────────────────────────────────────────────────

async function getBattles(): Promise<BattlesData> {
  const admin = getAdmin()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const yestStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const d7Ago  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()
  const d14Ago = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const d30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    total,
    todayRes,
    yestRes,
    last7d,
    last30d,
    rowsFor14d,
    distroRowsRes,
    latestSyncRes,
    queuePendingRes,
  ] = await Promise.all([
    admin.from('battles').select('*', { count: 'exact', head: true }),
    admin.from('battles').select('*', { count: 'exact', head: true }).gte('battle_time', `${today}T00:00:00Z`),
    admin.from('battles').select('*', { count: 'exact', head: true })
      .gte('battle_time', `${yestStart}T00:00:00Z`)
      .lt('battle_time', `${today}T00:00:00Z`),
    admin.from('battles').select('*', { count: 'exact', head: true }).gte('battle_time', d7Ago),
    admin.from('battles').select('*', { count: 'exact', head: true }).gte('battle_time', d30Ago),
    admin.from('battles').select('battle_time').gte('battle_time', d14Ago),
    admin.from('battles').select('mode, result, player_tag').gte('battle_time', d7Ago),
    admin.from('profiles').select('last_sync').order('last_sync', { ascending: false })
      .in('tier', ['premium', 'pro']).limit(1).maybeSingle(),
    admin.from('sync_queue').select('*', { count: 'exact', head: true }).is('completed_at', null),
  ])

  const sparkline14d = bucketByDay(rowsFor14d.data ?? [], 'battle_time', 14, now.getTime())

  // Mode + result distributions over last 7d
  const distroRows = (distroRowsRes.data ?? []) as Array<{ mode: string; result: string; player_tag: string }>
  const total7d = distroRows.length

  const modeCounts = new Map<string, number>()
  for (const r of distroRows) modeCounts.set(r.mode, (modeCounts.get(r.mode) ?? 0) + 1)
  const modeDistribution = Array.from(modeCounts.entries())
    .map(([mode, count]) => ({ mode, count, pct: total7d ? count / total7d : 0 }))
    .sort((a, b) => b.count - a.count)

  const resultCounts = { victory: 0, defeat: 0, draw: 0 }
  for (const r of distroRows) {
    if (r.result === 'victory' || r.result === 'defeat' || r.result === 'draw') {
      resultCounts[r.result] += 1
    }
  }
  const resultDistribution: BattlesData['resultDistribution'] = (['victory', 'defeat', 'draw'] as const).map(
    (k) => ({ result: k, count: resultCounts[k], pct: total7d ? resultCounts[k] / total7d : 0 }),
  )

  // Top 5 players by battle count over 7d
  const playerCounts = new Map<string, number>()
  for (const r of distroRows) playerCounts.set(r.player_tag, (playerCounts.get(r.player_tag) ?? 0) + 1)
  const topPlayers = Array.from(playerCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    total: total.count ?? 0,
    today: todayRes.count ?? 0,
    yesterday: yestRes.count ?? 0,
    last7d: last7d.count ?? 0,
    last30d: last30d.count ?? 0,
    sparkline14d,
    modeDistribution,
    resultDistribution,
    topPlayers,
    lastSuccessfulSyncAt: (latestSyncRes.data as { last_sync: string } | null)?.last_sync ?? null,
    queuePending: queuePendingRes.count ?? 0,
  }
}

// ── getPremium ─────────────────────────────────────────────────
// Explicitly does not query subscriptions/payments tables — those
// are not confirmed to exist. The /premium output surfaces this as
// "requires integration" instead of fabricating numbers.

async function getPremium(): Promise<PremiumData> {
  const admin = getAdmin()
  const now = new Date()
  const d30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    premiumActive,
    trialActive,
    freeUsers,
    signupsLast30d,
    trialsActivatedLast30d,
    trialToPremiumLast30d,
    trialsExpiredLast30d,
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }).in('tier', ['premium', 'pro']),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gt('trial_ends_at', now.toISOString()),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'free'),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', d30Ago),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', d30Ago),
    admin.from('profiles').select('*', { count: 'exact', head: true })
      .in('tier', ['premium', 'pro']).gte('created_at', d30Ago),
    admin.from('profiles').select('*', { count: 'exact', head: true })
      .lt('trial_ends_at', now.toISOString())
      .eq('tier', 'free')
      .gte('created_at', d30Ago),
  ])

  return {
    premiumActive: premiumActive.count ?? 0,
    trialActive: trialActive.count ?? 0,
    freeUsers: freeUsers.count ?? 0,
    signupsLast30d: signupsLast30d.count ?? 0,
    trialsActivatedLast30d: trialsActivatedLast30d.count ?? 0,
    trialToPremiumLast30d: trialToPremiumLast30d.count ?? 0,
    trialsExpiredLast30d: trialsExpiredLast30d.count ?? 0,
    upcomingRenewals7d: null,
    ltvTotal: null,
  }
}

// ── Public export ─────────────────────────────────────────────
// NOTE: other query functions (getCronStatus, getMapList,
// findMapByPrefix, getMapData) are appended in subsequent tasks.
// The `queries` export below is extended accordingly.

export const queries: Queries = {
  getStats,
  getBattles,
  getPremium,
  // Placeholders filled in by later tasks:
  async getCronStatus() { throw new Error('not implemented yet (task 6)') },
  async getMapList() { throw new Error('not implemented yet (task 7)') },
  async findMapByPrefix() { throw new Error('not implemented yet (task 7)') },
  async getMapData() { throw new Error('not implemented yet (task 7)') },
}
