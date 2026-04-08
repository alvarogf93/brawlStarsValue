function getPayPalBase(): string {
  const mode = process.env.PAYPAL_MODE?.trim()
  // If PAYPAL_MODE is explicitly set, use it; otherwise default to live in production
  const isLive = mode ? mode === 'live' : process.env.NODE_ENV === 'production'
  return isLive
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
}

/** Get an OAuth2 access token from PayPal */
async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim()
  const secret = process.env.PAYPAL_SECRET?.trim()

  if (!clientId || !secret) {
    throw new Error('PayPal credentials not configured')
  }

  const base = getPayPalBase()
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64')

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    throw new Error(`PayPal auth failed: ${res.status}`)
  }

  const data = await res.json()
  return data.access_token
}

// ── Product & Plan Management ────────────────────────────────

/** Create a product in PayPal (only needs to be done once) */
export async function createProduct(): Promise<string> {
  const token = await getAccessToken()
  const res = await fetch(`${getPayPalBase()}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'BrawlVision Premium',
      description: 'Brawl Stars combat analytics subscription',
      type: 'SERVICE',
      category: 'SOFTWARE',
    }),
  })

  if (!res.ok) throw new Error(`Create product failed: ${res.status}`)
  const data = await res.json()
  return data.id
}

/** Create a subscription plan for a product */
export async function createPlan(params: {
  productId: string
  name: string
  price: string
  interval: 'MONTH' | 'YEAR'
  intervalCount?: number
}): Promise<string> {
  const token = await getAccessToken()
  const res = await fetch(`${getPayPalBase()}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_id: params.productId,
      name: params.name,
      billing_cycles: [
        {
          frequency: {
            interval_unit: params.interval,
            interval_count: params.intervalCount ?? 1,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // infinite
          pricing_scheme: {
            fixed_price: { value: params.price, currency_code: 'EUR' },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 3,
      },
    }),
  })

  if (!res.ok) throw new Error(`Create plan failed: ${res.status}`)
  const data = await res.json()
  return data.id
}

// ── Subscription Creation (Checkout) ─────────────────────────

export async function createSubscription(params: {
  planId: string
  profileId: string
  returnUrl: string
  cancelUrl: string
}): Promise<{ subscriptionId: string; approvalUrl: string }> {
  const token = await getAccessToken()

  const res = await fetch(`${getPayPalBase()}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plan_id: params.planId,
      custom_id: params.profileId,
      application_context: {
        brand_name: 'BrawlVision',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Create subscription failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  const approvalLink = data.links?.find((l: { rel: string }) => l.rel === 'approve')

  return {
    subscriptionId: data.id,
    approvalUrl: approvalLink?.href || '',
  }
}

// ── Subscription Status Check ────────────────────────────────

export async function getSubscriptionDetails(subscriptionId: string): Promise<{
  status: string
  customId: string | null
  planId: string
}> {
  const token = await getAccessToken()

  const res = await fetch(`${getPayPalBase()}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error(`Get subscription failed: ${res.status}`)
  const data = await res.json()

  return {
    status: data.status, // ACTIVE, SUSPENDED, CANCELLED, EXPIRED
    customId: data.custom_id ?? null,
    planId: data.plan_id,
  }
}

// ── Webhook Verification ─────────────────────────────────────

export async function verifyPayPalWebhook(params: {
  webhookId: string
  headers: Record<string, string>
  body: string
}): Promise<boolean> {
  const token = await getAccessToken()

  const res = await fetch(`${getPayPalBase()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: params.headers['paypal-auth-algo'],
      cert_url: params.headers['paypal-cert-url'],
      transmission_id: params.headers['paypal-transmission-id'],
      transmission_sig: params.headers['paypal-transmission-sig'],
      transmission_time: params.headers['paypal-transmission-time'],
      webhook_id: params.webhookId,
      webhook_event: JSON.parse(params.body),
    }),
  })

  if (!res.ok) return false
  const data = await res.json()
  return data.verification_status === 'SUCCESS'
}

// ── Tier Mapping ─────────────────────────────────────────────

export function paypalStatusToTier(eventType: string, status: string): {
  tier: string
  subscriptionStatus: string
} {
  // PayPal statuses: ACTIVE, SUSPENDED, CANCELLED, EXPIRED
  switch (eventType) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
      return { tier: 'premium', subscriptionStatus: 'active' }
    case 'BILLING.SUBSCRIPTION.UPDATED':
      return {
        tier: status === 'ACTIVE' ? 'premium' : 'free',
        subscriptionStatus: status === 'ACTIVE' ? 'active' : status.toLowerCase(),
      }
    case 'BILLING.SUBSCRIPTION.CANCELLED':
      return { tier: 'premium', subscriptionStatus: 'cancelled' } // grace period
    case 'BILLING.SUBSCRIPTION.SUSPENDED':
      return { tier: 'free', subscriptionStatus: 'past_due' }
    case 'BILLING.SUBSCRIPTION.EXPIRED':
      return { tier: 'free', subscriptionStatus: 'expired' }
    case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
      return { tier: 'free', subscriptionStatus: 'past_due' }
    default:
      return { tier: 'free', subscriptionStatus: status.toLowerCase() }
  }
}
