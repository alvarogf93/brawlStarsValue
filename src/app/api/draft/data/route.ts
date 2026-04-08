import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isPremium } from '@/lib/premium'
import { META_ROLLING_DAYS } from '@/lib/draft/constants'
import type { Profile } from '@/lib/supabase/types'
import type { DraftData, MetaStat, MetaMatchup } from '@/lib/draft/types'

/**
 * GET /api/draft/data?map=Hard%20Rock%20Mine&mode=gemGrab
 *
 * Returns meta stats + matchups for a specific map/mode.
 * Auth levels:
 *   - No auth: meta + matchups (global)
 *   - Auth: adds usersData + userBrawlers
 *   - Auth + premium: adds personal stats
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const map = searchParams.get('map')
  const mode = searchParams.get('mode')

  if (!map || !mode) {
    return NextResponse.json({ error: 'map and mode are required' }, { status: 400 })
  }

  const serviceSupabase = await createServiceClient()
  const cutoffDate = new Date(Date.now() - META_ROLLING_DAYS * 86400000).toISOString().slice(0, 10)

  // 1. Fetch global meta_stats for this map+mode (public data)
  const { data: rawStats } = await serviceSupabase
    .from('meta_stats')
    .select('brawler_id, wins, losses, total')
    .eq('map', map)
    .eq('mode', mode)
    .eq('source', 'global')
    .gte('date', cutoffDate)

  // Aggregate by brawler (sum across dates)
  const meta = aggregateStats(rawStats ?? [])

  // 2. Fetch meta_matchups for this mode (public data, mode-level)
  const { data: rawMatchups } = await serviceSupabase
    .from('meta_matchups')
    .select('brawler_id, opponent_id, wins, losses, total')
    .eq('mode', mode)
    .eq('source', 'global')
    .gte('date', cutoffDate)

  const matchups = aggregateMatchups(rawMatchups ?? [])

  // 3. Fetch users community data
  const { data: rawUsersStats } = await serviceSupabase
    .from('meta_stats')
    .select('brawler_id, wins, losses, total')
    .eq('map', map)
    .eq('mode', mode)
    .eq('source', 'users')
    .gte('date', cutoffDate)

  const usersData = aggregateStats(rawUsersStats ?? [])

  const result: DraftData = { meta, matchups, usersData }

  // 4. Check auth for personal data
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // Add user's owned brawlers
      const { data: calcData } = await serviceSupabase
        .from('profiles')
        .select('player_tag')
        .eq('id', user.id)
        .single()

      if (calcData?.player_tag) {
        // Fetch user's brawlers from their most recent calculate data (cached)
        // For now, we'll rely on the client having this from usePlayerData

        // Add personal battle stats if premium
        const { data: profile } = await serviceSupabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profile && isPremium(profile as Profile)) {
          const { data: battles } = await serviceSupabase
            .from('battles')
            .select('my_brawler, result')
            .eq('player_tag', calcData.player_tag)
            .eq('map', map)
            .eq('mode', mode)
            .in('result', ['victory', 'defeat'])

          if (battles && battles.length > 0) {
            const personalMap = new Map<number, { wins: number; losses: number; total: number }>()
            for (const b of battles) {
              const brawlerId = (b.my_brawler as { id: number }).id
              const existing = personalMap.get(brawlerId) ?? { wins: 0, losses: 0, total: 0 }
              if (b.result === 'victory') existing.wins++
              else existing.losses++
              existing.total++
              personalMap.set(brawlerId, existing)
            }
            result.personal = Array.from(personalMap.entries()).map(([brawlerId, s]) => ({
              brawlerId,
              ...s,
            }))
          }
        }
      }
    }
  } catch {
    // Auth check failed — return public data only
  }

  return NextResponse.json(result)
}

/** Aggregate rows by brawler_id (sum wins/losses/total across dates) */
function aggregateStats(
  rows: { brawler_id: number; wins: number; losses: number; total: number }[],
): MetaStat[] {
  const map = new Map<number, MetaStat>()
  for (const r of rows) {
    const existing = map.get(r.brawler_id)
    if (existing) {
      existing.wins += r.wins
      existing.losses += r.losses
      existing.total += r.total
    } else {
      map.set(r.brawler_id, {
        brawlerId: r.brawler_id,
        wins: r.wins,
        losses: r.losses,
        total: r.total,
      })
    }
  }
  return Array.from(map.values())
}

/** Aggregate matchup rows by brawler+opponent (sum across dates) */
function aggregateMatchups(
  rows: { brawler_id: number; opponent_id: number; wins: number; losses: number; total: number }[],
): MetaMatchup[] {
  const map = new Map<string, MetaMatchup>()
  for (const r of rows) {
    const key = `${r.brawler_id}-${r.opponent_id}`
    const existing = map.get(key)
    if (existing) {
      existing.wins += r.wins
      existing.losses += r.losses
      existing.total += r.total
    } else {
      map.set(key, {
        brawlerId: r.brawler_id,
        opponentId: r.opponent_id,
        wins: r.wins,
        losses: r.losses,
        total: r.total,
      })
    }
  }
  return Array.from(map.values())
}
