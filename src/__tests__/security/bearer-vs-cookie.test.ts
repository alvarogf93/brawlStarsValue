/**
 * Bearer-vs-cookie auth contract tests.
 *
 * The repo's stated auth pattern (CLAUDE.md → "API route auth pattern"):
 *   - User-authenticated routes use COOKIE-based auth via createClient().
 *   - Cron routes accept ONLY `Authorization: Bearer ${CRON_SECRET}`.
 *   - The two contracts MUST NOT overlap: a Bearer token from a stolen
 *     auth source must not unlock a cookie-only route, and a user
 *     cookie must not satisfy a Bearer-protected cron route.
 *
 * These tests lock the contract per route. If a future refactor relaxes
 * either side, the test fires.
 *
 * OWASP WSTG: Authentication Testing → Authentication Bypass (4.4.4).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const cookieGetUserMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: cookieGetUserMock },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  })),
  createServiceClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  })),
  createServiceClientNoCookies: () => ({
    from: () => ({
      select: () => ({
        in: () => ({
          or: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }),
}))

vi.mock('@/lib/premium', () => ({ isPremium: () => false }))

beforeEach(() => {
  vi.clearAllMocks()
  cookieGetUserMock.mockResolvedValue({ data: { user: null }, error: null })
})

describe('Cookie route MUST reject Bearer-only requests', () => {
  it('/api/analytics: Bearer header without cookie session → 401', async () => {
    const { GET } = await import('@/app/api/analytics/route')
    const res = await GET(
      new Request('http://localhost/api/analytics', {
        method: 'GET',
        headers: { authorization: 'Bearer some-stolen-token' },
      }),
    )
    expect(res.status).toBe(401)
  })

  it('/api/profile/check-premium: Bearer accepted as anon (route is public)', async () => {
    // This route IS public. Bearer should be IGNORED, response shape stays the same.
    const { GET } = await import('@/app/api/profile/check-premium/route')
    const res = await GET(
      new Request('http://localhost/api/profile/check-premium?tag=%23ABC123', {
        method: 'GET',
        headers: { authorization: 'Bearer something' },
      }),
    )
    // 200 — Bearer was not consumed, route treats as anon.
    expect(res.status).toBe(200)
  })
})

describe('Cron route MUST reject cookie sessions', () => {
  it('/api/cron/sync: cookie session WITHOUT Bearer → 401', async () => {
    cookieGetUserMock.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    })
    const original = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'expected-cron-secret'

    const { GET } = await import('@/app/api/cron/sync/route')
    const res = await GET(
      new Request('http://localhost/api/cron/sync', {
        method: 'GET',
        headers: { cookie: 'sb-access-token=irrelevant' },
        // NO Authorization: Bearer header
      }),
    )
    expect(res.status).toBe(401)

    if (original) process.env.CRON_SECRET = original
    else delete process.env.CRON_SECRET
  })

  it('/api/cron/sync: WRONG Bearer → 401', async () => {
    process.env.CRON_SECRET = 'expected-cron-secret'
    const { GET } = await import('@/app/api/cron/sync/route')
    const res = await GET(
      new Request('http://localhost/api/cron/sync', {
        method: 'GET',
        headers: { authorization: 'Bearer wrong-secret' },
      }),
    )
    expect(res.status).toBe(401)
    delete process.env.CRON_SECRET
  })

  it('/api/cron/sync: missing CRON_SECRET env → still rejects (no auto-allow)', async () => {
    delete process.env.CRON_SECRET
    const { GET } = await import('@/app/api/cron/sync/route')
    const res = await GET(
      new Request('http://localhost/api/cron/sync', {
        method: 'GET',
        headers: { authorization: 'Bearer any-secret' },
      }),
    )
    // Either 401 (preferred — fail closed) or 500 (env misconfig). Never 200.
    expect([401, 500]).toContain(res.status)
  })
})
