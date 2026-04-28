import { describe, it, expect, vi, beforeEach } from 'vitest'

const { enforceRateLimitMock } = vi.hoisted(() => ({
  enforceRateLimitMock: vi.fn().mockResolvedValue({ ok: true, remaining: 59, reset: 60 }),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: enforceRateLimitMock,
}))

// Minimal supabase mock — the route only needs `.from().select().eq().single()`.
const { singleMock } = vi.hoisted(() => ({
  singleMock: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn().mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: singleMock,
        }),
      }),
    }),
  }),
}))

import { GET } from '@/app/api/profile/check-premium/route'

function makeRequest(tag: string | null) {
  const url = tag === null
    ? 'http://localhost:3000/api/profile/check-premium'
    : `http://localhost:3000/api/profile/check-premium?tag=${encodeURIComponent(tag)}`
  return new Request(url, { method: 'GET' })
}

beforeEach(() => {
  vi.clearAllMocks()
  enforceRateLimitMock.mockResolvedValue({ ok: true, remaining: 59, reset: 60 })
  singleMock.mockResolvedValue({ data: null })
})

describe('GET /api/profile/check-premium', () => {
  it('returns hasPremium=false for missing tag (under-limit)', async () => {
    const res = await GET(makeRequest(null))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ hasPremium: false })
  })

  it('returns hasPremium=true when profile is paid + active', async () => {
    singleMock.mockResolvedValueOnce({
      data: { tier: 'premium', ls_subscription_status: 'active' },
    })
    const res = await GET(makeRequest('#ABC123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ hasPremium: true })
  })

  it('returns 429 with Retry-After when rate-limited (SEG-06)', async () => {
    enforceRateLimitMock.mockResolvedValueOnce({ ok: false, remaining: 0, reset: 12 })
    const res = await GET(makeRequest('#ABC123'))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('12')
    // Supabase must NOT have been queried when throttled.
    expect(singleMock).not.toHaveBeenCalled()
  })

  it('rate-limit fires BEFORE input validation', async () => {
    enforceRateLimitMock.mockResolvedValueOnce({ ok: false, remaining: 0, reset: 5 })
    // Even with no tag → rate-limit takes precedence → 429, not the
    // hasPremium=false short-circuit.
    const res = await GET(makeRequest(null))
    expect(res.status).toBe(429)
  })
})
