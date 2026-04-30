import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { enforceRateLimit, extractClientIp, rateLimitHeaders } from '@/lib/rate-limit'

/**
 * GET /api/profile/check-premium?tag=#TAG
 * Returns { hasPremium: boolean } for a given player tag.
 * No auth required — only returns a boolean, no profile data.
 * Uses service client to bypass RLS (safe: only returns a boolean).
 *
 * Rate-limit identity is `ip:tag` (not just IP). SEG-10 specifically
 * targets tag-enumeration attacks: a single IP could probe a small set of
 * known tags fast, but more realistically a botnet probes the same tag
 * from many IPs. Including the tag in the bucket means each (ip, tag)
 * pair shares its own 60/min budget — distributed enumeration of one tag
 * still hits the cap once attackers run out of unique IPs.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tag = searchParams.get('tag')?.toUpperCase().trim()

    // Pre-validate the tag so junk requests can't pollute the rate-limit
    // identifier space (a single IP firing 1M random tags would otherwise
    // create 1M cardinality in Redis).
    if (!tag || !/^#[0-9A-Z]{3,12}$/.test(tag)) {
      return NextResponse.json({ hasPremium: false })
    }

    const ip = extractClientIp(request)
    const rl = await enforceRateLimit(
      request,
      { limit: 60, window: '60 s' },
      `${ip}:${tag}`,
    )
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429, headers: rateLimitHeaders(rl, true) },
      )
    }

    const supabase = await createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, ls_subscription_status')
      .eq('player_tag', tag)
      .single()

    if (!profile) {
      return NextResponse.json(
        { hasPremium: false },
        { headers: rateLimitHeaders(rl, false) },
      )
    }

    const status = profile.ls_subscription_status
    const hasPremium = profile.tier !== 'free' && (status === 'active' || status === 'cancelled')

    return NextResponse.json(
      { hasPremium },
      { headers: rateLimitHeaders(rl, false) },
    )
  } catch {
    return NextResponse.json({ hasPremium: false })
  }
}
