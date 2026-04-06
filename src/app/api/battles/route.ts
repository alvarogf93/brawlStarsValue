import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('player_tag')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const before = searchParams.get('before')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  const aggregate = searchParams.get('aggregate') === 'true'

  // Server-side aggregation: returns stats without sending all battles
  if (aggregate) {
    const { data: battles } = await supabase
      .from('battles')
      .select('mode, map, result, trophy_change, is_star_player, my_brawler, teammates')
      .eq('player_tag', profile.player_tag)

    return NextResponse.json({ analytics: battles ?? [], count: battles?.length ?? 0 })
  }

  // Paginated battles
  let query = supabase
    .from('battles')
    .select('*')
    .eq('player_tag', profile.player_tag)

  if (before) {
    query = query.lt('battle_time', before)
  }

  const { data: battles, error } = await query
    .order('battle_time', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const nextCursor = battles && battles.length === limit
    ? battles[battles.length - 1].battle_time
    : null

  return NextResponse.json({ battles: battles ?? [], nextCursor })
}
