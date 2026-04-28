import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Chainable mock builder ──────────────────────────────────────
// Each Supabase method returns an object with the next method in the chain.
// The terminal method resolves to { data, error }.

function chainable(resolvedValue: { data: unknown; error: unknown }) {
  const self: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['select', 'eq', 'gte']) {
    self[method] = vi.fn().mockReturnValue(self)
  }
  // Override the last method to also carry the resolved value
  // We need .then() so `await` works on the chain
  self.then = vi.fn((resolve: (v: unknown) => void) => resolve(resolvedValue))
  return self
}

// ── Mock Supabase ───────────────────────────────────────────────
const mockChains: Record<string, ReturnType<typeof chainable>> = {}
const mockFrom = vi.fn((table: string) => {
  // Return the pre-configured chain for this table call, or a default empty one
  const chain = mockChains[table] ?? chainable({ data: [], error: null })
  return chain
})

// MIX-03: pickRate denominator now resolved via the
// sum_meta_stats_total RPC (migration 023) instead of an
// unpaginated SELECT that PostgREST silently truncated at 1000 rows.
const mockRpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({ from: mockFrom, rpc: mockRpc })),
}))

// We do NOT mock scoring — we want the real bayesianWinRate to run
import { GET } from '@/app/api/meta/brawler-detail/route'

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/meta/brawler-detail')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new Request(url.toString())
}

describe('GET /api/meta/brawler-detail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset chains
    for (const key of Object.keys(mockChains)) delete mockChains[key]
    // Default: rpc returns 0 (no battles) — happy/edge tests override
    mockRpc.mockResolvedValue({ data: 0, error: null })
  })

  // ── Validation ──────────────────────────────────────────────

  it('returns 400 when brawlerId is missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/brawlerId/)
  })

  it('returns 400 when brawlerId is non-numeric', async () => {
    const res = await GET(makeRequest({ brawlerId: 'abc' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/numeric/)
  })

  it('returns 400 when brawlerId contains decimals', async () => {
    const res = await GET(makeRequest({ brawlerId: '3.14' }))
    expect(res.status).toBe(400)
  })

  // ── Successful response ─────────────────────────────────────

  it('returns 200 with correct shape for valid brawlerId', async () => {
    const statsData = [
      { brawler_id: 16, map: 'Gem Fort', mode: 'gemGrab', wins: 60, losses: 40, total: 100 },
      { brawler_id: 16, map: 'Hard Rock Mine', mode: 'gemGrab', wins: 30, losses: 20, total: 50 },
    ]

    const matchupsData = [
      { brawler_id: 16, opponent_id: 1, wins: 40, losses: 10, total: 50 },
      { brawler_id: 16, opponent_id: 2, wins: 10, losses: 40, total: 50 },
    ]

    const statsChain = chainable({ data: statsData, error: null })
    const matchupsChain = chainable({ data: matchupsData, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'meta_stats') return statsChain
      if (table === 'meta_matchups') return matchupsChain
      return chainable({ data: [], error: null })
    })

    // RPC returns the scalar denominator directly (BIGINT serialized
    // as a number). With pre-MIX-03 code this came from an
    // unpaginated SELECT that truncated at 1000 rows.
    mockRpc.mockResolvedValue({ data: 3000, error: null })

    const res = await GET(makeRequest({ brawlerId: '16' }))
    expect(res.status).toBe(200)

    const body = await res.json()

    expect(body.brawlerId).toBe(16)
    expect(body.globalStats).toBeDefined()
    expect(body.globalStats).toHaveProperty('winRate')
    expect(body.globalStats).toHaveProperty('pickRate')
    expect(body.globalStats).toHaveProperty('totalBattles')
    expect(body.globalStats).toHaveProperty('trend7d')
    expect(body.globalStats.totalBattles).toBe(150) // 100 + 50
    expect(Array.isArray(body.bestMaps)).toBe(true)
    expect(Array.isArray(body.worstMaps)).toBe(true)
    expect(Array.isArray(body.strongAgainst)).toBe(true)
    expect(Array.isArray(body.weakAgainst)).toBe(true)
    expect(Array.isArray(body.bestTeammates)).toBe(true)

    // Verify pickRate is calculated: (150 / 3000) * 100 = 5.0
    expect(body.globalStats.pickRate).toBe(5)

    // MIX-03: verify the RPC was called with the cutoff date param
    expect(mockRpc).toHaveBeenCalledWith(
      'sum_meta_stats_total',
      expect.objectContaining({ p_since: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }),
    )
  })

  it('uses sum_meta_stats_total RPC instead of unpaginated SELECT — MIX-03', async () => {
    // Regression: the pre-fix endpoint did
    //   .from('meta_stats').select('total').gte('date', cutoff)
    // which truncated at PostgREST's 1000-row cap. The route must
    // now never call .from('meta_stats') for the totalBattles
    // denominator; it must use rpc('sum_meta_stats_total').
    mockFrom.mockImplementation((table: string) => chainable({ data: [], error: null }))
    mockRpc.mockResolvedValue({ data: 99999, error: null })

    await GET(makeRequest({ brawlerId: '16' }))

    // meta_stats may still be called once for the brawler-specific
    // stats query, but never twice (the second call was the
    // truncated denominator query).
    const metaStatsCalls = mockFrom.mock.calls.filter(([t]) => t === 'meta_stats').length
    expect(metaStatsCalls).toBe(1)
    expect(mockRpc).toHaveBeenCalledWith('sum_meta_stats_total', expect.any(Object))
  })

  // ── DB error paths ──────────────────────────────────────────

  it('returns 500 when meta_stats query fails', async () => {
    const errorChain = chainable({ data: null, error: { message: 'DB down' } })

    mockFrom.mockImplementation(() => errorChain)

    const res = await GET(makeRequest({ brawlerId: '16' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/meta stats/i)
  })

  it('returns 500 when meta_matchups query fails', async () => {
    const statsChain = chainable({ data: [], error: null })
    const matchupsChain = chainable({ data: null, error: { message: 'timeout' } })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'meta_stats') {
        return statsChain
      }
      if (table === 'meta_matchups') {
        return matchupsChain
      }
      return chainable({ data: [], error: null })
    })

    const res = await GET(makeRequest({ brawlerId: '16' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/matchups/i)
  })

  it('returns 500 when total battles RPC fails', async () => {
    const statsChain = chainable({ data: [], error: null })
    const matchupsChain = chainable({ data: [], error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'meta_stats') return statsChain
      if (table === 'meta_matchups') return matchupsChain
      return chainable({ data: [], error: null })
    })
    mockRpc.mockResolvedValue({ data: null, error: { message: 'connection lost' } })

    const res = await GET(makeRequest({ brawlerId: '16' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/total battles/i)
  })

  // ── Edge cases ──────────────────────────────────────────────

  it('returns empty arrays when brawler has no stats', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'meta_stats') {
        return chainable({ data: [], error: null })
      }
      if (table === 'meta_matchups') {
        return chainable({ data: [], error: null })
      }
      return chainable({ data: [], error: null })
    })

    const res = await GET(makeRequest({ brawlerId: '99' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.brawlerId).toBe(99)
    expect(body.bestMaps).toEqual([])
    expect(body.worstMaps).toEqual([])
    expect(body.strongAgainst).toEqual([])
    expect(body.weakAgainst).toEqual([])
    expect(body.globalStats.totalBattles).toBe(0)
  })
})
