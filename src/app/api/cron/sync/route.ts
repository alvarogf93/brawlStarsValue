import { NextResponse } from 'next/server'
import { createServiceClientNoCookies } from '@/lib/supabase/server'
import { fetchBattlelog } from '@/lib/api'
import { parseBattlelog } from '@/lib/battle-parser'
import { isDraftMode } from '@/lib/draft/constants'
import { processBattleForMeta, type MetaAccumulators } from '@/lib/draft/meta-accumulator'
import { writeCronHeartbeat, CRON_JOB_NAMES } from '@/lib/cron/heartbeat'

const BATCH_SIZE = 10
const SYNC_INTERVAL_MS = 20 * 60 * 1000 // 20 minutes

/**
 * Cron Job: sync premium users' battles automatically.
 * Called every 15 min from Oracle VPS crontab + daily Vercel cron fallback.
 * Processes up to BATCH_SIZE users per run.
 */
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClientNoCookies()

  const handlerStartedAt = Date.now()

  // Find premium users who need syncing (include last_sync for cursor-based meta dedup)
  const cutoff = new Date(Date.now() - SYNC_INTERVAL_MS).toISOString()
  const { data: profiles, error: queryErr } = await supabase
    .from('profiles')
    .select('player_tag, last_sync')
    .in('tier', ['premium', 'pro'])
    .or(`last_sync.is.null,last_sync.lt.${cutoff}`)
    .limit(BATCH_SIZE)

  if (queryErr || !profiles?.length) {
    // "no users to sync" is a SUCCESSFUL no-op — the cron ran, the
    // query succeeded (or was empty), nothing needed doing. Write
    // the heartbeat so staleness alarms don't fire during quiet
    // periods. A DB query error is NOT a success — skip the heartbeat
    // in that case so the staleness watchdog can catch it.
    if (!queryErr) {
      await writeCronHeartbeat(supabase, CRON_JOB_NAMES.SYNC, handlerStartedAt, {
        processed: 0,
        reason: 'no users to sync',
      })
    }
    return NextResponse.json({ processed: 0, reason: queryErr?.message || 'no users to sync' })
  }

  const results = []
  for (const { player_tag, last_sync } of profiles) {
    try {
      const response = await fetchBattlelog(player_tag)
      const entries = response.items ?? []

      if (entries.length === 0) {
        // Still advance `last_sync` even when the battlelog is empty so
        // we don't re-hit the API next run for the same player with no
        // new battles. The error-check here is defensive: Supabase JS
        // doesn't throw on PostgREST errors, and a silent failure would
        // leave `last_sync` stale and cause redundant fetches forever.
        const { error: markEmptyErr } = await supabase
          .from('profiles')
          .update({ last_sync: new Date().toISOString() })
          .eq('player_tag', player_tag)
        if (markEmptyErr) {
          throw new Error(`profiles.update (empty battlelog) failed: ${markEmptyErr.message}`)
        }
        results.push({ tag: player_tag, fetched: 0, inserted: 0 })
        continue
      }

      const parsed = parseBattlelog(entries, player_tag)
      // CRITICAL write. If the bulk upsert fails silently, every battle
      // in this batch is lost — destructure `error` and throw so the
      // outer per-player try/catch captures the failure and records it
      // in `results` (instead of a phantom success).
      const { count, error: battlesErr } = await supabase.from('battles').upsert(parsed, {
        onConflict: 'player_tag,battle_time',
        ignoreDuplicates: true,
        count: 'exact',
      })
      if (battlesErr) {
        throw new Error(`battles.upsert failed: ${battlesErr.message} (${parsed.length} rows)`)
      }

      // Aggregate into meta_stats/meta_matchups (source='users')
      // CRITICAL: only process battles NEWER than last_sync to prevent double counting.
      // The battles table has its own dedup (ignoreDuplicates), but meta_stats uses
      // additive ON CONFLICT (wins += EXCLUDED.wins), so re-processing the same
      // battles would inflate the stats.
      const acc: MetaAccumulators = { stats: new Map(), matchups: new Map(), trios: new Map() }
      const today = new Date().toISOString().slice(0, 10)
      for (const b of parsed) {
        // Skip battles already processed in a previous sync
        if (last_sync && b.battle_time <= last_sync) continue
        if (!isDraftMode(b.mode) || !b.map) continue
        if (b.result !== 'victory' && b.result !== 'defeat') continue
        const myBrawlerId = b.my_brawler?.id ?? null
        if (typeof myBrawlerId !== 'number') continue
        if (myBrawlerId === null) continue
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
      if (acc.stats.size > 0) {
        const statRows = Array.from(acc.stats.entries()).map(([key, val]) => {
          const [brawlerId, map, mode] = key.split('|')
          return { brawler_id: Number(brawlerId), map, mode, source: 'users', date: today, wins: val.wins, losses: val.losses, total: val.total }
        })
        try { await supabase.rpc('bulk_upsert_meta_stats', { rows: statRows }) } catch (e) { console.warn('[sync] meta_stats RPC failed (non-critical):', String(e)) }
      }
      if (acc.matchups.size > 0) {
        const matchupRows = Array.from(acc.matchups.entries()).map(([key, val]) => {
          const [brawlerId, opponentId, mode] = key.split('|')
          return { brawler_id: Number(brawlerId), opponent_id: Number(opponentId), mode, source: 'users', date: today, wins: val.wins, losses: val.losses, total: val.total }
        })
        try { await supabase.rpc('bulk_upsert_meta_matchups', { rows: matchupRows }) } catch (e) { console.warn('[sync] meta_matchups RPC failed (non-critical):', String(e)) }
      }

      // CRITICAL write. Advances the sync cursor so the next run skips
      // the battles we just processed. A silent failure here would cause
      // re-processing next run (harmless to `battles` thanks to
      // ignoreDuplicates, but re-adds to `meta_stats` via additive
      // ON CONFLICT and inflates counts). Destructure + throw.
      const { error: markOkErr } = await supabase
        .from('profiles')
        .update({ last_sync: new Date().toISOString() })
        .eq('player_tag', player_tag)
      if (markOkErr) {
        throw new Error(`profiles.update (post-sync) failed: ${markOkErr.message}`)
      }
      results.push({ tag: player_tag, fetched: entries.length, inserted: count ?? parsed.length })
    } catch (err) {
      results.push({ tag: player_tag, fetched: 0, inserted: 0, error: String(err) })
    }

    // Rate limit: 200ms between API calls
    await new Promise(r => setTimeout(r, 200))
  }

  // Success heartbeat — written after the whole batch finishes.
  // Partial success (some users errored) still counts as a
  // successful RUN because the cron itself did its job end-to-end.
  //
  // IMPORTANT: this write assumes nothing throws between the end of
  // the for-loop and this line. Today the only work between them is
  // the `errorCount` filter (a pure array op) and the helper call
  // itself (which never throws — it's best-effort). If a future
  // refactor adds exception-raising work after the loop, the
  // heartbeat could be skipped on a successful batch, causing
  // false "stale" alarms in the v2 watchdog. Keep the post-loop
  // section exception-free.
  //
  // `degraded` is a soft signal for the v2 alerting layer: a run
  // where >50% of users errored is technically "successful" (the
  // cron ran) but is effectively broken — Supercell rate-limited,
  // proxy flaky, one user's tag is invalid and poisoning retries,
  // etc. The watchdog should treat this separately from staleness.
  const errorCount = results.filter(r => 'error' in r).length
  const degraded = results.length > 0 && errorCount * 2 > results.length
  await writeCronHeartbeat(supabase, CRON_JOB_NAMES.SYNC, handlerStartedAt, {
    processed: results.length,
    errors: errorCount,
    degraded,
  })

  return NextResponse.json({ processed: results.length, results })
}
