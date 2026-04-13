import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Auth contract for /api/analytics.
 *
 * Locks in the cookie-auth + premium-gate contract across:
 *
 *  1. Anonymous (no session)                     → 401
 *  2. Authenticated but non-premium profile      → 403 Premium required
 *  3. Authenticated premium with battles         → 200 with analytics shape
 *  4. Authenticated premium with zero battles    → 200 with empty analytics
 *     (critical: the UI relies on this distinction to render the right
 *     empty state vs. a "not authorized" banner)
 */

type QueuedResponse = { data: unknown; error?: unknown }
const queueByTable: Record<string, QueuedResponse[]> = {}

function enqueue(table: string, response: QueuedResponse) {
  if (!queueByTable[table]) queueByTable[table] = []
  queueByTable[table].push(response)
}

function makeBuilder(response: QueuedResponse) {
  const methods = [
    'select', 'eq', 'gte', 'lte', 'lt', 'gt', 'in', 'order', 'limit', 'single', 'maybeSingle',
  ]
  const builder: Record<string, unknown> = {}
  for (const m of methods) builder[m] = () => builder
  builder.then = (resolve: (v: QueuedResponse) => unknown) => resolve(response)
  return builder
}

const fromMock = vi.fn((table: string) => {
  const queue = queueByTable[table]
  if (!queue || queue.length === 0) {
    throw new Error(`No queued response for table "${table}"`)
  }
  return makeBuilder(queue.shift()!)
})

type AuthGetUserResult = { data: { user: { id: string } | null } }
const authGetUserMock = vi.fn(
  async (): Promise<AuthGetUserResult> => ({ data: { user: null } }),
)

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: fromMock,
    auth: { getUser: authGetUserMock },
  }),
}))

import { GET } from '@/app/api/analytics/route'

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/analytics')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url, { method: 'GET' })
}

function futureDate(offsetMs: number) {
  return new Date(Date.now() + offsetMs).toISOString()
}

beforeEach(() => {
  for (const k of Object.keys(queueByTable)) delete queueByTable[k]
  fromMock.mockClear()
  authGetUserMock.mockClear()
  authGetUserMock.mockResolvedValue({ data: { user: null } })
})

describe('GET /api/analytics — auth contract', () => {
  it('returns 401 when no session cookie is present', async () => {
    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/Not authenticated/i)
  })

  it('returns 403 when authenticated but the profile is free tier', async () => {
    // Use a unique user id to bypass the per-user rate limiter
    authGetUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-free-1' } } })
    enqueue('profiles', {
      data: {
        id: 'user-free-1',
        player_tag: 'FREE123',
        tier: 'free',
        ls_subscription_status: null,
        trial_ends_at: null,
      },
    })

    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/Premium required/i)
  })

  it('returns 200 with analytics when authenticated with an active subscription', async () => {
    authGetUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-premium-1' } } })
    enqueue('profiles', {
      data: {
        id: 'user-premium-1',
        player_tag: 'PREM123',
        tier: 'premium',
        ls_subscription_status: 'active',
      },
    })
    enqueue('battles', {
      data: [
        {
          battle_time: '2026-04-13T10:00:00Z',
          mode: 'brawlBall',
          map: 'Sidetrack',
          result: 'victory',
          my_brawler: { id: 16000000, name: 'SHELLY' },
          teammates: [],
          opponents: [],
          trophy_change: 8,
          is_star_player: true,
        },
      ],
    })

    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const body = await res.json()
    // computeAdvancedAnalytics returns an object with an overview field —
    // assert shape, not deep contents (that's covered by compute.test.ts)
    expect(body).toHaveProperty('overview')
    expect(body).toHaveProperty('byBrawler')
  })

  it('returns 200 with analytics when authenticated on an active trial', async () => {
    authGetUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-trial-1' } } })
    enqueue('profiles', {
      data: {
        id: 'user-trial-1',
        player_tag: 'TRIAL12',
        tier: 'free',
        ls_subscription_status: null,
        trial_ends_at: futureDate(86_400_000), // 1 day from now
      },
    })
    enqueue('battles', { data: [] })

    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('overview')
  })

  it('returns 200 with empty analytics when premium user has zero battles', async () => {
    authGetUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-premium-empty' } } })
    enqueue('profiles', {
      data: {
        id: 'user-premium-empty',
        player_tag: 'EMPTY',
        tier: 'premium',
        ls_subscription_status: 'active',
      },
    })
    enqueue('battles', { data: [] })

    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const body = await res.json()
    // Empty battles → analytics still returns a full shape with zero totals
    expect(body.overview.totalBattles).toBe(0)
  })
})
