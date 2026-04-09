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

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({ from: mockFrom })),
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
    // We need three sequential .from() calls:
    // 1. meta_stats (brawler-specific)
    // 2. meta_matchups
    // 3. meta_stats (total battles)
    // Because the route calls .from('meta_stats') twice and .from('meta_matchups') once,
    // we track call order via mockFrom.

    const statsData = [
      { brawler_id: 16, map: 'Gem Fort', mode: 'gemGrab', wins: 60, losses: 40, total: 100 },
      { brawler_id: 16, map: 'Hard Rock Mine', mode: 'gemGrab', wins: 30, losses: 20, total: 50 },
    ]

    const matchupsData = [
      { brawler_id: 16, opponent_id: 1, wins: 40, losses: 10, total: 50 },
      { brawler_id: 16, opponent_id: 2, wins: 10, losses: 40, total: 50 },
    ]

    const totalBattlesData = [
      { total: 1000 },
      { total: 2000 },
    ]

    // Build three separate chains for three calls
    const statsChain = chainable({ data: statsData, error: null })
    const matchupsChain = chainable({ data: matchupsData, error: null })
    const totalChain = chainable({ data: totalBattlesData, error: null })

    let metaStatsCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'meta_stats') {
        metaStatsCallCount++
        return metaStatsCallCount === 1 ? statsChain : totalChain
      }
      if (table === 'meta_matchups') {
        return matchupsChain
      }
      return chainable({ data: [], error: null })
    })

    const res = await GET(makeRequest({ brawlerId: '16' }))
    expect(res.status).toBe(200)

    const body = await res.json()

    // Verify response shape matches BrawlerMetaResponse
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

    let metaStatsCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'meta_stats') {
        metaStatsCallCount++
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

  it('returns 500 when total battles query fails', async () => {
    const statsChain = chainable({ data: [], error: null })
    const matchupsChain = chainable({ data: [], error: null })
    const totalChain = chainable({ data: null, error: { message: 'connection lost' } })

    let metaStatsCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'meta_stats') {
        metaStatsCallCount++
        return metaStatsCallCount === 1 ? statsChain : totalChain
      }
      if (table === 'meta_matchups') {
        return matchupsChain
      }
      return chainable({ data: [], error: null })
    })

    const res = await GET(makeRequest({ brawlerId: '16' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/total battles/i)
  })

  // ── Edge cases ──────────────────────────────────────────────

  it('returns empty arrays when brawler has no stats', async () => {
    let metaStatsCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'meta_stats') {
        metaStatsCallCount++
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
