import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PLAYER_TAG_REGEX } from '@/lib/constants'

// SEG-05 — single regex source. Previously this route declared its
// own /^#[0-9A-Z]{3,12}$/ which rejected legitimate 13+ char tags
// that /api/calculate, /api/battlelog and /api/player/tag-summary
// already accepted, breaking signup for those users silently.

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json(profile)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const playerTag = (body.player_tag ?? '').toUpperCase().trim()

    if (!PLAYER_TAG_REGEX.test(playerTag)) {
      return NextResponse.json({ error: 'Invalid player tag format' }, { status: 400 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .insert({ id: user.id, player_tag: playerTag })
      .select()
      .single()

    if (error) {
      // SEG-08 — map PostgREST error codes to stable, generic
      // messages. Echoing `error.message` exposed constraint names
      // (e.g. `profiles_player_tag_key`), turning the route into a
      // tag-existence oracle.
      console.error('[api/profile POST] insert failed', { code: error.code })
      const isUniqueViolation = error.code === '23505'
      const status = isUniqueViolation ? 409 : 500
      const message = isUniqueViolation
        ? 'Tag is already linked to another account'
        : 'Failed to create profile'
      return NextResponse.json({ error: message }, { status })
    }

    return NextResponse.json(profile, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
