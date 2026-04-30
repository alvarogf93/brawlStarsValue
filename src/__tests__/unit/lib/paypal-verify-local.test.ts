import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import {
  verifyPayPalWebhook,
  assertAllowedCertUrl,
  PayPalCertUrlError,
  __clearPayPalCertCache,
} from '@/lib/paypal'

// ── Test fixtures ──────────────────────────────────────────────────────────
//
// We generate a real RSA keypair once, sign a canonical webhook payload with
// the private key, and serve the public-key PEM as the "cert" via a mock fetch.
// This exercises the exact code path PayPal uses in production (SHA256withRSA,
// PKCS#1 v1.5) without hitting the network.

const WEBHOOK_ID = 'WH-TEST-fixture-id'
const TRANSMISSION_ID = 'tx-fixture-001'
const TRANSMISSION_TIME = '2026-04-28T11:47:00Z'
const VALID_CERT_URL = 'https://api.paypal.com/v1/notifications/certs/CERT-FIXTURE-1'

// JSON body with whitespace + key ordering chosen to make sure we never
// re-stringify it: the CRC32 must match the exact bytes on the wire.
const RAW_BODY = '{"event_type":"BILLING.SUBSCRIPTION.ACTIVATED","resource":{"id":"I-SUB123","custom_id":"profile-uuid-1","status":"ACTIVE"}}'

interface KeyPair {
  privateKey: crypto.KeyObject
  certPem: string
}

let keypair: KeyPair

function buildSignedString(body: string, webhookId = WEBHOOK_ID): string {
  const crc = zlib.crc32(Buffer.from(body, 'utf8'))
  return `${TRANSMISSION_ID}|${TRANSMISSION_TIME}|${webhookId}|${crc}`
}

function signPayload(body: string, opts: { privateKey: crypto.KeyObject; webhookId?: string }): string {
  const signed = buildSignedString(body, opts.webhookId)
  const signer = crypto.createSign('SHA256')
  signer.update(signed)
  signer.end()
  return signer.sign(opts.privateKey).toString('base64')
}

function makeHeaders(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': VALID_CERT_URL,
    'paypal-transmission-id': TRANSMISSION_ID,
    'paypal-transmission-sig': '',
    'paypal-transmission-time': TRANSMISSION_TIME,
    ...overrides,
  }
}

beforeAll(() => {
  // Generate once for the whole suite — keygen is slow.
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  // Export the public key in SPKI/PEM form. The verifier accepts any PEM that
  // crypto.createPublicKey can parse, so a "cert" containing just the SPKI
  // public key is sufficient for unit tests. Production receives a real
  // X.509 cert; createPublicKey extracts the public key from either.
  const certPem = publicKey.export({ type: 'spki', format: 'pem' }) as string
  keypair = { privateKey, certPem }
})

beforeEach(() => {
  __clearPayPalCertCache()
  vi.restoreAllMocks()
  // Freeze the wall-clock at TRANSMISSION_TIME + 1s so the anti-replay
  // window guard (5 min default) accepts the fixture without each test
  // having to inject `now`. Tests that need to exercise the window
  // explicitly (stale / future-dated webhooks) override this with their
  // own `now` injection or `vi.setSystemTime`.
  vi.useFakeTimers()
  vi.setSystemTime(new Date(Date.parse(TRANSMISSION_TIME) + 1000))
})

afterEach(() => {
  vi.useRealTimers()
})

function mockFetchReturningCert(certPem = keypair.certPem) {
  const fetchMock = vi.fn(async () => new Response(certPem, { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// ── Allowlist (RES-05) ─────────────────────────────────────────────────────

describe('assertAllowedCertUrl (RES-05 cert host pinning)', () => {
  it('accepts the live PayPal certs host', () => {
    expect(() =>
      assertAllowedCertUrl('https://api.paypal.com/v1/notifications/certs/CERT-1'),
    ).not.toThrow()
  })

  it('accepts the sandbox PayPal certs host', () => {
    expect(() =>
      assertAllowedCertUrl('https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1'),
    ).not.toThrow()
  })

  it('rejects a host that ends with paypal.com but is not on the allowlist', () => {
    // The classic "substring/endsWith bypass" — must be rejected.
    expect(() =>
      assertAllowedCertUrl('https://api.paypal.com.evil.com/v1/notifications/certs/CERT-1'),
    ).toThrow(PayPalCertUrlError)
  })

  it('rejects a host that contains paypal.com as a substring', () => {
    expect(() =>
      assertAllowedCertUrl('https://evil-api.paypal.com.attacker.io/v1/notifications/certs/CERT-1'),
    ).toThrow(PayPalCertUrlError)
  })

  it('rejects http (non-https) URLs', () => {
    expect(() =>
      assertAllowedCertUrl('http://api.paypal.com/v1/notifications/certs/CERT-1'),
    ).toThrow(PayPalCertUrlError)
  })

  it('rejects a path outside /v1/notifications/certs/', () => {
    expect(() =>
      assertAllowedCertUrl('https://api.paypal.com/v1/oauth2/token'),
    ).toThrow(PayPalCertUrlError)
  })

  it('rejects a malformed URL', () => {
    expect(() => assertAllowedCertUrl('not a url')).toThrow(PayPalCertUrlError)
  })
})

// ── Local signature verification ───────────────────────────────────────────

describe('verifyPayPalWebhook — local cryptographic verification (RES-01)', () => {
  it('returns { verified: true } for a valid signature against the raw body', async () => {
    mockFetchReturningCert()
    const sig = signPayload(RAW_BODY, { privateKey: keypair.privateKey })

    const result = await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({ 'paypal-transmission-sig': sig }),
      body: RAW_BODY,
    })

    expect(result.verified).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('returns { verified: false } when the body has been tampered (CRC mismatch)', async () => {
    mockFetchReturningCert()
    const sig = signPayload(RAW_BODY, { privateKey: keypair.privateKey })
    const tamperedBody = RAW_BODY.replace('"ACTIVE"', '"CANCELLED"')

    const result = await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({ 'paypal-transmission-sig': sig }),
      body: tamperedBody,
    })

    expect(result.verified).toBe(false)
    expect(result.reason).toBe('signature mismatch')
  })

  it('returns { verified: false } when the signature is wrong (different keypair)', async () => {
    mockFetchReturningCert()
    const otherKp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const sig = signPayload(RAW_BODY, { privateKey: otherKp.privateKey })

    const result = await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({ 'paypal-transmission-sig': sig }),
      body: RAW_BODY,
    })

    expect(result.verified).toBe(false)
    expect(result.reason).toBe('signature mismatch')
  })

  it('returns { verified: false } when the webhookId differs from the one in the signature', async () => {
    mockFetchReturningCert()
    // Attacker signs with a webhookId they control, but we verify with ours.
    const sig = signPayload(RAW_BODY, {
      privateKey: keypair.privateKey,
      webhookId: 'WH-ATTACKER-CONTROLLED',
    })

    const result = await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({ 'paypal-transmission-sig': sig }),
      body: RAW_BODY,
    })

    expect(result.verified).toBe(false)
    expect(result.reason).toBe('signature mismatch')
  })

  it('throws PayPalCertUrlError when cert URL is not on the allowlist (no fetch attempt)', async () => {
    const fetchMock = mockFetchReturningCert()

    await expect(
      verifyPayPalWebhook({
        webhookId: WEBHOOK_ID,
        headers: makeHeaders({
          'paypal-cert-url': 'https://api.paypal.com.evil.com/v1/notifications/certs/CERT-1',
          'paypal-transmission-sig': 'irrelevant',
        }),
        body: RAW_BODY,
      }),
    ).rejects.toBeInstanceOf(PayPalCertUrlError)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns { verified: false } when required webhook headers are missing', async () => {
    const fetchMock = mockFetchReturningCert()

    const result = await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({ 'paypal-transmission-sig': '' }),
      body: RAW_BODY,
    })

    expect(result.verified).toBe(false)
    expect(result.reason).toBe('missing webhook headers')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns { verified: false } when paypal-auth-algo is something other than SHA256withRSA', async () => {
    const fetchMock = mockFetchReturningCert()
    const sig = signPayload(RAW_BODY, { privateKey: keypair.privateKey })

    const result = await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({
        'paypal-auth-algo': 'SHA1withRSA',
        'paypal-transmission-sig': sig,
      }),
      body: RAW_BODY,
    })

    expect(result.verified).toBe(false)
    expect(result.reason).toBe('unsupported auth algo')
    // Fail-closed BEFORE any network call.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('caches the cert across calls (fetch invoked once)', async () => {
    const fetchMock = mockFetchReturningCert()
    const sig = signPayload(RAW_BODY, { privateKey: keypair.privateKey })

    const headers = makeHeaders({ 'paypal-transmission-sig': sig })

    const r1 = await verifyPayPalWebhook({ webhookId: WEBHOOK_ID, headers, body: RAW_BODY })
    const r2 = await verifyPayPalWebhook({ webhookId: WEBHOOK_ID, headers, body: RAW_BODY })
    const r3 = await verifyPayPalWebhook({ webhookId: WEBHOOK_ID, headers, body: RAW_BODY })

    expect(r1.verified).toBe(true)
    expect(r2.verified).toBe(true)
    expect(r3.verified).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refetches the cert after the TTL expires', async () => {
    // Use a transmission time AT the start of the test's wall-clock window
    // so that the cert TTL (1h) and anti-replay window (5 min) don't
    // collide: each verifyPayPalWebhook call passes its own `now`, but the
    // body's transmission-time has to be within 5 min of every `now`
    // value we check. We update the transmission-time per call to keep
    // it inside the window while still letting the cert cache age out.
    const fetchMock = mockFetchReturningCert()
    const TTL = 60 * 60 * 1000 // matches CERT_CACHE_TTL_MS in paypal.ts

    async function verifyAt(nowMs: number) {
      const ttIso = new Date(nowMs - 1000).toISOString()
      const headers = makeHeaders({
        'paypal-transmission-sig': '',
        'paypal-transmission-time': ttIso,
      })
      // Re-sign with the per-call transmission-time.
      const crc = zlib.crc32(Buffer.from(RAW_BODY, 'utf8'))
      const signed = `${TRANSMISSION_ID}|${ttIso}|${WEBHOOK_ID}|${crc}`
      const signer = crypto.createSign('SHA256')
      signer.update(signed)
      signer.end()
      headers['paypal-transmission-sig'] = signer.sign(keypair.privateKey).toString('base64')

      return verifyPayPalWebhook({
        webhookId: WEBHOOK_ID,
        headers,
        body: RAW_BODY,
        now: () => nowMs,
      })
    }

    const t0 = Date.parse('2026-04-28T12:00:00Z')
    const r1 = await verifyAt(t0)
    const r2 = await verifyAt(t0 + TTL - 1) // still cached
    const r3 = await verifyAt(t0 + TTL + 1) // cache expired

    expect([r1.verified, r2.verified, r3.verified]).toEqual([true, true, true])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('caches separately per cert URL', async () => {
    const fetchMock = mockFetchReturningCert()
    const sig = signPayload(RAW_BODY, { privateKey: keypair.privateKey })

    await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({ 'paypal-transmission-sig': sig }),
      body: RAW_BODY,
    })
    await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({
        'paypal-transmission-sig': sig,
        'paypal-cert-url': 'https://api.paypal.com/v1/notifications/certs/CERT-FIXTURE-2',
      }),
      body: RAW_BODY,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns { verified: false } when the cert fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not found', { status: 404 })),
    )
    const sig = signPayload(RAW_BODY, { privateKey: keypair.privateKey })

    const result = await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({ 'paypal-transmission-sig': sig }),
      body: RAW_BODY,
    })

    expect(result.verified).toBe(false)
    expect(result.reason).toBe('cert fetch failed')
  })

  it('returns { verified: false } when the cert PEM is unparseable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not a real PEM', { status: 200 })),
    )
    const sig = signPayload(RAW_BODY, { privateKey: keypair.privateKey })

    const result = await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({ 'paypal-transmission-sig': sig }),
      body: RAW_BODY,
    })

    expect(result.verified).toBe(false)
    expect(result.reason).toBe('cert parse failed')
  })

  it('does not include any env-derived secret in error reasons', async () => {
    // Sanity: even on every failure path, `reason` is a fixed enum string.
    // We assert on the shape — never on a substring of WEBHOOK_ID, since the
    // route turns reasons into a generic "Invalid signature" anyway.
    mockFetchReturningCert()
    const sig = signPayload(RAW_BODY, { privateKey: keypair.privateKey })

    const result = await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({ 'paypal-transmission-sig': sig }),
      body: RAW_BODY.replace('ACTIVE', 'PAUSED'),
    })

    expect(result.verified).toBe(false)
    expect(result.reason).not.toContain(WEBHOOK_ID)
    expect(result.reason).not.toContain(TRANSMISSION_ID)
  })
})

// ── Anti-replay protection (RES-01 hardening) ─────────────────────────────

describe('verifyPayPalWebhook — anti-replay window', () => {
  it('rejects a cryptographically valid webhook older than 5 min', async () => {
    mockFetchReturningCert()
    const sig = signPayload(RAW_BODY, { privateKey: keypair.privateKey })

    const result = await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({ 'paypal-transmission-sig': sig }),
      body: RAW_BODY,
      // 6 minutes after transmission-time → outside the 5 min window.
      now: () => Date.parse(TRANSMISSION_TIME) + 6 * 60 * 1000,
    })

    expect(result.verified).toBe(false)
    expect(result.reason).toBe('transmission time out of window')
  })

  it('rejects a webhook timestamped > 30s in the future (clock skew limit)', async () => {
    mockFetchReturningCert()
    const sig = signPayload(RAW_BODY, { privateKey: keypair.privateKey })

    const result = await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({ 'paypal-transmission-sig': sig }),
      body: RAW_BODY,
      // 60s before transmission-time → "future" webhook, beyond skew tolerance.
      now: () => Date.parse(TRANSMISSION_TIME) - 60 * 1000,
    })

    expect(result.verified).toBe(false)
    expect(result.reason).toBe('transmission time out of window')
  })

  it('accepts a webhook within the 5 min window', async () => {
    mockFetchReturningCert()
    const sig = signPayload(RAW_BODY, { privateKey: keypair.privateKey })

    const result = await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({ 'paypal-transmission-sig': sig }),
      body: RAW_BODY,
      // 4 minutes after transmission-time → still inside.
      now: () => Date.parse(TRANSMISSION_TIME) + 4 * 60 * 1000,
    })

    expect(result.verified).toBe(true)
  })

  it('rejects malformed paypal-transmission-time', async () => {
    mockFetchReturningCert()
    const sig = signPayload(RAW_BODY, { privateKey: keypair.privateKey })

    const result = await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({
        'paypal-transmission-sig': sig,
        'paypal-transmission-time': 'not-a-date',
      }),
      body: RAW_BODY,
    })

    expect(result.verified).toBe(false)
    expect(result.reason).toBe('invalid transmission-time format')
  })
})

// ── Regression for the original RES-01 bug: parse + re-stringify ──────────

describe('verifyPayPalWebhook — RES-01 round-trip regression', () => {
  it('rejects a body that has been JSON.parse + JSON.stringify round-tripped', async () => {
    // Construct a body with whitespace + ordering that JSON.stringify would
    // canonicalize away. CRC32 is byte-sensitive, so a re-stringify ALWAYS
    // produces different bytes when the source has any non-canonical
    // formatting. This locks the fix: if the function ever re-introduces
    // an internal JSON.parse/stringify of the body, this test fires.
    const PRETTY_BODY = '{\n  "event_type": "BILLING.SUBSCRIPTION.ACTIVATED",\n  "resource": { "id": "I-SUB123", "status": "ACTIVE" }\n}'

    mockFetchReturningCert()

    // Sign over the EXACT bytes on the wire — that's what the route does.
    const sig = signPayload(PRETTY_BODY, { privateKey: keypair.privateKey })

    // Sanity: the canonical form really differs from the wire bytes.
    const canonical = JSON.stringify(JSON.parse(PRETTY_BODY))
    expect(canonical).not.toBe(PRETTY_BODY)

    // Pass the canonical form (what a buggy implementation would CRC).
    const buggyResult = await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({ 'paypal-transmission-sig': sig }),
      body: canonical,
    })
    expect(buggyResult.verified).toBe(false)

    // Pass the original wire body (correct path).
    const correctResult = await verifyPayPalWebhook({
      webhookId: WEBHOOK_ID,
      headers: makeHeaders({ 'paypal-transmission-sig': sig }),
      body: PRETTY_BODY,
    })
    expect(correctResult.verified).toBe(true)
  })
})
