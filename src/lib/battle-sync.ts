import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchBattlelog } from '@/lib/api'
import { parseBattlelog } from '@/lib/battle-parser'
import { isDraftMode } from '@/lib/draft/constants'
import { processBattleForMeta, type MetaAccumulators } from '@/lib/draft/meta-accumulator'

export interface SyncResult {
  playerTag: string
  /** Battles returned by Supercell */
  fetched: number
  /** Battles upserted into `battles` table */
  inserted: number
  /** meta_stats + meta_matchups + meta_trios upserts (sum of accumulator sizes) */
  metaRowsWritten: number
  error: string | null
}

export interface SyncOptions {
  source?: 'users' | 'global'
}

/**
 * Per-profile sync: fetch battlelog, upsert into `battles`, aggregate
 * into meta_stats/meta_matchups (cursor-aware to avoid double counting),
 * and advance `profiles.last_sync` to now.
 *
 * Shared by the manual `/api/sync` flow (premium "Sync now" button) and
 * the scheduled `/api/cron/sync` cron — see MIX-02. Before unification,
 * the manual flow advanced `last_sync` without writing meta rows; the
 * next cron run would then skip those battles (`b.battle_time <= last_sync`)
 * and silently drop the user's contributions to `meta_stats source='users'`.
 *
 * Cursor semantics (preserved exactly from the cron):
 *   - Every fetched battle is inserted into `battles` (idempotent upsert
 *     by `(player_tag, battle_time)`), regardless of cursor.
 *   - Only battles with `battle_time > lastSync` flow into the meta
 *     accumulator. Battles at-or-before the cursor have already been
 *     accounted for and would be double-counted (meta_stats uses an
 *     additive ON CONFLICT in the bulk upsert RPC).
 *   - At the end, `last_sync` is advanced to NOW (not to max battle_time).
 *     This matches the existing cron convention.
 *
 * `bulk_upsert_meta_*` RPC failures are logged but non-fatal (matches
 * cron behavior — the battles are already saved, meta is best-effort).
 */
export async function syncBattlesAndMeta(
  supabase: SupabaseClient,
  playerTag: string,
  lastSync: string | null,
  opts: SyncOptions = {},
): Promise<SyncResult> {
  const source = opts.source ?? 'users'

  // 1. Fetch from Supercell API
  let response
  try {
    response = await fetchBattlelog(playerTag)
  } catch (err) {
    return { playerTag, fetched: 0, inserted: 0, metaRowsWritten: 0, error: String(err) }
  }
  const entries = response.items ?? []

  // Empty battlelog: still advance last_sync so we don't re-hit the API
  // immediately for a player with no new battles.
  if (entries.length === 0) {
    const { error: markEmptyErr } = await supabase
      .from('profiles')
      .update({ last_sync: new Date().toISOString() })
      .eq('player_tag', playerTag)
    if (markEmptyErr) {
      return {
        playerTag,
        fetched: 0,
        inserted: 0,
        metaRowsWritten: 0,
        error: `profiles.update (empty battlelog) failed: ${markEmptyErr.message}`,
      }
    }
    return { playerTag, fetched: 0, inserted: 0, metaRowsWritten: 0, error: null }
  }

  // 2. Parse battlelog into battle rows
  const parsed = parseBattlelog(entries, playerTag)

  // 3. Upsert all parsed battles (dedup by (player_tag, battle_time))
  const { error: battlesErr, count } = await supabase
    .from('battles')
    .upsert(parsed, {
      onConflict: 'player_tag,battle_time',
      ignoreDuplicates: true,
      count: 'exact',
    })
  if (battlesErr) {
    return {
      playerTag,
      fetched: entries.length,
      inserted: 0,
      metaRowsWritten: 0,
      error: `battles.upsert failed: ${battlesErr.message} (${parsed.length} rows)`,
    }
  }

  // 4. Aggregate meta_stats / meta_matchups for battles strictly newer
  //    than the cursor. Same gating as the cron — re-processing battles
  //    we've already accounted for would inflate the additive bulk RPC.
  const acc: MetaAccumulators = {
    stats: new Map(),
    matchups: new Map(),
    trios: new Map(),
  }
  for (const b of parsed) {
    if (lastSync && b.battle_time <= lastSync) continue
    if (!isDraftMode(b.mode) || !b.map) continue
    if (b.result !== 'victory' && b.result !== 'defeat') continue
    const myBrawlerId = b.my_brawler?.id
    if (typeof myBrawlerId !== 'number') continue
    const opponentIds = (b.opponents ?? [])
      .map(o => o?.brawler?.id)
      .filter((id): id is number => typeof id === 'number')
    processBattleForMeta(acc, {
      myBrawlerId,
      opponentBrawlerIds: opponentIds,
      map: b.map,
      mode: b.mode,
      result: b.result,
    })
  }

  // 5. Bulk-upsert meta accumulators. Best-effort: failures are logged
  //    but do NOT cause the sync to fail — the battles are already saved.
  const today = new Date().toISOString().slice(0, 10)
  if (acc.stats.size > 0) {
    const statRows = Array.from(acc.stats.entries()).map(([key, val]) => {
      const [brawlerId, map, mode] = key.split('|')
      return {
        brawler_id: Number(brawlerId),
        map,
        mode,
        source,
        date: today,
        wins: val.wins,
        losses: val.losses,
        total: val.total,
      }
    })
    try {
      await supabase.rpc('bulk_upsert_meta_stats', { rows: statRows })
    } catch (e) {
      console.warn('[sync] meta_stats RPC failed (non-critical):', String(e))
    }
  }
  if (acc.matchups.size > 0) {
    const matchupRows = Array.from(acc.matchups.entries()).map(([key, val]) => {
      const [brawlerId, opponentId, mode] = key.split('|')
      return {
        brawler_id: Number(brawlerId),
        opponent_id: Number(opponentId),
        mode,
        source,
        date: today,
        wins: val.wins,
        losses: val.losses,
        total: val.total,
      }
    })
    try {
      await supabase.rpc('bulk_upsert_meta_matchups', { rows: matchupRows })
    } catch (e) {
      console.warn('[sync] meta_matchups RPC failed (non-critical):', String(e))
    }
  }

  // 6. Advance the sync cursor. Same convention as the cron — last_sync
  //    moves to NOW, not to max(battle_time). A failure here matters:
  //    re-running would re-add the same battles to meta_stats (additive
  //    ON CONFLICT) and inflate counts. Surface as an error.
  const { error: markOkErr } = await supabase
    .from('profiles')
    .update({ last_sync: new Date().toISOString() })
    .eq('player_tag', playerTag)
  if (markOkErr) {
    return {
      playerTag,
      fetched: entries.length,
      inserted: count ?? parsed.length,
      metaRowsWritten: acc.stats.size + acc.matchups.size + acc.trios.size,
      error: `profiles.update (post-sync) failed: ${markOkErr.message}`,
    }
  }

  return {
    playerTag,
    fetched: entries.length,
    inserted: count ?? parsed.length,
    metaRowsWritten: acc.stats.size + acc.matchups.size + acc.trios.size,
    error: null,
  }
}

/**
 * Manual-sync entry point: thin wrapper around `syncBattlesAndMeta` that
 * creates a service-role client and reads the player's current `last_sync`
 * cursor before calling the unified helper.
 *
 * Public signature preserved for `/api/sync` callers.
 */
export async function syncBattles(playerTag: string): Promise<SyncResult> {
  const supabase = await createServiceClient()

  // Read the current cursor so the meta path skips already-counted
  // battles (the manual route's own rate-limiter doesn't guarantee
  // we've seen no battles since the last cron run).
  const { data: profile } = await supabase
    .from('profiles')
    .select('last_sync')
    .eq('player_tag', playerTag)
    .maybeSingle()
  const lastSync = (profile?.last_sync as string | null | undefined) ?? null

  return syncBattlesAndMeta(supabase, playerTag, lastSync)
}
