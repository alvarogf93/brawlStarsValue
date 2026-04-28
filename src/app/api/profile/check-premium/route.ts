import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { enforceRateLimit } from '@/lib/rate-limit'

/**
 * GET /api/profile/check-premium?tag=#TAG
 * Returns { hasPremium: boolean } for a given player tag.
 * No auth required — only returns a boolean, no profile data.
 * Uses service client to bypass RLS (safe: only returns a boolean).
 */
export async function GET(request: Request) {
  try {
    // Throttle BEFORE input validation. Light endpoint but flagged for
    // tag enumeration risk in SEG-10 — 60/min/IP is plenty for the
    // legitimate post-login probe. SEG-06.
    const rl = await enforceRateLimit(request, { limit: 60, window: '60 s' })
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.reset ?? 60) } },
      )
    }

    const { searchParams } = new URL(request.url)
    const tag = searchParams.get('tag')?.toUpperCase().trim()

    if (!tag || !/^#[0-9A-Z]{3,12}$/.test(tag)) {
      return NextResponse.json({ hasPremium: false })
    }

    const supabase = await createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, ls_subscription_status')
      .eq('player_tag', tag)
      .single()

    if (!profile) {
      return NextResponse.json({ hasPremium: false })
    }

    const status = profile.ls_subscription_status
    const hasPremium = profile.tier !== 'free' && (status === 'active' || status === 'cancelled')

    return NextResponse.json({ hasPremium })
  } catch {
    return NextResponse.json({ hasPremium: false })
  }
}
