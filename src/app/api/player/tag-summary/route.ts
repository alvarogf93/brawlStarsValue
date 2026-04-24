import { NextResponse } from 'next/server'
import { PLAYER_TAG_REGEX } from '@/lib/constants'
import { fetchPlayer, SuprecellApiError } from '@/lib/api'

/**
 * POST /api/player/tag-summary
 * Body: { playerTag: "#ABC123" }
 *
 * Lightweight tag lookup — returns only what the signup + /subscribe
 * flows actually need: does the tag exist, what are the trophies, what
 * is the player name. Costs **one** Supercell call vs `/api/calculate`
 * which fires three (player + battlelog + club) plus the gem-value
 * compute. Empirically the compute path added 1-3 s to the linkTag
 * handler, which was the single slowest step of signup.
 *
 * Uses POST (not GET) purely for consistency with the older `/api/calculate`
 * contract — the client body shape is the same, so swapping endpoints is
 * a one-line change in callers.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { playerTag } = body

    if (!playerTag || typeof playerTag !== 'string' || !PLAYER_TAG_REGEX.test(playerTag)) {
      return NextResponse.json(
        { error: 'Invalid player tag format' },
        { status: 400 },
      )
    }

    const player = await fetchPlayer(playerTag)

    return NextResponse.json({
      tag: player.tag,
      name: player.name,
      trophies: player.trophies ?? 0,
      highestTrophies: player.highestTrophies ?? 0,
      club: player.club ? { tag: player.club.tag, name: player.club.name } : null,
    })
  } catch (err) {
    if (err instanceof SuprecellApiError) {
      // 404 from Supercell = tag doesn't exist. Surface that specifically
      // so the caller can show "tag not found" instead of a generic error.
      if (err.status === 404) {
        return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
      }
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lookup failed' },
      { status: 500 },
    )
  }
}
