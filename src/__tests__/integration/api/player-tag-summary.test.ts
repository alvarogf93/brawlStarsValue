import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchPlayer: vi.fn(),
  SuprecellApiError: class extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
      this.name = 'SuprecellApiError'
    }
  },
}))

import { POST } from '@/app/api/player/tag-summary/route'
import { fetchPlayer, SuprecellApiError } from '@/lib/api'

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/player/tag-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/player/tag-summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when playerTag is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when playerTag is not a valid tag format', async () => {
    const res = await POST(makeRequest({ playerTag: 'lol-not-a-tag' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when Supercell reports the tag does not exist', async () => {
    vi.mocked(fetchPlayer).mockRejectedValueOnce(new SuprecellApiError(404, 'Not found'))
    const res = await POST(makeRequest({ playerTag: '#2P0Q8C2C0' }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Tag not found')
  })

  it('returns player summary (tag, name, trophies, highestTrophies, club) on success', async () => {
    vi.mocked(fetchPlayer).mockResolvedValueOnce({
      tag: '#2P0Q8C2C0',
      name: 'Xaxo',
      trophies: 32500,
      highestTrophies: 35000,
      club: { tag: '#JG9Y2RJ0', name: 'Team420' },
      // Fields the summary endpoint must IGNORE — we don't surface them:
      expLevel: 200,
      brawlers: [],
    } as unknown as Parameters<typeof vi.mocked<typeof fetchPlayer>>[0] extends never ? never : Awaited<ReturnType<typeof fetchPlayer>>)

    const res = await POST(makeRequest({ playerTag: '#2P0Q8C2C0' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      tag: '#2P0Q8C2C0',
      name: 'Xaxo',
      trophies: 32500,
      highestTrophies: 35000,
      club: { tag: '#JG9Y2RJ0', name: 'Team420' },
    })
  })

  it('returns null club for a player without a club', async () => {
    vi.mocked(fetchPlayer).mockResolvedValueOnce({
      tag: '#ABC',
      name: 'Solo',
      trophies: 1000,
      highestTrophies: 1200,
      club: null,
    } as unknown as Awaited<ReturnType<typeof fetchPlayer>>)

    const res = await POST(makeRequest({ playerTag: '#ABC' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.club).toBeNull()
  })

  it('calls fetchPlayer exactly once (not battlelog, not club — that is calculate.ts)', async () => {
    vi.mocked(fetchPlayer).mockResolvedValueOnce({
      tag: '#ABC', name: 'X', trophies: 0, highestTrophies: 0, club: null,
    } as unknown as Awaited<ReturnType<typeof fetchPlayer>>)
    await POST(makeRequest({ playerTag: '#ABC' }))
    expect(fetchPlayer).toHaveBeenCalledTimes(1)
  })

  it('propagates non-404 Supercell errors with their status code', async () => {
    vi.mocked(fetchPlayer).mockRejectedValueOnce(new SuprecellApiError(503, 'Service unavailable'))
    const res = await POST(makeRequest({ playerTag: '#2P0Q8C2C0' }))
    expect(res.status).toBe(503)
  })
})
