import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { fetchBattlelog } from '@/lib/api'
import { parseBattlelog } from '@/lib/battle-parser'
import { isDraftMode } from '@/lib/draft/constants'
import { processBattleForMeta, type MetaAccumulators } from '@/lib/draft/meta-accumulator'

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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  // Find premium users who need syncing (include last_sync for cursor-based meta dedup)
  const cutoff = new Date(Date.now() - SYNC_INTERVAL_MS).toISOString()
  const { data: profiles, error: queryErr } = await supabase
    .from('profiles')
    .select('player_tag, last_sync')
    .in('tier', ['premium', 'pro'])
    .or(`last_sync.is.null,last_sync.lt.${cutoff}`)
    .limit(BATCH_SIZE)

  if (queryErr || !profiles?.length) {
    return NextResponse.json({ processed: 0, reason: queryErr?.message || 'no users to sync' })
  }

  const results = []
  for (const { player_tag, last_sync } of profiles) {
    try {
      const response = await fetchBattlelog(player_tag)
      const entries = response.items ?? []

      if (entries.length === 0) {
        await supabase.from('profiles').update({ last_sync: new Date().toISOString() }).eq('player_tag', player_tag)
        results.push({ tag: player_tag, fetched: 0, inserted: 0 })
        continue
      }

      const parsed = parseBattlelog(entries, player_tag)
      const { count } = await supabase.from('battles').upsert(parsed, {
        onConflict: 'player_tag,battle_time',
        ignoreDuplicates: true,
        count: 'exact',
      })

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

      await supabase.from('profiles').update({ last_sync: new Date().toISOString() }).eq('player_tag', player_tag)
      results.push({ tag: player_tag, fetched: entries.length, inserted: count ?? parsed.length })
    } catch (err) {
      results.push({ tag: player_tag, fetched: 0, inserted: 0, error: String(err) })
    }

    // Rate limit: 200ms between API calls
    await new Promise(r => setTimeout(r, 200))
  }

  return NextResponse.json({ processed: results.length, results })
}
