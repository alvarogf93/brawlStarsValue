import { NextResponse, after } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notify } from '@/lib/telegram/notify'
import { envHeader } from '@/lib/telegram/env-label'
import { log, requestIdFrom } from '@/lib/log'

/**
 * POST /api/notify/signup
 *
 * Called once after a new profile is created to ping the admin Telegram
 * chat. Cookie-auth required.
 *
 * SEG-09 idempotency — `profiles.signup_notified_at` is NULL by default;
 * this route checks it before sending and writes the timestamp on success.
 * A double-call (refresh, retry, browser back-button) becomes a no-op
 * after the first successful Telegram delivery, avoiding duplicate
 * notifications and avoiding repeated email exposure to a third party.
 *
 * RES-03 — the actual Telegram send runs inside `after()` so the response
 * doesn't block on Telegram's HTTP roundtrip. `after()` continues
 * executing after the response is committed; failures inside it are
 * logged but never thrown.
 *
 * RES-04 — uses structured logging with the request_id so a "my admin
 * inbox shows duplicates" report can be cross-referenced to the route
 * trace.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    // Service-role client so the SEG-09 update can persist regardless of
    // RLS policies on `signup_notified_at` (the column is read-only to the
    // user, write-only to the route).
    const serviceSupabase = await createServiceClient()
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('player_tag, signup_notified_at')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ ok: false })
    }

    // SEG-09 — already notified. Return ok=true (the contract from the
    // client's perspective is "it ran"), but skip the Telegram side-effect.
    if (profile.signup_notified_at) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const playerTag = profile.player_tag
    const userId = user.id
    const email = user.email || 'unknown'
    // Build the public profile URL so the on-call admin can jump
    // directly to the user's profile from the alert. We don't have
    // the request locale here (signup notify is fired post-redirect),
    // so we hard-code 'es' which is the site default and the URL
    // pattern that yields a stable canonical.
    const profileUrl = `https://brawlvision.com/es/profile/${encodeURIComponent(playerTag)}`
    const createdAt = new Date().toISOString()

    after(async () => {
      try {
        await notify(
          `${envHeader()}🎮 <b>New signup!</b>\n` +
          `Tag: <code>${playerTag}</code>\n` +
          `Email: ${email}\n` +
          `At: ${createdAt}\n` +
          `🔗 ${profileUrl}`
        )
        // Persist the idempotency timestamp ONLY after successful delivery.
        // If Telegram is down we leave the column NULL so the next call
        // can retry — better one duplicate than a permanently missed
        // notification because we wrote the flag eagerly.
        const { error: updateErr } = await serviceSupabase
          .from('profiles')
          .update({ signup_notified_at: new Date().toISOString() })
          .eq('id', userId)
        if (updateErr) {
          log.warn('notify/signup', 'failed to mark signup_notified_at', {
            request_id: requestId,
            user_id: userId,
            err: updateErr.message,
          })
        }
      } catch (err) {
        log.error('notify/signup', 'telegram notify failed', {
          request_id: requestId,
          user_id: userId,
          err,
        })
      }
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    log.error('notify/signup', 'unexpected handler error', {
      request_id: requestId,
      err,
    })
    return NextResponse.json({ ok: false })
  }
}
