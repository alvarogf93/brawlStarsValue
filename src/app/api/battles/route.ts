import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
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
    const parsedLimit = parseInt(searchParams.get('limit') ?? '50', 10)
    const limit = Math.min(isNaN(parsedLimit) ? 50 : parsedLimit, 100)
    const aggregate = searchParams.get('aggregate') === 'true'

    // Server-side aggregation: returns stats without sending all battles
    if (aggregate) {
      const { data: battles } = await supabase
        .from('battles')
        .select('mode, map, result, trophy_change, is_star_player, my_brawler')
        .eq('player_tag', profile.player_tag)
        .limit(5000)

      return NextResponse.json({ analytics: battles ?? [], count: battles?.length ?? 0 })
    }

    // Paginated battles
    let query = supabase
      .from('battles')
      .select('*')
      .eq('player_tag', profile.player_tag)

    if (before) {
      const beforeDate = new Date(before)
      if (isNaN(beforeDate.getTime())) {
        return NextResponse.json({ error: 'Invalid before cursor' }, { status: 400 })
      }
      query = query.lt('battle_time', before)
    }

    const { data: battles, error } = await query
      .order('battle_time', { ascending: false })
      .limit(limit)

    if (error) {
      // SEG-08 — never echo PostgREST error messages to clients.
      // They include constraint names, column hints, occasionally
      // SQL fragments. Log server-side, return generic.
      console.error('[api/battles] query failed', error)
      return NextResponse.json({ error: 'Failed to fetch battles' }, { status: 500 })
    }

    const nextCursor = battles && battles.length === limit
      ? battles[battles.length - 1].battle_time
      : null

    return NextResponse.json({ battles: battles ?? [], nextCursor })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
