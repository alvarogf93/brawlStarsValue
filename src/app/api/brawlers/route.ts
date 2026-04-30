import { NextResponse } from 'next/server'
import { fetchBrawlers, SuprecellApiError } from '@/lib/api'
import { fetchWithRetry, getCircuitBreaker, BRAWLAPI_TIMEOUT_MS } from '@/lib/http'

const brawlapiBreaker = getCircuitBreaker('brawlapi')

/**
 * GET /api/brawlers
 *
 * Returns the game-wide brawler registry. The Supercell `/brawlers`
 * endpoint is the canonical source of truth for which brawlers exist
 * (always has new brawlers within minutes of release), but it does NOT
 * return rarity / class / images. Brawlify's `/v1/brawlers` API has
 * that metadata — but with a delay of hours-to-days after a new
 * Supercell release. We merge both sources and emit one stable shape:
 *
 *   {
 *     brawlerCount: number,
 *     maxGadgets: number,
 *     maxStarPowers: number,
 *     roster: {
 *       id: number, name: string,
 *       gadgets: number, starPowers: number, hyperCharges: number,
 *       rarity?: string,        // from Brawlify when available
 *       rarityColor?: string,   // hex from Brawlify
 *     }[],
 *   }
 *
 * `rarity` is OPTIONAL — when Brawlify is down, slow, or hasn't
 * published a brand-new brawler yet, the field is absent. Clients fall
 * back to a local hardcoded BRAWLER_RARITY_MAP and, beyond that, omit
 * the badge entirely (better than lying with a wrong rarity).
 *
 * Long cache-control because the roster only changes monthly. The
 * 24h s-maxage means a new brawler appears within 24h of release at
 * the latest. Brawlify is fetched defensively: any failure (timeout,
 * non-2xx, parse error) drops back to the Supercell-only roster.
 */
export async function GET() {
  try {
    const supercellData = await fetchBrawlers()
    const items = supercellData.items ?? []

    // Brawlify rarity in parallel — defensive: failure is fine, we
    // just emit the roster without rarity and clients fall back.
    const brawlifyRarity = await fetchBrawlifyRarity().catch(() => new Map<number, { name: string; color: string }>())

    let maxGadgets = 0
    let maxStarPowers = 0

    type RosterEntry = {
      id: number
      name: string
      gadgets: number
      starPowers: number
      hyperCharges: number
      rarity?: string
      rarityColor?: string
    }
    const roster: RosterEntry[] = []
    for (const b of items) {
      const g = b.gadgets?.length ?? 0
      const s = b.starPowers?.length ?? 0
      const h = (b as { hyperCharges?: unknown[] }).hyperCharges?.length ?? 0
      maxGadgets += g
      maxStarPowers += s

      const entry: RosterEntry = {
        id: b.id,
        name: b.name,
        gadgets: g,
        starPowers: s,
        hyperCharges: h,
      }
      const r = brawlifyRarity.get(b.id)
      if (r) {
        entry.rarity = r.name
        entry.rarityColor = r.color
      }
      roster.push(entry)
    }
    // Sort by id ascending for stable rendering — Supercell returns in
    // release order which is the same as ascending id today, but lock
    // it in case they ever shuffle.
    roster.sort((a, b) => a.id - b.id)

    return NextResponse.json(
      { brawlerCount: items.length, maxGadgets, maxStarPowers, roster },
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

interface BrawlifyBrawler {
  id: number
  rarity?: { name?: string; color?: string }
}

/**
 * Fetch the Brawlify roster and extract rarity by id. Returns a Map
 * keyed by Brawl Stars internal id (16000xxx). Empty map on any
 * failure — the caller treats absent entries as "rarity unknown".
 *
 * Wrapped in the brawlapi circuit breaker (PERF-01) so a Brawlify
 * outage doesn't drag the cron's budget. 5s timeout and 2 retries —
 * idempotent GET, safe to retry. Cached at the framework level via
 * next: { revalidate: 86400 } so concurrent calls de-dup.
 */
async function fetchBrawlifyRarity(): Promise<Map<number, { name: string; color: string }>> {
  const result = new Map<number, { name: string; color: string }>()
  const res = await brawlapiBreaker.execute(() =>
    fetchWithRetry(
      'https://api.brawlapi.com/v1/brawlers',
      { next: { revalidate: 86400 } } as RequestInit,
      { retries: 2, timeoutMs: BRAWLAPI_TIMEOUT_MS },
    ),
  )
  if (!res.ok) return result
  const json = (await res.json()) as { list?: BrawlifyBrawler[] }
  for (const b of json.list ?? []) {
    if (typeof b.id !== 'number' || !b.rarity?.name) continue
    result.set(b.id, {
      name: b.rarity.name,
      color: b.rarity.color ?? '#888',
    })
  }
  return result
}
