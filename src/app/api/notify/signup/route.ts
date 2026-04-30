import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notify } from '@/lib/telegram/notify'

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

    // RES-03 — fire-and-forget Telegram notify via `after()`. Previously
    // the response blocked on Telegram's HTTP roundtrip; if Telegram
    // hung, the client waited too. The notification is best-effort
    // observability, not part of the user contract.
    const playerTag = profile.player_tag
    const email = user.email || 'unknown'
    after(async () => {
      try {
        await notify(`🎮 <b>New signup!</b>\nTag: ${playerTag}\nEmail: ${email}`)
      } catch (err) {
        console.error('[notify/signup] telegram notify failed:', err)
      }
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
