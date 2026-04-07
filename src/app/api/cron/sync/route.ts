import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { fetchBattlelog } from '@/lib/api'
import { parseBattlelog } from '@/lib/battle-parser'

const BATCH_SIZE = 10
const SYNC_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Vercel Cron Job: sync premium users' battles automatically.
 * Runs every minute, processes up to BATCH_SIZE users per run.
 * Replaces the pg_cron + Edge Function approach for reliability.
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

  // Find premium users who need syncing
  const cutoff = new Date(Date.now() - SYNC_INTERVAL_MS).toISOString()
  const { data: profiles, error: queryErr } = await supabase
    .from('profiles')
    .select('player_tag')
    .in('tier', ['premium', 'pro'])
    .or(`last_sync.is.null,last_sync.lt.${cutoff}`)
    .limit(BATCH_SIZE)

  if (queryErr || !profiles?.length) {
    return NextResponse.json({ processed: 0, reason: queryErr?.message || 'no users to sync' })
  }

  const results = []
  for (const { player_tag } of profiles) {
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
