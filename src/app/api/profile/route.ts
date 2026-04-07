import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TAG_REGEX = /^#[0-9A-Z]{3,12}$/

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

    if (!TAG_REGEX.test(playerTag)) {
      return NextResponse.json({ error: 'Invalid player tag format' }, { status: 400 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .insert({ id: user.id, player_tag: playerTag })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    return NextResponse.json(profile, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
