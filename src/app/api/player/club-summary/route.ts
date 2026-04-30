import { NextResponse } from 'next/server'
import { PLAYER_TAG_REGEX } from '@/lib/constants'
import { fetchPlayer, fetchBattlelog, SuprecellApiError } from '@/lib/api'
import { calculateValue } from '@/lib/calculate'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit'

/**
 * GET /api/player/club-summary?tag=#TAG
 *
 * ARQ-14 — minimal lookup tailored to `useClubEnriched`. The previous
 * implementation invoked `/api/calculate` per club member, which fans out
 * to 3 Supercell calls (player + battlelog + club) plus the full
 * gem-value pipeline plus anonymous-visit tracking. For a 30-member
 * club that's 90 Supercell calls and 18–54 s wall time — explicitly
 * banned outside the landing page by CLAUDE.md.
 *
 * This endpoint trims the path:
 *   - 2 Supercell calls per member (player + battlelog), NOT the club
 *     lookup — members already share the club, badge metadata is
 *     unused by the hook.
 *   - Returns only the 9 fields `useClubEnriched` actually consumes.
 *   - No anonymous-visit side-effect; this is auth-irrelevant data
 *     about a known set of tags.
 *   - Rate-limited via the same Upstash helper as the other public
 *     POST routes (30 req/min/IP).
 *
 * The route is GET (cacheable at the edge in the future) and tag is
 * required. Invalid tags 400. Missing player 404. SuprecellApiError
 * statuses propagate.
 */

export interface ClubMemberSummary {
  totalGems: number
  brawlerCount: number
  powerLevelsGems: number
  totalVictories: number
  winRateUsed: number
  estimatedHoursPlayed: number
  highestTrophies: number
  totalPrestigeLevel: number
  expLevel: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tag = searchParams.get('tag')?.toUpperCase().trim()

    if (!tag || !PLAYER_TAG_REGEX.test(tag)) {
      return NextResponse.json(
        { error: 'Invalid or missing tag' },
        { status: 400 },
      )
    }

    // Throttle — 30/min/IP matches /api/battlelog and /api/club. SEG-06.
    const rl = await enforceRateLimit(request, { limit: 30, window: '60 s' })
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429, headers: rateLimitHeaders(rl, true) },
      )
    }

    // Fetch player + battlelog in parallel. Battlelog failures are
    // tolerated — the win-rate falls back to 0.5 (matching the
    // existing /api/calculate semantics so consumers stay consistent).
    const [playerData, battlelog] = await Promise.all([
      fetchPlayer(tag),
      fetchBattlelog(tag).catch(() => null),
    ])

    let winRate: number | undefined
    if (battlelog?.items?.length) {
      const battles = battlelog.items
      const wins = battles.filter(
        (b: { battle: { result: string } }) => b.battle.result === 'victory',
      ).length
      const total = battles.length
      if (total > 0) winRate = wins / total
    }

    const value = calculateValue(playerData, { winRate })

    const summary: ClubMemberSummary = {
      totalGems: value.totalGems,
      brawlerCount: playerData.brawlers?.length ?? 0,
      powerLevelsGems: value.breakdown.powerLevels.gems,
      totalVictories: value.stats.totalVictories,
      winRateUsed: value.stats.winRateUsed,
      estimatedHoursPlayed: value.stats.estimatedHoursPlayed,
      highestTrophies: playerData.highestTrophies,
      totalPrestigeLevel: playerData.totalPrestigeLevel ?? 0,
      expLevel: playerData.expLevel,
    }

    return NextResponse.json(summary, {
      headers: {
        ...rateLimitHeaders(rl, false),
        // 5 min cache — member data changes slowly. The client also
        // caches 15 min in localStorage so this is mostly first-load.
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    if (error instanceof SuprecellApiError) {
      const status = error.status
      const messages: Record<number, string> = {
        403: 'API access denied',
        404: 'Player not found',
        429: 'Brawl Stars rate limited, try again later',
        503: 'Brawl Stars servers under maintenance',
      }
      return NextResponse.json(
        { error: messages[status] ?? error.message },
        { status },
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
