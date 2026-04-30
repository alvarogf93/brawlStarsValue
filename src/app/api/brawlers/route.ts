import { NextResponse } from 'next/server'
import { fetchBrawlers, SuprecellApiError } from '@/lib/api'

/**
 * GET /api/brawlers
 *
 * Returns the game-wide brawler registry from the Supercell `/brawlers`
 * endpoint (the canonical source of truth — always has new brawlers
 * within minutes of release).
 *
 * Shape:
 * {
 *   brawlerCount: number,            // total brawlers currently in the game
 *   maxGadgets: number,              // sum over all brawlers of gadgets.length
 *   maxStarPowers: number,           // sum over all brawlers of starPowers.length
 *   roster: { id: number; name: string; gadgets: number; starPowers: number; hyperCharges: number }[]
 * }
 *
 * The `roster` array lets clients render the FULL game roster and
 * mark "locked" vs "owned" by cross-referencing with a player's own
 * `brawlers[]` from /players/{tag}. Without this, every page that
 * consumed `data.player.brawlers` could only show what the user
 * already owned — new brawlers were invisible until unlocked. The
 * fix: the public roster ships from here.
 *
 * Hypercharges, gears and buffies are NOT in the Supercell `/brawlers`
 * payload BEFORE per-brawler hyperCharges; consumers compute those from
 * constants × brawlerCount or from a hardcoded current-max.
 *
 * Long cache-control because the roster only changes monthly. The
 * 24h s-maxage means a new brawler appears within 24h of release at
 * the latest (or sooner if the cache key invalidates earlier).
 */
export async function GET() {
  try {
    const data = await fetchBrawlers()
    const items = data.items ?? []
    const brawlerCount = items.length
    let maxGadgets = 0
    let maxStarPowers = 0

    type RosterEntry = {
      id: number
      name: string
      gadgets: number
      starPowers: number
      hyperCharges: number
    }
    const roster: RosterEntry[] = []
    for (const b of items) {
      const g = b.gadgets?.length ?? 0
      const s = b.starPowers?.length ?? 0
      const h = (b as { hyperCharges?: unknown[] }).hyperCharges?.length ?? 0
      maxGadgets += g
      maxStarPowers += s
      roster.push({ id: b.id, name: b.name, gadgets: g, starPowers: s, hyperCharges: h })
    }
    // Sort by id ascending for stable rendering — Supercell returns in
    // release order which is the same as ascending id today, but lock
    // it in case they ever shuffle.
    roster.sort((a, b) => a.id - b.id)

    return NextResponse.json(
      { brawlerCount, maxGadgets, maxStarPowers, roster },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800',
        },
      },
    )
  } catch (error) {
    if (error instanceof SuprecellApiError) {
      return NextResponse.json(
        { error: error.message, code: error.status },
        { status: error.status },
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
