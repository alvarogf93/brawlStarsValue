import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyPayPalWebhook, paypalStatusToTier, getSubscriptionDetails } from '@/lib/paypal'

export async function POST(request: Request) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) {
    console.error('PAYPAL_WEBHOOK_ID not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const headers: Record<string, string> = {}
  for (const key of ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time']) {
    headers[key] = request.headers.get(key) ?? ''
  }

  // 1. Verify webhook signature
  const verified = await verifyPayPalWebhook({ webhookId, headers, body: rawBody })
  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  // 2. Parse event
  let event: { event_type: string; resource: { id: string; custom_id?: string; status?: string } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = event.event_type
  const subscriptionId = event.resource?.id

  if (!subscriptionId) {
    return NextResponse.json({ error: 'Missing subscription ID' }, { status: 400 })
  }

  // 3. Idempotency check
  const eventId = request.headers.get('paypal-transmission-id') ?? ''
  if (eventId) {
    const { error: insertErr } = await supabase
      .from('webhook_events')
      .insert({ event_id: `paypal_${eventId}`, event_type: 'paypal' })

    if (insertErr?.code === '23505') {
      return NextResponse.json({ ok: true, skipped: true })
    }
  }

  // 4. Get profile ID from subscription custom_id
  let profileId = event.resource?.custom_id
  if (!profileId) {
    // Fallback: fetch subscription details from PayPal
    try {
      const details = await getSubscriptionDetails(subscriptionId)
      profileId = details.customId ?? undefined
    } catch { /* ignore */ }
  }

  if (!profileId) {
    console.error('[paypal webhook] No profile ID found for subscription:', subscriptionId)
    return NextResponse.json({ error: 'No profile ID' }, { status: 400 })
  }

  // 5. Map event to tier
  const subscriptionStatus = event.resource?.status || 'UNKNOWN'
  const { tier, subscriptionStatus: mappedStatus } = paypalStatusToTier(eventType, subscriptionStatus)

  // 6. Update profile
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({
      tier,
      ls_subscription_id: subscriptionId,
      ls_subscription_status: mappedStatus,
      ls_customer_id: `paypal_${subscriptionId}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)

  if (updateErr) {
    console.error('[paypal webhook] Update failed:', updateErr.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  console.log('[paypal webhook] Success:', { profileId, eventType, tier, status: mappedStatus })
  return NextResponse.json({ ok: true })
}
