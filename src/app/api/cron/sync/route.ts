import { NextResponse } from 'next/server'
import { createServiceClientNoCookies } from '@/lib/supabase/server'
import { syncBattlesAndMeta } from '@/lib/battle-sync'
import { writeCronHeartbeat, CRON_JOB_NAMES } from '@/lib/cron/heartbeat'

const BATCH_SIZE = 10
const SYNC_INTERVAL_MS = 20 * 60 * 1000 // 20 minutes

/**
 * Cron Job: sync premium users' battles automatically.
 * Called every 15 min from Oracle VPS crontab + daily Vercel cron fallback.
 * Processes up to BATCH_SIZE users per run.
 *
 * Per-profile work (fetch, upsert battles, aggregate meta, advance cursor)
 * lives in `syncBattlesAndMeta` (`src/lib/battle-sync.ts`) so the manual
 * `/api/sync` flow goes through the SAME path. See MIX-02.
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

  const results: Array<{ tag: string; fetched: number; inserted: number; metaRowsWritten: number; error?: string }> = []
  let totalMetaRowsWritten = 0
  for (const { player_tag, last_sync } of profiles) {
    // syncBattlesAndMeta returns `error` in the result rather than
    // throwing — it never propagates exceptions. We still wrap in
    // try/catch for defensive belt-and-suspenders against a future
    // refactor regression.
    try {
      const r = await syncBattlesAndMeta(supabase, player_tag, last_sync)
      totalMetaRowsWritten += r.metaRowsWritten
      if (r.error) {
        results.push({
          tag: player_tag,
          fetched: r.fetched,
          inserted: r.inserted,
          metaRowsWritten: r.metaRowsWritten,
          error: r.error,
        })
      } else {
        results.push({
          tag: player_tag,
          fetched: r.fetched,
          inserted: r.inserted,
          metaRowsWritten: r.metaRowsWritten,
        })
      }
    } catch (err) {
      results.push({ tag: player_tag, fetched: 0, inserted: 0, metaRowsWritten: 0, error: String(err) })
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
    metaRowsWritten: totalMetaRowsWritten,
  })

  return NextResponse.json({
    processed: results.length,
    metaRowsWritten: totalMetaRowsWritten,
    results,
  })
}
