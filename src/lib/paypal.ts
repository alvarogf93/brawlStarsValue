import { fetchWithRetry, fetchWithTimeout, getCircuitBreaker } from './http'

// PERF-01: PayPal sandbox stalls cascaded into webhook re-delivery storms.
// Per-process circuit breaker, 5 failures / 30 s, opens for 60 s.
const paypalBreaker = getCircuitBreaker('paypal')

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

  // OAuth2 client_credentials grant is idempotent — retry safe.
  const res = await paypalBreaker.execute(() =>
    fetchWithRetry(
      `${base}/v1/oauth2/token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      },
      { retries: 2, timeoutMs: 8_000 },
    ),
  )

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
  // POST without retries — creation is not idempotent.
  const res = await paypalBreaker.execute(() =>
    fetchWithTimeout(
      `${getPayPalBase()}/v1/catalogs/products`,
      {
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
      },
      8_000,
    ),
  )

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
  // POST without retries — plan creation is not idempotent.
  const res = await paypalBreaker.execute(() =>
    fetchWithTimeout(
      `${getPayPalBase()}/v1/billing/plans`,
      {
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
      },
      8_000,
    ),
  )

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

  // CRITICAL: createSubscription is NOT idempotent — never retry. A retry on
  // a 5xx that actually succeeded server-side would create two subscriptions
  // (and double-charge on activation). Use plain `fetchWithTimeout` only.
  const res = await paypalBreaker.execute(() =>
    fetchWithTimeout(
      `${getPayPalBase()}/v1/billing/subscriptions`,
      {
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
      },
      8_000,
    ),
  )

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

  // GET — idempotent, retry safe.
  const res = await paypalBreaker.execute(() =>
    fetchWithRetry(
      `${getPayPalBase()}/v1/billing/subscriptions/${subscriptionId}`,
      { headers: { Authorization: `Bearer ${token}` } },
      { retries: 2, timeoutMs: 8_000 },
    ),
  )

  if (!res.ok) throw new Error(`Get subscription failed: ${res.status}`)
  const data = await res.json()

  return {
    status: data.status, // ACTIVE, SUSPENDED, CANCELLED, EXPIRED
    customId: data.custom_id ?? null,
    planId: data.plan_id,
  }
}

// ── Webhook Verification (LOCAL, cert-pinned) ────────────────
//
// We do NOT delegate signature verification to PayPal's
// /v1/notifications/verify-webhook-signature anymore. That endpoint required
// us to JSON.parse(body) + JSON.stringify(body) before sending — which
// (a) silently breaks if PayPal changes its serialization, (b) opens the door
// to canonicalization-equivalence attacks, and (c) made every webhook hit a
// blocking outbound RPC.
//
// Per https://developer.paypal.com/api/rest/webhooks/rest/#link-eventheaders
// the signed message is:
//   transmissionId | transmissionTime | webhookId | crc32(rawBody)
// where crc32 is the unsigned 32-bit CRC of the raw HTTP body, in decimal.
// The signature header `paypal-transmission-sig` is base64-encoded and
// produced with SHA256withRSA (PKCS#1 v1.5) using PayPal's signing cert.
// We verify locally against the cert public key, with the cert URL pinned to
// the official PayPal hosts.

import crypto from 'node:crypto'
import zlib from 'node:zlib'

/** Hosts allowed to serve the PayPal signing certificate. */
const ALLOWED_CERT_HOSTS = new Set(['api.paypal.com', 'api.sandbox.paypal.com'])
const ALLOWED_CERT_PATH_PREFIX = '/v1/notifications/certs/'

/** Cache TTL for fetched signing certs. PayPal rotates infrequently. */
const CERT_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const CERT_FETCH_TIMEOUT_MS = 5000

interface CachedCert {
  pem: string
  fetchedAt: number
}

const certCache = new Map<string, CachedCert>()

export class PayPalCertUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PayPalCertUrlError'
  }
}

export interface PayPalWebhookVerifyResult {
  verified: boolean
  reason?: string
}

/**
 * Validate that a PayPal cert URL points to an official PayPal certs host.
 * Anchored on `parsed.host` (NOT a substring/.startsWith on the full URL),
 * so attacker-controlled hosts like `api.paypal.com.evil.com` are rejected.
 *
 * Throws `PayPalCertUrlError` with a generic message — never includes the URL
 * or any env-derived secret.
 */
export function assertAllowedCertUrl(certUrl: string): URL {
  let parsed: URL
  try {
    parsed = new URL(certUrl)
  } catch {
    throw new PayPalCertUrlError('cert url malformed')
  }
  if (parsed.protocol !== 'https:') {
    throw new PayPalCertUrlError('cert url must be https')
  }
  if (!ALLOWED_CERT_HOSTS.has(parsed.host)) {
    throw new PayPalCertUrlError('cert url host not allowlisted')
  }
  if (!parsed.pathname.startsWith(ALLOWED_CERT_PATH_PREFIX)) {
    throw new PayPalCertUrlError('cert url path not allowlisted')
  }
  return parsed
}

/**
 * Test-only seam: clear the in-memory cert cache between cases.
 * Not exported via barrel; tests reach into the module directly.
 */
export function __clearPayPalCertCache(): void {
  certCache.clear()
}

async function fetchCertPem(certUrl: string, now: number): Promise<string> {
  const cached = certCache.get(certUrl)
  if (cached && now - cached.fetchedAt < CERT_CACHE_TTL_MS) {
    return cached.pem
  }

  const res = await fetch(certUrl, {
    method: 'GET',
    signal: AbortSignal.timeout(CERT_FETCH_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error('cert fetch failed')
  }
  const pem = await res.text()
  certCache.set(certUrl, { pem, fetchedAt: now })
  return pem
}

/**
 * Verify a PayPal webhook signature LOCALLY against the raw body.
 *
 * Contract:
 *  - Receives the raw HTTP body as a string (DO NOT parse first).
 *  - Computes signed = `${transmissionId}|${transmissionTime}|${webhookId}|${crc32(rawBody)}`.
 *  - Verifies `paypal-transmission-sig` (base64) with SHA256withRSA against
 *    the public key extracted from the cert at `paypal-cert-url`.
 *  - Returns `{ verified: false, reason }` on every soft failure (no throw),
 *    so the route can convert false → 401 uniformly.
 *  - Throws `PayPalCertUrlError` ONLY when the cert URL fails the allowlist —
 *    that's a configuration / attack signal worth surfacing distinctly.
 */
export async function verifyPayPalWebhook(params: {
  webhookId: string
  headers: Record<string, string>
  body: string
  /** Injectable clock for tests. */
  now?: () => number
}): Promise<PayPalWebhookVerifyResult> {
  const transmissionId = params.headers['paypal-transmission-id']
  const transmissionTime = params.headers['paypal-transmission-time']
  const transmissionSig = params.headers['paypal-transmission-sig']
  const certUrl = params.headers['paypal-cert-url']
  const authAlgo = params.headers['paypal-auth-algo']

  // RES-01 supersedes the previous verify-webhook-signature outbound call:
  // local cryptographic verification removes the JSON.parse + JSON.stringify
  // of the raw body that the PayPal endpoint required (and which silently
  // accepted canonicalization-equivalent payloads). PERF-01's circuit breaker
  // and timeout still wrap the cert fetch via fetchCertPem below.
  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl) {
    return { verified: false, reason: 'missing webhook headers' }
  }
  // PayPal documents only SHA256withRSA today. If they ever rotate to a new
  // algorithm we want to fail closed rather than silently downgrade.
  if (authAlgo && authAlgo !== 'SHA256withRSA') {
    return { verified: false, reason: 'unsupported auth algo' }
  }

  // Pin cert URL to the official hosts. Throws on hostile values.
  assertAllowedCertUrl(certUrl)

  const now = (params.now ?? Date.now)()

  // Replay-attack guard. PayPal does not document a max-age window, so we
  // apply the industry-standard 5 min ± 30s clock skew tolerance used by
  // Stripe, GitHub and most major webhook providers. A captured webhook
  // older than this MUST be rejected even when the cryptographic signature
  // is valid — the idempotency table only protects against re-using the
  // same `paypal-transmission-id`, not against a fresh ID with replayed
  // body bytes.
  const transmissionMs = Date.parse(transmissionTime)
  if (!Number.isFinite(transmissionMs)) {
    return { verified: false, reason: 'invalid transmission-time format' }
  }
  const ageMs = now - transmissionMs
  const MAX_AGE_MS = 5 * 60 * 1000
  const SKEW_MS = 30 * 1000
  if (ageMs > MAX_AGE_MS || ageMs < -SKEW_MS) {
    return { verified: false, reason: 'transmission time out of window' }
  }

  let certPem: string
  try {
    certPem = await fetchCertPem(certUrl, now)
  } catch {
    return { verified: false, reason: 'cert fetch failed' }
  }

  let publicKey: crypto.KeyObject
  try {
    publicKey = crypto.createPublicKey(certPem)
  } catch {
    return { verified: false, reason: 'cert parse failed' }
  }

  // CRC32 of the RAW body bytes, unsigned 32-bit, decimal — exactly as
  // PayPal computes it. zlib.crc32 returns an unsigned int directly.
  const crc = zlib.crc32(Buffer.from(params.body, 'utf8'))
  const signed = `${transmissionId}|${transmissionTime}|${params.webhookId}|${crc}`

  let signatureBytes: Buffer
  try {
    signatureBytes = Buffer.from(transmissionSig, 'base64')
  } catch {
    return { verified: false, reason: 'signature decode failed' }
  }

  const verifier = crypto.createVerify('SHA256')
  verifier.update(signed)
  verifier.end()

  let ok = false
  try {
    // Pin the padding to PKCS#1 v1.5 explicitly. PayPal uses SHA256withRSA
    // with v1.5 padding; the Node default already matches but pinning makes
    // the intent obvious and forces a behaviour change to be a code change.
    ok = verifier.verify(
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      signatureBytes,
    )
  } catch {
    return { verified: false, reason: 'verify threw' }
  }

  return ok ? { verified: true } : { verified: false, reason: 'signature mismatch' }
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
      // LOG-14 — UPDATED + CANCELLED MUST preserve grace, identical
      // to the dedicated CANCELLED handler below. PayPal occasionally
      // emits both events for the same logical transition; if UPDATED
      // arrives later (event ordering is not guaranteed), the user
      // would otherwise be downgraded to `free` immediately and lose
      // the documented grace period that `isPremium()` relies on.
      // Same for SUSPENDED — keep premium until the dedicated
      // SUSPENDED event maps it explicitly.
      if (status === 'ACTIVE') {
        return { tier: 'premium', subscriptionStatus: 'active' }
      }
      if (status === 'CANCELLED') {
        return { tier: 'premium', subscriptionStatus: 'cancelled' }
      }
      if (status === 'SUSPENDED') {
        return { tier: 'free', subscriptionStatus: 'past_due' }
      }
      // Unknown UPDATED status — be conservative, mark as free with
      // the raw status so it surfaces in admin diagnostics.
      return { tier: 'free', subscriptionStatus: status.toLowerCase() }
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
