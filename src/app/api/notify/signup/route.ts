import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notify } from '@/lib/telegram'

/**
 * POST /api/notify/signup
 * Called after a new profile is created to notify admin via Telegram.
 * Requires authentication — only the profile owner can trigger this.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('player_tag')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ ok: false })

    await notify(
      `🎮 <b>New signup!</b>\nTag: ${profile.player_tag}\nEmail: ${user.email || 'unknown'}`
    )

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
