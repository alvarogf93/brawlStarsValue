import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock Supabase ───────────────────────────────────────────────
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
// Idempotency pre-check chain: from('webhook_events').select(...).eq(...).maybeSingle()
const mockMaybeSingle = vi.fn()
const mockSelectEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = vi.fn(() => ({ eq: mockSelectEq }))

const mockFrom = vi.fn((table: string) => {
  if (table === 'webhook_events') {
    return { insert: mockInsert, select: mockSelect }
  }
  if (table === 'profiles') {
    return { update: mockUpdate }
  }
  return {}
})

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({ from: mockFrom })),
}))

// ── Mock PayPal ─────────────────────────────────────────────────
const mockVerifyPayPalWebhook = vi.fn()
const mockGetSubscriptionDetails = vi.fn()

vi.mock('@/lib/paypal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/paypal')>()
  return {
    ...actual,
    verifyPayPalWebhook: (...args: unknown[]) => mockVerifyPayPalWebhook(...args),
    getSubscriptionDetails: (...args: unknown[]) => mockGetSubscriptionDetails(...args),
  }
})

// ── Mock Telegram (fire-and-forget, should never interfere) ────
vi.mock('@/lib/telegram', () => ({
  notify: vi.fn(),
}))

import { POST } from '@/app/api/webhooks/paypal/route'

// ── Helpers ─────────────────────────────────────────────────────

const VALID_EVENT = {
  event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
  resource: {
    id: 'I-SUB123',
    custom_id: 'profile-uuid-1',
    status: 'ACTIVE',
  },
}

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://example.com/cert',
    'paypal-transmission-id': 'tx-001',
    'paypal-transmission-sig': 'sig-abc',
    'paypal-transmission-time': '2026-04-09T10:00:00Z',
    ...headers,
  }

  return new Request('http://localhost:3000/api/webhooks/paypal', {
    method: 'POST',
    headers: defaultHeaders,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/webhooks/paypal', () => {
  const originalEnv = process.env.PAYPAL_WEBHOOK_ID

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PAYPAL_WEBHOOK_ID = 'wh-test-id'

    // Default: verification passes
    mockVerifyPayPalWebhook.mockResolvedValue(true)

    // Default: idempotency insert succeeds (no duplicate)
    mockInsert.mockResolvedValue({ error: null })

    // Default: idempotency pre-check finds nothing (fresh event)
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    // Default: profile update succeeds
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.PAYPAL_WEBHOOK_ID = originalEnv
    } else {
      delete process.env.PAYPAL_WEBHOOK_ID
    }
  })

  // ── Missing configuration ────────────────────────────────────

  it('returns 500 when PAYPAL_WEBHOOK_ID is not set', async () => {
    delete process.env.PAYPAL_WEBHOOK_ID
    const res = await POST(makeRequest(VALID_EVENT))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/misconfigured/i)
  })

  // ── Signature verification ───────────────────────────────────

  it('returns 401 when signature verification fails', async () => {
    mockVerifyPayPalWebhook.mockResolvedValue(false)
    const res = await POST(makeRequest(VALID_EVENT))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/signature/i)
  })

  // ── Idempotency ──────────────────────────────────────────────

  it('returns { ok: true, skipped: true } when pre-check finds processed event', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { event_id: 'paypal_tx-001' }, error: null })

    const res = await POST(makeRequest(VALID_EVENT))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.skipped).toBe(true)
    // Side-effect must NOT run when event already processed
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('logs and returns 200 when post-update idempotency mark fails (non-fatal)', async () => {
    // Effect already applied; even if the mark fails the user must not
    // be sent back into the retry loop forever.
    mockInsert.mockResolvedValue({ error: { code: '42000', message: 'unexpected DB error' } })

    const res = await POST(makeRequest(VALID_EVENT))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalled()
  })

  // ── Successful webhook processing ────────────────────────────

  it('processes valid BILLING.SUBSCRIPTION.ACTIVATED and returns { ok: true }', async () => {
    const res = await POST(makeRequest(VALID_EVENT))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.skipped).toBeUndefined()

    // Verify the insert was called with correct event_id format
    expect(mockInsert).toHaveBeenCalledWith({
      event_id: 'paypal_tx-001',
      event_type: 'paypal',
    })

    // Verify profile update was called
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 'premium',
        ls_subscription_id: 'I-SUB123',
        ls_subscription_status: 'active',
        ls_customer_id: 'paypal_I-SUB123',
      }),
    )
    expect(mockEq).toHaveBeenCalledWith('id', 'profile-uuid-1')
  })

  // ── Missing subscription ID ──────────────────────────────────

  it('returns 400 when resource.id is missing', async () => {
    const event = {
      event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
      resource: { custom_id: 'profile-1' },
    }

    const res = await POST(makeRequest(event))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/subscription/i)
  })

  // ── Missing profile ID with fallback ─────────────────────────

  it('returns 400 when no profile ID found (no custom_id, fallback fails)', async () => {
    const event = {
      event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
      resource: { id: 'I-SUB-NOPROFILE', status: 'ACTIVE' },
    }

    mockGetSubscriptionDetails.mockRejectedValue(new Error('PayPal API error'))

    const res = await POST(makeRequest(event))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/profile/i)
  })

  // ── Profile update failure ───────────────────────────────────

  it('returns 500 when profile update fails', async () => {
    mockEq.mockResolvedValue({ error: { message: 'RLS violation' } })

    const res = await POST(makeRequest(VALID_EVENT))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/update failed/i)
  })

  // ── LOG-02: idempotency only marked AFTER side-effect ────────

  it('does NOT mark idempotency when profile update fails — LOG-02', async () => {
    mockEq.mockResolvedValue({ error: { message: 'transient db error' } })

    const res = await POST(makeRequest(VALID_EVENT))
    expect(res.status).toBe(500)
    // Critical: webhook_events must remain free so PayPal's retry can
    // re-attempt the update. The previous order silently lost paid
    // upgrades when the first update failed transiently.
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('PayPal retry after transient failure completes the update — LOG-02 regression', async () => {
    // Attempt 1: update fails
    mockEq.mockResolvedValueOnce({ error: { message: 'transient' } })
    const first = await POST(makeRequest(VALID_EVENT))
    expect(first.status).toBe(500)
    expect(mockInsert).not.toHaveBeenCalled()

    // Attempt 2 (PayPal retry, same transmission-id): pre-check still
    // finds nothing, update now succeeds, idempotency mark applied.
    mockEq.mockResolvedValueOnce({ error: null })
    const second = await POST(makeRequest(VALID_EVENT))
    expect(second.status).toBe(200)
    const body = await second.json()
    expect(body.ok).toBe(true)
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockInsert).toHaveBeenCalledWith({
      event_id: 'paypal_tx-001',
      event_type: 'paypal',
    })
  })
})
