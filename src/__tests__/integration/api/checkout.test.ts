import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock Supabase (server) ────────────────────────────────────
const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockSelect = vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
  createServiceClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
    })),
  })),
}))

// ── Mock PayPal ───────────────────────────────────────────────
const mockCreateSubscription = vi.fn()
const mockGetSubscriptionDetails = vi.fn()

vi.mock('@/lib/paypal', () => ({
  createSubscription: (...args: unknown[]) => mockCreateSubscription(...args),
  getSubscriptionDetails: (...args: unknown[]) => mockGetSubscriptionDetails(...args),
}))

// ── Mock premium ──────────────────────────────────────────────
const mockIsPremium = vi.fn()

vi.mock('@/lib/premium', () => ({
  isPremium: (...args: unknown[]) => mockIsPremium(...args),
}))

import { POST } from '@/app/api/checkout/paypal/route'
import { GET } from '@/app/api/checkout/paypal/confirm/route'

// ── Helpers ───────────────────────────────────────────────────

function makePostRequest(body: unknown) {
  return new Request('http://localhost:3000/api/checkout/paypal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/checkout/paypal/confirm')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new Request(url.toString(), { method: 'GET' })
}

// ── POST /api/checkout/paypal ─────────────────────────────────

describe('POST /api/checkout/paypal', () => {
  const originalMonthly = process.env.PAYPAL_PLAN_MONTHLY
  const originalQuarterly = process.env.PAYPAL_PLAN_QUARTERLY
  const originalYearly = process.env.PAYPAL_PLAN_YEARLY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PAYPAL_PLAN_MONTHLY = 'P-MONTHLY-001'
    process.env.PAYPAL_PLAN_QUARTERLY = 'P-QUARTERLY-001'
    process.env.PAYPAL_PLAN_YEARLY = 'P-YEARLY-001'
  })

  afterEach(() => {
    // Restore env
    const restore = (key: string, val: string | undefined) => {
      if (val !== undefined) process.env[key] = val
      else delete process.env[key]
    }
    restore('PAYPAL_PLAN_MONTHLY', originalMonthly)
    restore('PAYPAL_PLAN_QUARTERLY', originalQuarterly)
    restore('PAYPAL_PLAN_YEARLY', originalYearly)
  })

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await POST(makePostRequest({ interval: 'monthly' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authenticated/i)
  })

  it('returns 400 for invalid interval', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })

    const res = await POST(makePostRequest({ interval: 'weekly' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/interval/i)
  })

  it('returns 404 when profile is not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSingle.mockResolvedValue({ data: null })

    const res = await POST(makePostRequest({ interval: 'monthly' }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/profile/i)
  })

  it('returns 409 when user is already premium', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSingle.mockResolvedValue({
      data: { id: 'u1', player_tag: '#TEST', tier: 'premium' },
    })
    mockIsPremium.mockReturnValue(true)

    const res = await POST(makePostRequest({ interval: 'monthly' }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already premium/i)
  })

  it('returns 500 when plan is not configured', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSingle.mockResolvedValue({
      data: { id: 'u1', player_tag: '#TEST', tier: 'free' },
    })
    mockIsPremium.mockReturnValue(false)
    delete process.env.PAYPAL_PLAN_MONTHLY

    const res = await POST(makePostRequest({ interval: 'monthly' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/plan not configured/i)
  })

  it('returns approval URL on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSingle.mockResolvedValue({
      data: { id: 'u1', player_tag: '#TEST', tier: 'free' },
    })
    mockIsPremium.mockReturnValue(false)
    mockCreateSubscription.mockResolvedValue({
      subscriptionId: 'I-SUB-001',
      approvalUrl: 'https://paypal.com/approve/I-SUB-001',
    })

    const res = await POST(makePostRequest({ interval: 'monthly', locale: 'en' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://paypal.com/approve/I-SUB-001')
    expect(mockCreateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: 'P-MONTHLY-001',
        profileId: 'u1',
      }),
    )
  })
})

// ── GET /api/checkout/paypal/confirm ──────────────────────────

describe('GET /api/checkout/paypal/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to locale root when subscription_id is missing', async () => {
    const res = await GET(makeGetRequest({ profile_id: 'u1', locale: 'en' }))
    expect(res.status).toBe(307)
    const location = res.headers.get('Location') || ''
    expect(location).toContain('/en')
    // Should NOT crash
  })

  it('redirects to locale root when profile_id is missing', async () => {
    const res = await GET(makeGetRequest({ subscription_id: 'I-SUB-001', locale: 'fr' }))
    expect(res.status).toBe(307)
    const location = res.headers.get('Location') || ''
    expect(location).toContain('/fr')
  })

  it('redirects to locale root when both params are missing', async () => {
    const res = await GET(makeGetRequest({ locale: 'de' }))
    expect(res.status).toBe(307)
    const location = res.headers.get('Location') || ''
    expect(location).toContain('/de')
  })

  it('redirects to profile page with upgraded=true on success', async () => {
    mockGetSubscriptionDetails.mockResolvedValue({
      status: 'ACTIVE',
      customId: 'u1',
      planId: 'P-MONTHLY-001',
    })

    const res = await GET(makeGetRequest({
      subscription_id: 'I-SUB-001',
      profile_id: 'u1',
      locale: 'en',
      tag: '#TEST123',
    }))

    expect(res.status).toBe(307)
    const location = res.headers.get('Location') || ''
    expect(location).toContain('/en/profile/')
    expect(location).toContain('upgraded=true')
  })

  it('redirects to fallback on PayPal API error', async () => {
    mockGetSubscriptionDetails.mockRejectedValue(new Error('PayPal down'))

    const res = await GET(makeGetRequest({
      subscription_id: 'I-SUB-001',
      profile_id: 'u1',
      locale: 'en',
      tag: '#TEST123',
    }))

    expect(res.status).toBe(307)
    const location = res.headers.get('Location') || ''
    // Falls back to /es in the catch block
    expect(location).toContain('/es')
  })
})
