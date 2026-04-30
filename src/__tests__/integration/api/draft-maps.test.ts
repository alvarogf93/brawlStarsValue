import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fromMock, fetchEventRotationMock, fetchWithRetryMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  fetchEventRotationMock: vi.fn(),
  fetchWithRetryMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn().mockResolvedValue({ from: fromMock }),
}))

vi.mock('@/lib/api', () => ({
  fetchEventRotation: fetchEventRotationMock,
}))

vi.mock('@/lib/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/http')>('@/lib/http')
  return {
    ...actual,
    fetchWithRetry: (url: string) => fetchWithRetryMock(url),
    getCircuitBreaker: () => ({
      execute: <T>(op: () => Promise<T>) => op(),
    }),
  }
})

import { GET } from '@/app/api/draft/maps/route'

function makeRequest(mode?: string) {
  const url = mode
    ? `http://localhost:3000/api/draft/maps?mode=${mode}`
    : 'http://localhost:3000/api/draft/maps'
  return new Request(url, { method: 'GET' })
}

function makeBuilder(historicalRows: { map: string }[]) {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte']) builder[m] = () => builder
  builder.then = (resolve: (v: { data: unknown }) => unknown) =>
    resolve({ data: historicalRows })
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchEventRotationMock.mockResolvedValue([])
  fetchWithRetryMock.mockResolvedValue({
    ok: true,
    json: async () => ({ list: [] }),
  })
  fromMock.mockReturnValue(makeBuilder([]))
})

describe('GET /api/draft/maps', () => {
  it('returns 400 when mode param is missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
  })

  it('returns 400 when mode is not a draft mode', async () => {
    const res = await GET(makeRequest('showdown'))
    expect(res.status).toBe(400)
  })

  it('returns active + historical maps for a valid draft mode', async () => {
    fetchEventRotationMock.mockResolvedValue([
      { event: { mode: 'gemGrab', map: 'Hard Rock Mine', id: 1 } },
      { event: { mode: 'brawlBall', map: 'Sneaky Fields', id: 2 } }, // filtered out (different mode)
    ])
    fromMock.mockReturnValueOnce(makeBuilder([
      { map: 'Crystal Arcade' }, // historical only
      { map: 'Hard Rock Mine' }, // already active — should NOT duplicate
    ]))

    const res = await GET(makeRequest('gemGrab'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.maps).toHaveLength(2) // 1 active + 1 historical (dedup)
    const live = body.maps.filter((m: { isLive: boolean }) => m.isLive)
    const historical = body.maps.filter((m: { isLive: boolean }) => !m.isLive)
    expect(live).toHaveLength(1)
    expect(live[0].map).toBe('Hard Rock Mine')
    expect(historical).toHaveLength(1)
    expect(historical[0].map).toBe('Crystal Arcade')
  })

  it('falls back to Brawlify CDN URL when BrawlAPI map is not in the index', async () => {
    fetchEventRotationMock.mockResolvedValue([
      { event: { mode: 'gemGrab', map: 'Hard Rock Mine', id: 99 } },
    ])
    fetchWithRetryMock.mockResolvedValue({
      ok: true,
      json: async () => ({ list: [] }), // empty BrawlAPI index
    })

    const res = await GET(makeRequest('gemGrab'))
    const body = await res.json()
    expect(body.maps[0].imageUrl).toBe('https://cdn.brawlify.com/maps/regular/99.png')
  })

  it('survives BrawlAPI failure (returns no images, not error)', async () => {
    fetchEventRotationMock.mockResolvedValue([
      { event: { mode: 'gemGrab', map: 'Hard Rock Mine', id: 99 } },
    ])
    fetchWithRetryMock.mockRejectedValue(new Error('brawlapi down'))

    const res = await GET(makeRequest('gemGrab'))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Hard Rock Mine still in maps array, imageUrl falls back to Brawlify CDN
    expect(body.maps[0].map).toBe('Hard Rock Mine')
    expect(body.maps[0].imageUrl).toContain('brawlify.com')
  })

  it('survives event-rotation failure (returns historical only)', async () => {
    fetchEventRotationMock.mockRejectedValue(new Error('supercell down'))
    fromMock.mockReturnValueOnce(makeBuilder([
      { map: 'Crystal Arcade' },
    ]))

    const res = await GET(makeRequest('gemGrab'))
    const body = await res.json()
    expect(body.maps).toEqual([
      expect.objectContaining({ map: 'Crystal Arcade', isLive: false }),
    ])
  })
})
