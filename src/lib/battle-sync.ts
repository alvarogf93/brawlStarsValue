import { createServiceClient } from '@/lib/supabase/server'
import { fetchBattlelog } from '@/lib/api'
import { parseBattlelog } from '@/lib/battle-parser'

export interface SyncResult {
  playerTag: string
  fetched: number
  inserted: number
  error: string | null
}

/**
 * Fetch the latest battlelog from Supercell API, parse battles,
 * and insert into the database with deduplication.
 * Uses service role client (bypasses RLS).
 */
export async function syncBattles(playerTag: string): Promise<SyncResult> {
  const supabase = await createServiceClient()

  // 1. Fetch from Supercell API
  let response
  try {
    response = await fetchBattlelog(playerTag)
  } catch (err) {
    return { playerTag, fetched: 0, inserted: 0, error: String(err) }
  }
  const entries = response.items ?? []

  if (entries.length === 0) {
    await supabase
      .from('profiles')
      .update({ last_sync: new Date().toISOString() })
      .eq('player_tag', playerTag)

    return { playerTag, fetched: 0, inserted: 0, error: null }
  }

  // 2. Parse into database rows
  const parsed = parseBattlelog(entries, playerTag)

  // 3. Insert with deduplication (ON CONFLICT DO NOTHING)
  const { error, count } = await supabase
    .from('battles')
    .upsert(parsed, {
      onConflict: 'player_tag,battle_time',
      ignoreDuplicates: true,
      count: 'exact',
    })

  if (error) {
    return { playerTag, fetched: entries.length, inserted: 0, error: error.message }
  }

  // 4. Update last_sync timestamp
  await supabase
    .from('profiles')
    .update({ last_sync: new Date().toISOString() })
    .eq('player_tag', playerTag)

  return { playerTag, fetched: entries.length, inserted: count ?? parsed.length, error: null }
}
