import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPremium } from '@/lib/premium'
import { computeCounterPick } from '@/lib/analytics/recommendations'
import type { Profile, Battle } from '@/lib/supabase/types'

export async function POST(request: Request) {
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

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const opponents: string[] = (body.opponents ?? []).filter((s: string) => s.trim())
  const map: string | undefined = body.map || undefined

  if (opponents.length === 0) {
    return NextResponse.json({ error: 'At least one opponent required' }, { status: 400 })
  }

  const { data: battles } = await supabase
    .from('battles')
    .select('*')
    .eq('player_tag', profile.player_tag)

  const results = computeCounterPick(
    (battles ?? []) as Battle[],
    opponents,
    map,
  )

  return NextResponse.json({ results })
}
