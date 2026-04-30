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

import { fetchBrawlers, SuprecellApiError } from '@/lib/api'
import { GET } from '@/app/api/brawlers/route'

const mockFetchBrawlers = vi.mocked(fetchBrawlers)

beforeEach(() => {
  vi.clearAllMocks()
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
