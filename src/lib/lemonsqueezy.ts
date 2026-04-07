import crypto from 'crypto'

const LS_API_BASE = 'https://api.lemonsqueezy.com/v1'

// ── HMAC Verification ──────────────────────────────────────

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !rawBody) return false
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

// ── Webhook Event Parsing ──────────────────────────────────

export interface WebhookEventData {
  eventName: string
  profileId: string
  subscriptionId: string
  customerId: string
  status: string
}

export function parseWebhookEvent(payload: Record<string, unknown>): WebhookEventData | null {
  const meta = payload.meta as Record<string, unknown> | undefined
  const data = payload.data as Record<string, unknown> | undefined

  if (!meta || !data) return null

  const customData = meta.custom_data as Record<string, unknown> | undefined
  const profileId = customData?.profile_id as string | undefined

  if (!profileId) return null

  const attributes = data.attributes as Record<string, unknown>

  return {
    eventName: meta.event_name as string,
    profileId,
    subscriptionId: String(data.id),
    customerId: String(attributes.customer_id),
    status: String(attributes.status),
  }
}

// ── Checkout URL Creation ──────────────────────────────────

export async function createCheckoutUrl(params: {
  variantId: string
  profileId: string
  userEmail: string
  redirectUrl: string
}): Promise<string> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY!
  const storeId = process.env.LEMONSQUEEZY_STORE_ID!

  const res = await fetch(`${LS_API_BASE}/checkouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: params.userEmail,
            custom: { profile_id: params.profileId },
          },
          product_options: {
            redirect_url: params.redirectUrl,
          },
        },
        relationships: {
          store: { data: { type: 'stores', id: storeId } },
          variant: { data: { type: 'variants', id: params.variantId } },
        },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Lemon Squeezy checkout failed: ${res.status} ${err}`)
  }

  const json = await res.json()
  return json.data.attributes.url
}

// ── Tier Mapping ───────────────────────────────────────────

export function statusToTier(eventName: string, status: string): { tier: string; subscriptionStatus: string } {
  switch (eventName) {
    case 'subscription_created':
      return { tier: 'premium', subscriptionStatus: 'active' }
    case 'subscription_updated':
      return { tier: (status === 'active' || status === 'cancelled') ? 'premium' : 'free', subscriptionStatus: status }
    case 'subscription_cancelled':
      return { tier: 'premium', subscriptionStatus: 'cancelled' }
    case 'subscription_expired':
      return { tier: 'free', subscriptionStatus: 'expired' }
    case 'subscription_payment_failed':
      return { tier: 'free', subscriptionStatus: 'past_due' }
    default:
      return { tier: 'free', subscriptionStatus: status }
  }
}
