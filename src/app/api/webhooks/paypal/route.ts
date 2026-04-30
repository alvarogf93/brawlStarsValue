import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  verifyPayPalWebhook,
  paypalStatusToTier,
  getSubscriptionDetails,
  PayPalCertUrlError,
} from '@/lib/paypal'
import { notify } from '@/lib/telegram/notify'

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

  // 1. Verify webhook signature LOCALLY against the raw body (RES-01 + RES-05).
  //    NOTE: `rawBody` is the original bytes; we deliberately do NOT JSON.parse it
  //    before verification — that round-trip used to allow canonicalization-equivalent
  //    payloads to slip past PayPal's remote verifier.
  let verified = false
  try {
    const result = await verifyPayPalWebhook({ webhookId, headers, body: rawBody })
    verified = result.verified
  } catch (err) {
    if (err instanceof PayPalCertUrlError) {
      // Hostile cert URL — log generically, return 401 (never echo the URL).
      console.warn('[paypal webhook] rejected cert URL')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    throw err
  }
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

  // 3. Resolve profile ID
  let profileId = event.resource?.custom_id
  if (!profileId) {
    try {
      const details = await getSubscriptionDetails(subscriptionId)
      profileId = details.customId ?? undefined
    } catch { /* ignore */ }
  }

  if (!profileId) {
    console.error('[paypal webhook] No profile ID found for subscription:', subscriptionId)
    return NextResponse.json({ error: 'No profile ID' }, { status: 400 })
  }

  // 4. Map event to tier
  const subscriptionStatus = event.resource?.status || 'UNKNOWN'
  const { tier, subscriptionStatus: mappedStatus } = paypalStatusToTier(eventType, subscriptionStatus)

  const eventId = request.headers.get('paypal-transmission-id') ?? ''

  // 5. Pre-check idempotency for fast-path: if we already processed this
  // event successfully, return early. Also short-circuits PayPal retries
  // that hit network glitches between our 200 and their ack.
  if (eventId) {
    const { data: existing } = await supabase
      .from('webhook_events')
      .select('event_id')
      .eq('event_id', `paypal_${eventId}`)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ ok: true, skipped: true })
    }
  }

  // 6. LOG-02 — Apply the side-effect FIRST. The previous order (mark
  // idempotency before update) meant a transient `profiles.update`
  // failure left the event marked as processed; PayPal's retry then
  // saw 23505 and returned `skipped`, leaving the user `free`
  // permanently after they had paid. Updates here are idempotent
  // (fixed value-set keyed on subscription_id), so re-running on
  // retry is safe.
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
    // No idempotency mark — PayPal must be allowed to retry until update succeeds.
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // 7. Mark event as processed AFTER the side-effect succeeded.
  if (eventId) {
    const { error: insertErr } = await supabase
      .from('webhook_events')
      .insert({ event_id: `paypal_${eventId}`, event_type: 'paypal' })

    if (insertErr && insertErr.code !== '23505') {
      // Effect already applied; log but do not fail the response — PayPal
      // would only retry and re-apply the same idempotent update.
      console.error('[paypal-webhook] Idempotency insert failed (non-fatal):', insertErr.message)
    }
  }

  console.info('[paypal webhook] Success: event=%s tier=%s status=%s', eventType, tier, mappedStatus)

  const emoji = tier === 'premium' ? '💰' : '⚠️'
  notify(`${emoji} <b>PayPal ${eventType.replace('BILLING.SUBSCRIPTION.', '')}</b>\nProfile: ${profileId}\nTier: ${tier} (${mappedStatus})`)

  return NextResponse.json({ ok: true })
}
