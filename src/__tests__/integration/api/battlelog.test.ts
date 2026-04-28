import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchBattlelog: vi.fn(),
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

import { fetchBattlelog, SuprecellApiError } from '@/lib/api'
import { POST } from '@/app/api/battlelog/route'

type BattlelogData = Awaited<ReturnType<typeof fetchBattlelog>>

const mockFetchBattlelog = vi.mocked(fetchBattlelog)

beforeEach(() => {
  vi.clearAllMocks()
  enforceRateLimitMock.mockResolvedValue({ ok: true, remaining: 29, reset: 60 })
})

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/battlelog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/battlelog', () => {
  it('returns battlelog for valid tag', async () => {
    mockFetchBattlelog.mockResolvedValueOnce({ items: [{ battleTime: '20260405T170000.000Z' }] } as BattlelogData)
    const res = await POST(makeRequest({ playerTag: '#YJU282PV' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items).toHaveLength(1)
  })

  it('returns 400 for invalid tag format', async () => {
    const res = await POST(makeRequest({ playerTag: 'invalid' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing playerTag', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 404 when player not found', async () => {
    mockFetchBattlelog.mockRejectedValueOnce(new SuprecellApiError(404, 'Player not found'))
    const res = await POST(makeRequest({ playerTag: '#NONEXIST' }))
    expect(res.status).toBe(404)
  })

  it('returns 429 on rate limit', async () => {
    mockFetchBattlelog.mockRejectedValueOnce(new SuprecellApiError(429, 'Rate limited'))
    const res = await POST(makeRequest({ playerTag: '#YJU282PV' }))
    expect(res.status).toBe(429)
  })

  it('returns 500 on unexpected error', async () => {
    mockFetchBattlelog.mockRejectedValueOnce(new Error('network fail'))
    const res = await POST(makeRequest({ playerTag: '#YJU282PV' }))
    expect(res.status).toBe(500)
  })

  it('returns 429 with Retry-After when rate-limited (SEG-06)', async () => {
    enforceRateLimitMock.mockResolvedValueOnce({ ok: false, remaining: 0, reset: 42 })
    const res = await POST(makeRequest({ playerTag: '#YJU282PV' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
    // Underlying fetch must NOT have been called when throttled.
    expect(mockFetchBattlelog).not.toHaveBeenCalled()
  })

  it('rate-limit runs BEFORE input validation (SEG-06 contract)', async () => {
    enforceRateLimitMock.mockResolvedValueOnce({ ok: false, remaining: 0, reset: 30 })
    // Invalid payload — but rate-limit fires first → 429, not 400.
    const res = await POST(makeRequest({ playerTag: 'not a tag' }))
    expect(res.status).toBe(429)
  })
})
