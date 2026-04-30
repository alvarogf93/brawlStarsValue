import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPremium } from '@/lib/premium'
import { computeAdvancedAnalytics } from '@/lib/analytics/compute'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import type { Profile, Battle } from '@/lib/supabase/types'

/**
 * GET /api/analytics — premium-gated analytics for the authenticated user.
 *
 * Rate limit (MIX-01, was per-instance Map): one request per 10 seconds per
 * user, enforced via Upstash Redis. The previous in-memory implementation
 * gave each Vercel function instance its own counter, so a parallel attacker
 * could fan out requests across regions and bypass the throttle. Falls open
 * in dev when Upstash creds are absent (logged once per process).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawTz = searchParams.get('tz') || undefined
    const timezone = rawTz && /^[A-Za-z0-9/_+-]+$/.test(rawTz) ? rawTz : undefined
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Per-user rate limit. Identifier is the Supabase user.id, not IP, because
    // the route is auth-required and a legitimate user behind shared NAT must
    // not get throttled by a sibling. 1 req / 10 s = 6 req/min — matches the
    // window the previous in-memory limiter enforced.
    const rl = await enforceRateLimit(
      request,
      { limit: 6, window: '60 s' },
      `analytics:${user.id}`,
    )
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limited. Please wait before requesting again.' },
        { status: 429, headers: rateLimitHeaders(rl, true) },
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile || !isPremium(profile as Profile)) {
      return NextResponse.json(
        { error: 'Premium required' },
        { status: 403, headers: rateLimitHeaders(rl, false) },
      )
    }

    // Fetch recent battles for analytics (cap at 5000 to prevent OOM)
    const { data: battles, error } = await supabase
      .from('battles')
      .select('*')
      .eq('player_tag', profile.player_tag)
      .order('battle_time', { ascending: false })
      .limit(5000)

    if (error) {
      // SEG-08 — log the constraint name server-side, return generic.
      console.error('[api/analytics] battles query failed', error)
      return NextResponse.json(
        { error: 'Failed to fetch analytics data' },
        { status: 500, headers: rateLimitHeaders(rl, false) },
      )
    }

    const analytics = computeAdvancedAnalytics((battles ?? []) as Battle[], timezone)

    return NextResponse.json(analytics, {
      headers: rateLimitHeaders(rl, false),
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
