import { NextResponse } from 'next/server'
import { fetchClub, SuprecellApiError } from '@/lib/api'
import { PLAYER_TAG_REGEX } from '@/lib/constants'
import { enforceRateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  try {
    // Throttle BEFORE input validation. SEG-06.
    const rl = await enforceRateLimit(req, { limit: 30, window: '60 s' })
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.reset ?? 60) } },
      )
    }

    const { clubTag } = await req.json()

    // SEG-05 — single regex source. The previous /^#[0-9A-Z]{3,12}$/
    // (a) rejected valid 13+ char tags accepted by other routes,
    // creating a silent UX gap; and (b) was case-sensitive while
    // PLAYER_TAG_REGEX is case-insensitive — `.toUpperCase()` was a
    // workaround that masked the inconsistency.
    if (!clubTag || typeof clubTag !== 'string' || !PLAYER_TAG_REGEX.test(clubTag)) {
      return NextResponse.json({ error: 'Invalid or missing clubTag', code: 400 }, { status: 400 })
    }

    const data = await fetchClub(clubTag)
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof SuprecellApiError) {
      return NextResponse.json({ error: error.message, code: error.status }, { status: error.status })
    }
    return NextResponse.json({ error: 'Internal server error', code: 500 }, { status: 500 })
  }
}
