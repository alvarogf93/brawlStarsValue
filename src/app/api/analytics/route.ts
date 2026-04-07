import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPremium } from '@/lib/premium'
import { computeAdvancedAnalytics } from '@/lib/analytics/compute'
import type { Profile, Battle } from '@/lib/supabase/types'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || !isPremium(profile as Profile)) {
    return NextResponse.json({ error: 'Premium required' }, { status: 403 })
  }

  // Fetch recent battles for analytics (cap at 5000 to prevent OOM)
  const { data: battles, error } = await supabase
    .from('battles')
    .select('*')
    .eq('player_tag', profile.player_tag)
    .order('battle_time', { ascending: false })
    .limit(5000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const analytics = computeAdvancedAnalytics((battles ?? []) as Battle[], timezone)

  return NextResponse.json(analytics)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
