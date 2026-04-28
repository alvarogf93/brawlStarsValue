import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchClub: vi.fn(),
  SuprecellApiError: class extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

const { enforceRateLimitMock } = vi.hoisted(() => ({
  enforceRateLimitMock: vi.fn().mockResolvedValue({ ok: true, remaining: 29, reset: 60 }),
}))
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: enforceRateLimitMock,
}))

import { fetchClub, SuprecellApiError } from '@/lib/api'
import { POST } from '@/app/api/club/route'

type ClubData = Awaited<ReturnType<typeof fetchClub>>

const mockFetchClub = vi.mocked(fetchClub)

beforeEach(() => {
  vi.clearAllMocks()
  enforceRateLimitMock.mockResolvedValue({ ok: true, remaining: 29, reset: 60 })
})

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/club', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/club', () => {
  it('returns club data for valid tag', async () => {
    mockFetchClub.mockResolvedValueOnce({ tag: '#CLUB1', name: 'TestClub', members: [] } as unknown as ClubData)
    const res = await POST(makeRequest({ clubTag: '#CLUB1' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('TestClub')
  })

  it('returns 400 for missing clubTag', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent club', async () => {
    mockFetchClub.mockRejectedValueOnce(new SuprecellApiError(404, 'Club not found'))
    const res = await POST(makeRequest({ clubTag: '#NOCLUB' }))
    expect(res.status).toBe(404)
  })

  it('returns 500 on unexpected error', async () => {
    mockFetchClub.mockRejectedValueOnce(new Error('network fail'))
    const res = await POST(makeRequest({ clubTag: '#CLUB1' }))
    expect(res.status).toBe(500)
  })

  it('returns 429 with Retry-After when rate-limited (SEG-06)', async () => {
    enforceRateLimitMock.mockResolvedValueOnce({ ok: false, remaining: 0, reset: 17 })
    const res = await POST(makeRequest({ clubTag: '#CLUB1' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('17')
    expect(mockFetchClub).not.toHaveBeenCalled()
  })
})
