import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock Supabase (server) ────────────────────────────────────
const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockSelect = vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

// Tracks whether the confirm route's "skip if already premium" pre-check
// fires. Default: profile is in a non-premium state so the update IS issued.
type ProfileRow = {
  tier: 'free' | 'premium'
  ls_subscription_status: 'active' | 'cancelled' | null
  ls_subscription_id: string | null
}
type ProfileRead = { data: ProfileRow; error: null }
const mockServiceProfileRead = vi.fn<() => ProfileRead>(() => ({
  data: { tier: 'free', ls_subscription_status: null, ls_subscription_id: null },
  error: null,
}))
// RES-02 — the confirm route now chains `.eq().not('ls_subscription_status', 'in', ...)`
// after `.update()`. The mock builder returns a thennable that resolves to
// the configured update result regardless of which terminal method (`.eq` or
// `.not`) is called last, mirroring PostgREST's chain-builder shape.
const mockServiceUpdate = vi.fn(() => {
  const finalResult: { error: null | { code: string; message: string } } = { error: null }
  const thennable = {
    then: (resolve: (v: typeof finalResult) => unknown) => resolve(finalResult),
    eq: () => thennable,
    not: () => thennable,
  }
  return {
    ...thennable,
    // Allow tests to override the final result via mockReturnValueOnce on
    // the `eq()` returned object — this matches the legacy contract.
    eq: vi.fn(() => thennable),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
  createServiceClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      // Both `.select(...).eq(...).single()` and `.update(...).eq(...)` are
      // exercised by the confirm route. The select reads current state to
      // decide whether to apply the update; the update writes the new tier.
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockServiceProfileRead })) })),
      update: mockServiceUpdate,
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
    // Default cookie session: matches the profile_id used in the
    // happy-path tests below. SEG-04 cases override per-test.
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
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

  it('skips the profile update when the webhook already promoted the user (idempotency)', async () => {
    // PayPal says ACTIVE
    mockGetSubscriptionDetails.mockResolvedValue({
      status: 'ACTIVE',
      customId: 'u1',
      planId: 'P-MONTHLY-001',
    })
    // Pre-existing profile state — webhook already wrote this exact subscription
    mockServiceProfileRead.mockReturnValueOnce({
      data: { tier: 'premium', ls_subscription_status: 'active', ls_subscription_id: 'I-SUB-001' },
      error: null,
    })

    const res = await GET(makeGetRequest({
      subscription_id: 'I-SUB-001',
      profile_id: 'u1',
      locale: 'en',
      tag: '#TEST123',
    }))

    expect(res.status).toBe(307)
    // User STILL gets the upgraded toast (UX nicety) even though we skipped
    // the redundant DB write.
    expect(res.headers.get('Location')).toContain('upgraded=true')
    // Critical: no second update call when the row is already in the target state
    expect(mockServiceUpdate).not.toHaveBeenCalled()
  })

  it('preserves locale and surfaces payment_error on PayPal API error', async () => {
    mockGetSubscriptionDetails.mockRejectedValue(new Error('PayPal down'))

    const res = await GET(makeGetRequest({
      subscription_id: 'I-SUB-001',
      profile_id: 'u1',
      locale: 'en',
      tag: '#TEST123',
    }))

    expect(res.status).toBe(307)
    const location = res.headers.get('Location') || ''
    // Previously this silently fell back to /es. Now we keep the user in
    // their locale and raise a flag so UrlFlashMessage can explain.
    expect(location).toContain('/en')
    expect(location).toContain('payment_error=1')
  })

  // ── SEG-04 — IDOR / upgrade-jacking guards ───────────────────

  it('rejects when no cookie session — SEG-04', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await GET(makeGetRequest({
      subscription_id: 'I-SUB-001',
      profile_id: 'u1',
      locale: 'en',
      tag: '#TEST123',
    }))

    expect(res.status).toBe(307)
    const location = res.headers.get('Location') || ''
    expect(location).toContain('payment_error=1')
    // Must NOT call PayPal — anonymous attacker should not be able to
    // probe other users' subscription state.
    expect(mockGetSubscriptionDetails).not.toHaveBeenCalled()
    expect(mockServiceUpdate).not.toHaveBeenCalled()
  })

  it('rejects when cookie session user.id != profile_id — SEG-04', async () => {
    // Attacker logged in as 'attacker' tries to upgrade victim 'u1'
    mockGetUser.mockResolvedValue({ data: { user: { id: 'attacker' } } })

    const res = await GET(makeGetRequest({
      subscription_id: 'I-SUB-001',
      profile_id: 'u1',
      locale: 'en',
      tag: '#TEST123',
    }))

    expect(res.status).toBe(307)
    expect(res.headers.get('Location')).toContain('payment_error=1')
    expect(mockGetSubscriptionDetails).not.toHaveBeenCalled()
    expect(mockServiceUpdate).not.toHaveBeenCalled()
  })

  it('rejects when subscription customId != profile_id — SEG-04', async () => {
    // Attacker is logged in as 'u1' (cookie matches), but is using
    // a subscription_id whose custom_id was bound to victim 'victim'
    // when the sub was minted.
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockGetSubscriptionDetails.mockResolvedValue({
      status: 'ACTIVE',
      customId: 'victim',
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
    expect(location).toContain('payment_error=1')
    // Critical: profile must NOT be promoted to premium
    expect(mockServiceUpdate).not.toHaveBeenCalled()
  })

  it('rejects when subscription has no customId — SEG-04 strict', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockGetSubscriptionDetails.mockResolvedValue({
      status: 'ACTIVE',
      customId: null, // legacy or malformed sub
      planId: 'P-MONTHLY-001',
    })

    const res = await GET(makeGetRequest({
      subscription_id: 'I-SUB-001',
      profile_id: 'u1',
      locale: 'en',
      tag: '#TEST123',
    }))

    expect(res.status).toBe(307)
    expect(res.headers.get('Location')).toContain('payment_error=1')
    expect(mockServiceUpdate).not.toHaveBeenCalled()
  })

  it('LOG-09: surfaces payment_error when profile update fails (no silent upgraded=true)', async () => {
    // SEG-04 happy path (cookie + customId match) so we exercise the
    // post-validation update branch this test exists to cover.
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    // PayPal says ACTIVE — verification passes
    mockGetSubscriptionDetails.mockResolvedValue({
      status: 'ACTIVE',
      customId: 'u1',
      planId: 'P-MONTHLY-001',
    })
    // Profile is currently free → update WILL be issued
    mockServiceProfileRead.mockReturnValueOnce({
      data: { tier: 'free', ls_subscription_status: null, ls_subscription_id: null },
      error: null,
    })
    // The update fails (transient DB / RLS). The chain is now
    // `.update(...).eq(...).not(...)` — RES-02 added the `.not()` to skip the
    // overwrite when the webhook's CANCELLED already landed. Mirror it.
    const failingResult = { error: { code: '23000', message: 'transient db error' } }
    const failingChain = {
      then: (resolve: (v: typeof failingResult) => unknown) => resolve(failingResult),
      eq: () => failingChain,
      not: () => failingChain,
    }
    mockServiceUpdate.mockReturnValueOnce({
      ...failingChain,
      eq: vi.fn(() => failingChain),
    })

    const res = await GET(makeGetRequest({
      subscription_id: 'I-SUB-001',
      profile_id: 'u1',
      locale: 'en',
      tag: '#TEST123',
    }))

    expect(res.status).toBe(307)
    const location = res.headers.get('Location') || ''
    // Critical: must NOT show ?upgraded=true to a user whose tier
    // didn't actually flip. The previous code did exactly that.
    expect(location).not.toContain('upgraded=true')
    expect(location).toContain('payment_error=1')
    // Also: stays in locale + tag-scoped subscribe page so the user
    // can re-attempt instead of being bounced to the locale root.
    expect(location).toContain('/en/profile/')
    expect(location).toContain('/subscribe')
  })
})
