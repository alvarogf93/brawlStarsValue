import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSubscriptionDetails } from '@/lib/paypal'

/**
 * GET /api/checkout/paypal/confirm?subscription_id=...&profile_id=...&locale=...&tag=...
 * Called by PayPal after user approves the subscription.
 * Activates premium and redirects to profile.
 */
export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url)
    const subscriptionId = searchParams.get('subscription_id')
    const profileId = searchParams.get('profile_id')
    const locale = searchParams.get('locale') || 'es'
    const tag = searchParams.get('tag') || ''

    if (!subscriptionId || !profileId) {
      return NextResponse.redirect(`${origin}/${locale}?payment_error=1`)
    }

    // SEG-04 — bind the upgrade to the cookie session. Without this
    // an attacker with any valid auth session could call this URL
    // with another user's `profile_id` and a subscription_id they
    // observed elsewhere; the service-role update would then
    // happily promote the wrong profile.
    const cookieSupabase = await createClient()
    const { data: { user } } = await cookieSupabase.auth.getUser()
    if (!user || user.id !== profileId) {
      return NextResponse.redirect(`${origin}/${locale}?payment_error=1`)
    }

    // Verify subscription is active with PayPal
    const details = await getSubscriptionDetails(subscriptionId)
    const subscriptionActive = details.status === 'ACTIVE' || details.status === 'APPROVED'

    // SEG-04 (defence in depth) — the create flow pinned the
    // subscription's `custom_id` to the buyer's profile id (see
    // `src/lib/paypal.ts:125`). Reject any mismatch — that would
    // mean the supplied profile_id is not the legitimate buyer of
    // this subscription, i.e. upgrade-jacking from an observed
    // subscription_id.
    const subscriptionOwnsProfile = details.customId === profileId

    const ok = subscriptionActive && subscriptionOwnsProfile

    if (ok) {
      const supabase = await createServiceClient()
      // Skip the update if the webhook (which fires concurrently with this
      // callback) already wrote the same target state. Avoids two writes
      // per upgrade and keeps `updated_at` stable. The webhook is the
      // authoritative path; this callback is a UX nicety so the user sees
      // their upgrade reflected without waiting for the next poll.
      const { data: existing } = await supabase
        .from('profiles')
        .select('tier, ls_subscription_status, ls_subscription_id')
        .eq('id', profileId)
        .single()

      const alreadyApplied =
        existing?.tier === 'premium' &&
        existing?.ls_subscription_status === 'active' &&
        existing?.ls_subscription_id === subscriptionId

      if (!alreadyApplied) {
        // LOG-09 — destructure the error. The previous code ignored
        // `update`'s result, so a transient RLS/connection failure
        // would still send the user to the success page with
        // `?upgraded=true` while the profile silently stayed `free`.
        // The webhook is the authoritative path, but we cannot rely
        // on it 100% (LOG-02 documented several ways it can lose an
        // event). On failure here, surface payment_error so the user
        // is told and support can reconcile.
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({
            tier: 'premium',
            ls_subscription_id: subscriptionId,
            ls_subscription_status: 'active',
            ls_customer_id: `paypal_${subscriptionId}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profileId)

        if (updateErr) {
          console.error(
            '[paypal/confirm] profile update failed',
            { profileId, subscriptionId, code: updateErr.code, message: updateErr.message },
          )
          const errorRedirect = tag
            ? `${origin}/${locale}/profile/${encodeURIComponent(tag)}/subscribe?payment_error=1`
            : `${origin}/${locale}?payment_error=1`
          return NextResponse.redirect(errorRedirect)
        }
      }
    }

    // Success → profile dashboard with celebration flag.
    // Not-yet-active (SUSPENDED/CANCELLED/etc.) → redirect with payment_error
    // so the user gets told instead of a silent same-page reload.
    const redirectUrl = ok
      ? tag
        ? `${origin}/${locale}/profile/${encodeURIComponent(tag)}?upgraded=true`
        : `${origin}/${locale}?upgraded=true`
      : tag
        ? `${origin}/${locale}/profile/${encodeURIComponent(tag)}/subscribe?payment_error=1`
        : `${origin}/${locale}?payment_error=1`

    return NextResponse.redirect(redirectUrl)
  } catch {
    // PayPal API unreachable / unexpected body shape. Keep the user in
    // their locale and surface a visible error instead of a silent /es.
    const { searchParams, origin } = new URL(request.url)
    const locale = searchParams.get('locale') || 'es'
    return NextResponse.redirect(`${origin}/${locale}?payment_error=1`)
  }
}
