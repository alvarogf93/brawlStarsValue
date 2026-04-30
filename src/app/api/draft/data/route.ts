import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isPremium } from '@/lib/premium'
import { META_ROLLING_DAYS, isDraftMode } from '@/lib/draft/constants'
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

  if (!isDraftMode(mode)) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }

  if (map.length > 100) {
    return NextResponse.json({ error: 'Invalid map name' }, { status: 400 })
  }

  const serviceSupabase = await createServiceClient()
  const cutoffDate = new Date(Date.now() - META_ROLLING_DAYS * 86400000).toISOString().slice(0, 10)

  // PERF-07 — the three public queries below are independent of each other
  // (different sources / different tables, same map+mode filter). Promise.all
  // collapses serial 3×~120 ms into wall-clock max(...).
  const [
    { data: rawStats },
    { data: rawMatchups },
    { data: rawUsersStats },
  ] = await Promise.all([
    // 1. Global meta_stats for this map+mode.
    serviceSupabase
      .from('meta_stats')
      .select('brawler_id, wins, losses, total')
      .eq('map', map)
      .eq('mode', mode)
      .eq('source', 'global')
      .gte('date', cutoffDate),
    // 2. meta_matchups for this mode (mode-level, not map-level).
    serviceSupabase
      .from('meta_matchups')
      .select('brawler_id, opponent_id, wins, losses, total')
      .eq('mode', mode)
      .eq('source', 'global')
      .gte('date', cutoffDate),
    // 3. Users community data.
    serviceSupabase
      .from('meta_stats')
      .select('brawler_id, wins, losses, total')
      .eq('map', map)
      .eq('mode', mode)
      .eq('source', 'users')
      .gte('date', cutoffDate),
  ])

  const meta = aggregateStats(rawStats ?? [])
  const matchups = aggregateMatchups(rawMatchups ?? [])
  const usersData = aggregateStats(rawUsersStats ?? [])

  const result: DraftData = { meta, matchups, usersData }

  // 4. Check auth for personal data. We track whether the response carries
  //    user-specific data so the cache policy below can branch correctly.
  let isAuthenticated = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    isAuthenticated = !!user

    if (user) {
      // Single profile fetch (fixes double-query)
      const { data: profile } = await serviceSupabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile?.player_tag && isPremium(profile as Profile)) {
        const { data: battles } = await serviceSupabase
          .from('battles')
          .select('my_brawler, result')
          .eq('player_tag', profile.player_tag)
          .eq('map', map)
          .eq('mode', mode)
          .in('result', ['victory', 'defeat'])

        if (battles && battles.length > 0) {
          const personalMap = new Map<number, { wins: number; losses: number; total: number }>()
          for (const b of battles) {
            // Safe extraction from JSONB column
            const brawler = b.my_brawler as Record<string, unknown> | null
            const brawlerId = typeof brawler?.id === 'number' ? brawler.id : null
            if (brawlerId === null) continue

            const existing = personalMap.get(brawlerId) ?? { wins: 0, losses: 0, total: 0 }
            if (b.result === 'victory') existing.wins++
            else existing.losses++
            existing.total++
            personalMap.set(brawlerId, existing)
          }
          result.personal = Array.from(personalMap.entries()).map(([bId, s]) => ({
            brawlerId: bId,
            ...s,
          }))
        }
      }
    }
  } catch {
    // Auth check failed — return public data only
  }

  // PERF-07 — Cache-Control. Anonymous responses contain only public meta
  // data (meta + matchups + usersData), safe to cache at the edge for 15
  // min with a 5 min stale-while-revalidate buffer. Authenticated responses
  // may carry `result.personal`, so they MUST NOT touch any shared cache —
  // mark them `private, no-store` so neither the CDN nor the browser
  // serves a leaked copy.
  const cacheControl = isAuthenticated
    ? 'private, no-store'
    : 'public, s-maxage=900, stale-while-revalidate=300'

  return NextResponse.json(result, {
    headers: { 'Cache-Control': cacheControl },
  })
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
