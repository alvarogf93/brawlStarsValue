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
      return NextResponse.redirect(`${origin}/${locale}`)
    }

    // Verify subscription is active with PayPal
    const details = await getSubscriptionDetails(subscriptionId)

    if (details.status === 'ACTIVE' || details.status === 'APPROVED') {
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

    const redirectUrl = tag
      ? `${origin}/${locale}/profile/${encodeURIComponent(tag)}?upgraded=true`
      : `${origin}/${locale}`

    return NextResponse.redirect(redirectUrl)
  } catch {
    const { origin } = new URL(request.url)
    return NextResponse.redirect(`${origin}/es`)
  }
}
