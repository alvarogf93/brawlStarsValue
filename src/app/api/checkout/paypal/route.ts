import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSubscription } from '@/lib/paypal'
import { isPremium } from '@/lib/premium'
import type { Profile } from '@/lib/supabase/types'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const interval = body.interval as string

    if (!['monthly', 'quarterly', 'yearly'].includes(interval)) {
      return NextResponse.json({ error: 'interval must be "monthly", "quarterly", or "yearly"' }, { status: 400 })
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

    const planMap: Record<string, string | undefined> = {
      monthly: process.env.PAYPAL_PLAN_MONTHLY,
      quarterly: process.env.PAYPAL_PLAN_QUARTERLY,
      yearly: process.env.PAYPAL_PLAN_YEARLY,
    }
    const planId = planMap[interval]
    if (!planId) {
      return NextResponse.json({ error: 'Plan not configured' }, { status: 500 })
    }

    const { origin } = new URL(request.url)
    const locale = body.locale || 'es'
    const returnUrl = `${origin}/api/checkout/paypal/confirm?profile_id=${user.id}&locale=${locale}&tag=${encodeURIComponent(profile.player_tag)}`
    const cancelUrl = `${origin}/${locale}/profile/${encodeURIComponent(profile.player_tag)}/analytics`

    const { approvalUrl } = await createSubscription({
      planId,
      profileId: user.id,
      returnUrl,
      cancelUrl,
    })

    return NextResponse.json({ url: approvalUrl })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Checkout failed' }, { status: 500 })
  }
}
