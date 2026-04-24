import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
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
      // Missing params = likely a direct hit or a botched callback. Send
      // the user home with a flag so UrlFlashMessage can explain.
      return NextResponse.redirect(`${origin}/${locale}?payment_error=1`)
    }

    // Verify subscription is active with PayPal
    const details = await getSubscriptionDetails(subscriptionId)
    const ok = details.status === 'ACTIVE' || details.status === 'APPROVED'

    if (ok) {
      const supabase = await createServiceClient()
      await supabase
        .from('profiles')
        .update({
          tier: 'premium',
          ls_subscription_id: subscriptionId,
          ls_subscription_status: 'active',
          ls_customer_id: `paypal_${subscriptionId}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId)
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
