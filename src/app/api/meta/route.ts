import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchEventRotation } from '@/lib/api'
import { isDraftMode } from '@/lib/draft/constants'
import { buildEventsWithCascade } from '@/lib/meta/cascade'

/**
 * GET /api/meta
 *
 * Returns current event rotation with top brawlers per map based on
 * aggregated meta_stats data. Public, no auth required.
 *
 * The aggregation lives in `lib/meta/cascade.ts` so the public picks
 * server component (`/[locale]/picks/page.tsx`) can share the exact
 * same logic without round-tripping through this API route. Both call
 * sites stay in lock-step (ARQ-03).
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const events = await fetchEventRotation()
    const draftEvents = events.filter(e => isDraftMode(e.event.mode))

    if (draftEvents.length === 0) {
      return NextResponse.json({ events: [] })
    }

    const supabase = await createServiceClient()
    const result = await buildEventsWithCascade(supabase, draftEvents)

    return NextResponse.json(
      { events: result },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
        },
      },
    )
  } catch (err) {
    console.error('[meta] Error:', err)
    return NextResponse.json({ events: [], error: 'Failed to load meta data' }, { status: 500 })
  }
}
