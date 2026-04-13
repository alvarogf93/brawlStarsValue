import { NextResponse } from 'next/server'
import { fetchBrawlers, SuprecellApiError } from '@/lib/api'

/**
 * GET /api/brawlers
 *
 * Returns the game-wide brawler registry aggregated into denominators
 * for the stats page completion charts.
 *
 * Shape:
 * {
 *   brawlerCount: number,     // total brawlers currently in the game
 *   maxGadgets: number,       // sum over all brawlers of gadgets.length
 *   maxStarPowers: number,    // sum over all brawlers of starPowers.length
 * }
 *
 * Hypercharges, gears and buffies are NOT in the Supercell `/brawlers`
 * payload — consumers compute those from constants × brawlerCount or
 * from a hardcoded current-max.
 *
 * Long cache-control because the roster only changes monthly.
 */
export async function GET() {
  try {
    const data = await fetchBrawlers()
    const items = data.items ?? []
    const brawlerCount = items.length
    let maxGadgets = 0
    let maxStarPowers = 0
    for (const b of items) {
      maxGadgets += b.gadgets?.length ?? 0
      maxStarPowers += b.starPowers?.length ?? 0
    }

    return NextResponse.json(
      { brawlerCount, maxGadgets, maxStarPowers },
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
