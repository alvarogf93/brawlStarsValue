import { describe, it, expect, vi, beforeEach } from 'vitest'

const cookieGetUserMock = vi.fn()
const serviceFromMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: cookieGetUserMock },
  })),
  createServiceClient: vi.fn(async () => ({
    from: serviceFromMock,
  })),
}))

vi.mock('@/lib/premium', () => ({
  isPremium: (p: { tier: string }) => p?.tier !== 'free',
}))

import { GET } from '@/app/api/draft/data/route'

function makeRequest(map: string, mode: string) {
  return new Request(
    `http://localhost:3000/api/draft/data?map=${encodeURIComponent(map)}&mode=${mode}`,
    { method: 'GET' },
  )
}

function makeStatsBuilder(rows: unknown[]) {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte', 'in']) builder[m] = () => builder
  builder.then = (resolve: (v: { data: unknown }) => unknown) =>
    resolve({ data: rows })
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  cookieGetUserMock.mockResolvedValue({ data: { user: null }, error: null })
  // Default: every Supabase select returns []
  serviceFromMock.mockReturnValue(makeStatsBuilder([]))
})

describe('GET /api/draft/data — auth contract (TEST-02 + PERF-07)', () => {
  it('returns 400 when map or mode are missing', async () => {
    const res = await GET(new Request('http://localhost:3000/api/draft/data?map=X', { method: 'GET' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-draft mode', async () => {
    const res = await GET(makeRequest('Hard Rock Mine', 'showdown'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when map is suspiciously long (path-traversal probe)', async () => {
    const res = await GET(makeRequest('A'.repeat(101), 'gemGrab'))
    expect(res.status).toBe(400)
  })

  it('anonymous: 200 with public data + Cache-Control public, no personal field', async () => {
    cookieGetUserMock.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(makeRequest('Hard Rock Mine', 'gemGrab'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('public')
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=900')
    const body = await res.json()
    expect(body.meta).toBeDefined()
    expect(body.matchups).toBeDefined()
    expect(body.usersData).toBeDefined()
    expect(body.personal).toBeUndefined()
  })

  it('authenticated free user: 200 with public + usersData but Cache-Control private', async () => {
    cookieGetUserMock.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    })
    // Profile is free → no personal data
    serviceFromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const builder: Record<string, unknown> = {}
        for (const m of ['select', 'eq']) builder[m] = () => builder
        builder.single = () => Promise.resolve({
          data: { id: 'u1', tier: 'free', player_tag: '#TEST' },
          error: null,
        })
        return builder
      }
      return makeStatsBuilder([])
    })

    const res = await GET(makeRequest('Hard Rock Mine', 'gemGrab'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('authenticated premium with battles: returns personal + private cache', async () => {
    cookieGetUserMock.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    })
    serviceFromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const builder: Record<string, unknown> = {}
        for (const m of ['select', 'eq']) builder[m] = () => builder
        builder.single = () => Promise.resolve({
          data: { id: 'u1', tier: 'premium', player_tag: '#TEST' },
          error: null,
        })
        return builder
      }
      if (table === 'battles') {
        return makeStatsBuilder([
          { my_brawler: { id: 16000001 }, result: 'victory' },
          { my_brawler: { id: 16000001 }, result: 'defeat' },
          { my_brawler: { id: 16000002 }, result: 'victory' },
        ])
      }
      return makeStatsBuilder([])
    })

    const res = await GET(makeRequest('Hard Rock Mine', 'gemGrab'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const body = await res.json()
    expect(body.personal).toBeDefined()
    expect(body.personal).toHaveLength(2)
    const b1 = body.personal.find((p: { brawlerId: number }) => p.brawlerId === 16000001)
    expect(b1).toEqual({ brawlerId: 16000001, wins: 1, losses: 1, total: 2 })
  })

  it('handles auth check failure gracefully (still returns public data)', async () => {
    cookieGetUserMock.mockRejectedValue(new Error('auth lib threw'))
    const res = await GET(makeRequest('Hard Rock Mine', 'gemGrab'))
    expect(res.status).toBe(200)
    // Falls through to public anonymous path → public Cache-Control.
    expect(res.headers.get('Cache-Control')).toContain('public')
  })
})
