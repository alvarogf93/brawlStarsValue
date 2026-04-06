import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutUrl } from '@/lib/lemonsqueezy'
import { isPremium } from '@/lib/auth'
import type { Profile } from '@/lib/supabase/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const interval = body.interval as string

  if (interval !== 'monthly' && interval !== 'yearly') {
    return NextResponse.json({ error: 'interval must be "monthly" or "yearly"' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (isPremium(profile as Profile)) {
    return NextResponse.json({ error: 'Already premium' }, { status: 409 })
  }

  const variantId = interval === 'monthly'
    ? process.env.LEMONSQUEEZY_VARIANT_MONTHLY!
    : process.env.LEMONSQUEEZY_VARIANT_YEARLY!

  const { origin } = new URL(request.url)
  const redirectUrl = `${origin}/profile/${encodeURIComponent(profile.player_tag)}?upgraded=true`

  const url = await createCheckoutUrl({
    variantId,
    profileId: user.id,
    userEmail: user.email ?? '',
    redirectUrl,
  })

  return NextResponse.json({ url })
}
