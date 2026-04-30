import { describe, it, expect, vi, beforeEach } from 'vitest'

// /api/maps fetches BrawlAPI through the http.ts wrapper. Mock fetch globally —
// the route doesn't go through anything else.
const fetchMock = vi.fn()

vi.mock('@/lib/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/http')>('@/lib/http')
  return {
    ...actual,
    fetchWithRetry: (url: string) => fetchMock(url),
    getCircuitBreaker: () => ({
      execute: <T>(op: () => Promise<T>) => op(),
    }),
  }
})

import { GET } from '@/app/api/maps/route'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/maps', () => {
  it('returns mapName → imageUrl mapping for entries with imageUrl', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        list: [
          { id: 1, name: 'Hard-Rock-Mine', imageUrl: 'https://cdn/maps/hrm.png' },
          { id: 2, name: 'Belles-Rock', imageUrl: 'https://cdn/maps/br.png' },
          { id: 3, name: 'NoImage' }, // skipped
        ],
      }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    // Hyphen → space normalization
    expect(body['Hard Rock Mine']).toBe('https://cdn/maps/hrm.png')
    expect(body['Hard-Rock-Mine']).toBe('https://cdn/maps/hrm.png')
    // Apostrophe heuristic for "Belle's Rock"
    expect(body["Belle's Rock"]).toBe('https://cdn/maps/br.png')
    expect(body.NoImage).toBeUndefined()
  })

  it('returns empty object on non-2xx (BrawlAPI down)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({})
  })

  it('returns empty object when fetch itself rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network'))
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({})
  })

  it('handles { data: list } and bare-array shapes', async () => {
    // BrawlAPI has historically returned both {list:[...]} and [...]
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 1, name: 'Plain', imageUrl: 'https://cdn/maps/p.png' },
      ],
    })
    const res = await GET()
    const body = await res.json()
    expect(body.Plain).toBe('https://cdn/maps/p.png')
  })
})

// Auth contract: this route is anonymous-public — the cached map index is
// not user-specific. No Bearer/cookie split to verify.
