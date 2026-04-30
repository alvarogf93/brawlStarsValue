import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchBrawlers: vi.fn(),
  SuprecellApiError: class extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

// Mock the Brawlify fetch (via lib/http) so we can test:
//   - rarity merge happy-path
//   - graceful degradation when Brawlify is unreachable
const { brawlifyFetchMock } = vi.hoisted(() => ({
  brawlifyFetchMock: vi.fn(),
}))
vi.mock('@/lib/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/http')>('@/lib/http')
  return {
    ...actual,
    fetchWithRetry: (url: string) => brawlifyFetchMock(url),
    getCircuitBreaker: () => ({
      execute: <T>(op: () => Promise<T>) => op(),
    }),
  }
})

import { fetchBrawlers, SuprecellApiError } from '@/lib/api'
import { GET } from '@/app/api/brawlers/route'

const mockFetchBrawlers = vi.mocked(fetchBrawlers)

beforeEach(() => {
  vi.clearAllMocks()
  // Default: Brawlify reachable but empty (no rarity merged). Tests that
  // care about rarity override this in the test body.
  brawlifyFetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ list: [] }),
  })
})

describe('GET /api/brawlers', () => {
  it('aggregates brawlerCount + maxGadgets + maxStarPowers + roster correctly', async () => {
    mockFetchBrawlers.mockResolvedValue({
      items: [
        // Out of order to verify the roster comes back sorted by id.
        { id: 3, name: 'C', gadgets: [], starPowers: [{}] },
        { id: 1, name: 'A', gadgets: [{}, {}], starPowers: [{}], hyperCharges: [{}] },
        { id: 2, name: 'B', gadgets: [{}], starPowers: [{}, {}] },
      ],
    } as unknown as Awaited<ReturnType<typeof fetchBrawlers>>)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    // FAIL-NEW-BRAWLERS — roster MUST ship so clients can render the
    // full game, not just owned brawlers. Sort by id ASC for stable
    // rendering (regardless of Supercell's response order).
    expect(body.brawlerCount).toBe(3)
    expect(body.maxGadgets).toBe(3)
    expect(body.maxStarPowers).toBe(4)
    expect(body.roster).toEqual([
      { id: 1, name: 'A', gadgets: 2, starPowers: 1, hyperCharges: 1 },
      { id: 2, name: 'B', gadgets: 1, starPowers: 2, hyperCharges: 0 },
      { id: 3, name: 'C', gadgets: 0, starPowers: 1, hyperCharges: 0 },
    ])
  })

  it('handles missing optional fields without crashing', async () => {
    mockFetchBrawlers.mockResolvedValue({
      items: [
        { id: 1, name: 'NoArrays' },
        { id: 2, name: 'OnlyGadgets', gadgets: [{}] },
      ],
    } as unknown as Awaited<ReturnType<typeof fetchBrawlers>>)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.brawlerCount).toBe(2)
    expect(body.maxGadgets).toBe(1)
    expect(body.maxStarPowers).toBe(0)
  })

  it('emits long Cache-Control headers (roster changes monthly)', async () => {
    mockFetchBrawlers.mockResolvedValue({ items: [] } as unknown as Awaited<ReturnType<typeof fetchBrawlers>>)
    const res = await GET()
    const cacheControl = res.headers.get('Cache-Control') ?? ''
    expect(cacheControl).toMatch(/s-maxage=86400/)
    expect(cacheControl).toMatch(/stale-while-revalidate/)
  })

  it('propagates Supercell error status (no auth required, public)', async () => {
    mockFetchBrawlers.mockRejectedValue(new SuprecellApiError(503, 'maintenance'))
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('maintenance')
  })

  it('returns generic 500 on unexpected (non-Supercell) errors', async () => {
    mockFetchBrawlers.mockRejectedValue(new Error('network fail'))
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    // SEG-08 — generic message, no internal leak.
    expect(body.error).toBe('Internal server error')
  })

  it('merges rarity from Brawlify into roster entries when available', async () => {
    mockFetchBrawlers.mockResolvedValue({
      items: [
        { id: 16000000, name: 'SHELLY', gadgets: [{}], starPowers: [{}] },
        { id: 16000104, name: 'DAMIAN', gadgets: [{}, {}], starPowers: [{}, {}] },
      ],
    } as unknown as Awaited<ReturnType<typeof fetchBrawlers>>)
    // Brawlify has SHELLY (Common) but NOT DAMIAN (too new).
    brawlifyFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        list: [
          { id: 16000000, rarity: { name: 'Common', color: '#b9eaff' } },
        ],
      }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    const shelly = body.roster.find((r: { id: number }) => r.id === 16000000)
    const damian = body.roster.find((r: { id: number }) => r.id === 16000104)
    expect(shelly.rarity).toBe('Common')
    expect(shelly.rarityColor).toBe('#b9eaff')
    // DAMIAN absent from Brawlify → no rarity field. Client falls
    // back to BRAWLER_RARITY_MAP / null. Better than wrong rarity.
    expect(damian.rarity).toBeUndefined()
  })

  it('survives Brawlify failure without losing the Supercell roster', async () => {
    mockFetchBrawlers.mockResolvedValue({
      items: [{ id: 16000000, name: 'SHELLY', gadgets: [{}], starPowers: [{}] }],
    } as unknown as Awaited<ReturnType<typeof fetchBrawlers>>)
    // Brawlify completely down — circuit-open or network throw.
    brawlifyFetchMock.mockRejectedValue(new Error('brawlapi unreachable'))

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.roster).toEqual([
      { id: 16000000, name: 'SHELLY', gadgets: 1, starPowers: 1, hyperCharges: 0 },
    ])
  })

  it('treats missing items array as empty (defensive)', async () => {
    mockFetchBrawlers.mockResolvedValue({} as unknown as Awaited<ReturnType<typeof fetchBrawlers>>)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      brawlerCount: 0,
      maxGadgets: 0,
      maxStarPowers: 0,
      roster: [],
    })
  })
})

// Note on naming: this file is `brawlers.test.ts`, NOT `brawlers-auth-contract.test.ts`,
// because the route is unauthenticated by design (public, no cookie required).
// The route's "auth contract" is "no auth required" — the cached roster is
// public data. TEST-02 is closed for this route even though there's no
// cookie/Bearer split to verify.
