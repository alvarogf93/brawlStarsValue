import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}))

vi.mock('@/lib/api', () => ({
  fetchBattlelog: vi.fn().mockResolvedValue({ items: [] }),
}))

vi.mock('@/lib/battle-parser', () => ({
  parseBattlelog: vi.fn().mockReturnValue([]),
}))

import { GET } from '@/app/api/cron/sync/route'

beforeEach(() => {
  vi.clearAllMocks()
  // TEST-10 — vi.stubEnv auto-restores via the global afterEach
  // (vi.unstubAllEnvs in src/test/setup.ts). Direct process.env.X = ...
  // assignments would leak into the next test file whose own setup
  // assumed the var was undefined.
  vi.stubEnv('CRON_SECRET', 'test-secret')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')
})

function makeRequest(secret?: string) {
  const headers: Record<string, string> = {}
  if (secret) headers.authorization = `Bearer ${secret}`
  return new Request('http://localhost:3000/api/cron/sync', { headers })
}

describe('GET /api/cron/sync', () => {
  it('returns 401 with wrong secret', async () => {
    const res = await GET(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns 401 without auth header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns processed:0 when no users need sync', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    })
    const res = await GET(makeRequest('test-secret'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.processed).toBe(0)
  })

  it('returns processed:0 on query error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    })
    const res = await GET(makeRequest('test-secret'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.processed).toBe(0)
    expect(data.reason).toContain('DB error')
  })
})
