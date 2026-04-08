import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/profile/check-premium?tag=#TAG
 * Returns { hasPremium: boolean } for a given player tag.
 * No auth required — only returns a boolean, no profile data.
 * Uses service client to bypass RLS (safe: only returns a boolean).
 */
export async function GET(request: Request) {
  try {
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
