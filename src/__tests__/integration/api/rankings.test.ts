import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchPlayerRankings: vi.fn(),
  SuprecellApiError: class extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

import { fetchPlayerRankings, SuprecellApiError } from '@/lib/api'
import { GET } from '@/app/api/rankings/route'

type RankingsData = Awaited<ReturnType<typeof fetchPlayerRankings>>

const mockFetchRankings = vi.mocked(fetchPlayerRankings)

beforeEach(() => vi.clearAllMocks())

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/rankings')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url.toString())
}

describe('GET /api/rankings', () => {
  it('returns global rankings by default', async () => {
    mockFetchRankings.mockResolvedValueOnce({ items: [{ tag: '#P1', name: 'Player1', trophies: 50000 }] } as unknown as RankingsData)
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
  })

  it('passes country param to API', async () => {
    mockFetchRankings.mockResolvedValueOnce({ items: [] } as unknown as RankingsData)
    await GET(makeRequest({ country: 'ES' }))
    expect(mockFetchRankings).toHaveBeenCalledWith('ES', 200)
  })

  it('caps limit at 200', async () => {
    mockFetchRankings.mockResolvedValueOnce({ items: [] } as unknown as RankingsData)
    await GET(makeRequest({ limit: '500' }))
    expect(mockFetchRankings).toHaveBeenCalledWith('global', 200)
  })

  it('handles API error', async () => {
    mockFetchRankings.mockRejectedValueOnce(new SuprecellApiError(503, 'Maintenance'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(503)
  })

  it('returns 500 on unexpected error', async () => {
    mockFetchRankings.mockRejectedValueOnce(new Error('network'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
