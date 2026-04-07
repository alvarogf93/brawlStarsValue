import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyWebhookSignature, parseWebhookEvent, statusToTier } from '@/lib/lemonsqueezy'

export async function POST(request: Request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) {
    console.error('LEMONSQUEEZY_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('X-Signature') ?? ''
  const eventId = request.headers.get('X-Event-Id') ?? ''

  // 1. Verify HMAC signature
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  // 2. Idempotency check
  if (eventId) {
    const { error: insertErr } = await supabase
      .from('webhook_events')
      .insert({ event_id: eventId, event_type: 'lemonsqueezy' })

    if (insertErr?.code === '23505') {
      return NextResponse.json({ ok: true, skipped: true })
    }
  }

  // 3. Parse event
  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const event = parseWebhookEvent(payload)

  if (!event) {
    return NextResponse.json({ error: 'Could not parse event' }, { status: 400 })
  }

  // 4. Update profile tier
  const { tier, subscriptionStatus } = statusToTier(event.eventName, event.status)

  const { error: updateErr, count } = await supabase
    .from('profiles')
    .update({
      tier,
      ls_customer_id: event.customerId,
      ls_subscription_id: event.subscriptionId,
      ls_subscription_status: subscriptionStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', event.profileId)

  if (updateErr) {
    console.error('[webhook] Profile update failed:', {
      profileId: event.profileId,
      eventName: event.eventName,
      eventId,
      error: updateErr.message,
    })
    // Return 500 so Lemon Squeezy retries the webhook
    return NextResponse.json({ error: 'Profile update failed' }, { status: 500 })
  }

  if (count === 0) {
    console.error('[webhook] Profile not found for update:', {
      profileId: event.profileId,
      eventName: event.eventName,
      eventId,
    })
    // Return 500 to trigger retry — profile might not exist yet if auth is slow
    return NextResponse.json({ error: 'Profile not found' }, { status: 500 })
  }

  console.log('[webhook] Success:', {
    profileId: event.profileId,
    event: event.eventName,
    tier,
    status: subscriptionStatus,
  })

  return NextResponse.json({ ok: true })
}
