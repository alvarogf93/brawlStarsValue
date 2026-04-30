import { describe, it, expect, vi, beforeEach } from 'vitest'

const { enforceRateLimitMock } = vi.hoisted(() => ({
  enforceRateLimitMock: vi.fn().mockResolvedValue({
    ok: true, limit: 60, remaining: 59, reset: 60,
  }),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: enforceRateLimitMock,
  rateLimitHeaders: (rl: { limit: number; remaining: number; reset: number }, rejected: boolean) => {
    const h: Record<string, string> = {
      'RateLimit-Limit': String(rl.limit),
      'RateLimit-Remaining': String(rl.remaining),
      'RateLimit-Reset': String(rl.reset),
    }
    if (rejected) h['Retry-After'] = String(rl.reset)
    return h
  },
  extractClientIp: () => '203.0.113.42',
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
  enforceRateLimitMock.mockResolvedValue({ ok: true, limit: 60, remaining: 59, reset: 60 })
  singleMock.mockResolvedValue({ data: null })
})

describe('GET /api/profile/check-premium', () => {
  it('returns hasPremium=false for missing tag without consulting rate-limit', async () => {
    const res = await GET(makeRequest(null))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ hasPremium: false })
    // SEG-10: invalid input must NOT pollute the rate-limit identifier
    // space. The route validates the tag first, so junk requests don't
    // create infinite Redis keys.
    expect(enforceRateLimitMock).not.toHaveBeenCalled()
  })

  it('returns hasPremium=false for malformed tag without consulting rate-limit', async () => {
    const res = await GET(makeRequest('not-a-tag'))
    expect(res.status).toBe(200)
    expect(enforceRateLimitMock).not.toHaveBeenCalled()
  })

  it('returns hasPremium=true when profile is paid + active', async () => {
    singleMock.mockResolvedValueOnce({
      data: { tier: 'premium', ls_subscription_status: 'active' },
    })
    const res = await GET(makeRequest('#ABC123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ hasPremium: true })
    // RateLimit headers MUST be attached to successful responses too,
    // so clients can self-throttle proactively.
    expect(res.headers.get('RateLimit-Limit')).toBe('60')
    expect(res.headers.get('Retry-After')).toBeNull()
  })

  it('uses ip:tag bucketing (SEG-10 — distributed enumeration defense)', async () => {
    singleMock.mockResolvedValueOnce({ data: null })
    await GET(makeRequest('#ABC123'))
    // The route MUST pass an identifierOverride combining IP + tag so a
    // single tag probed from many IPs still aggregates against one bucket.
    expect(enforceRateLimitMock).toHaveBeenCalledTimes(1)
    const [, , override] = enforceRateLimitMock.mock.calls[0]
    expect(override).toBe('203.0.113.42:#ABC123')
  })

  it('returns 429 with Retry-After when rate-limited (SEG-06)', async () => {
    enforceRateLimitMock.mockResolvedValueOnce({
      ok: false, limit: 60, remaining: 0, reset: 12,
    })
    const res = await GET(makeRequest('#ABC123'))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('12')
    expect(res.headers.get('RateLimit-Remaining')).toBe('0')
    // Supabase must NOT have been queried when throttled.
    expect(singleMock).not.toHaveBeenCalled()
  })
})
