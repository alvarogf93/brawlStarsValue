import { NextResponse } from 'next/server'
import { fetchWithRetry, getCircuitBreaker, BRAWLAPI_TIMEOUT_MS } from '@/lib/http'

const brawlapiBreaker = getCircuitBreaker('brawlapi')

export const dynamic = 'force-dynamic'

/**
 * GET /api/maps
 * Returns a map of mapName → imageUrl from BrawlAPI.
 * Cached 24h. Used by components that need map images by name
 * (not by eventId which may be null in some battles).
 */
export async function GET() {
  try {
    // PERF-01: timeout + idempotent GET retries + brawlapi breaker.
    const res = await brawlapiBreaker.execute(() =>
      fetchWithRetry(
        'https://api.brawlapi.com/v1/maps',
        { next: { revalidate: 86400 } } as RequestInit,
        { retries: 2, timeoutMs: BRAWLAPI_TIMEOUT_MS },
      ),
    )
    if (!res.ok) return NextResponse.json({})

    const data = await res.json()
    const list = (data.list ?? data) as Array<{ id: number; name: string; imageUrl?: string }>

    const mapping: Record<string, string> = {}
    for (const m of list) {
      if (!m.imageUrl) continue
      // BrawlAPI uses hyphens: "Belles-Rock" → we store "Belle's Rock"
      const withSpaces = m.name.replace(/-/g, ' ')
      mapping[withSpaces] = m.imageUrl
      mapping[m.name] = m.imageUrl
      // Apostrophe normalization: "Belles Rock" → "Belle's Rock"
      const withApostrophe = withSpaces.replace(/(\w)s\s/g, "$1's ")
      if (withApostrophe !== withSpaces) {
        mapping[withApostrophe] = m.imageUrl
      }
    }

    return NextResponse.json(mapping)
  } catch {
    return NextResponse.json({})
  }
}
