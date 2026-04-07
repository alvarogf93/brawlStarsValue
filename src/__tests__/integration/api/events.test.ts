import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchEventRotation: vi.fn(),
  SuprecellApiError: class extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

import { fetchEventRotation, SuprecellApiError } from '@/lib/api'
import { GET } from '@/app/api/events/route'

const mockFetchEvents = vi.mocked(fetchEventRotation)

beforeEach(() => vi.clearAllMocks())

describe('GET /api/events', () => {
  it('returns event rotation', async () => {
    mockFetchEvents.mockResolvedValueOnce([
      { startTime: '20260405T100000.000Z', endTime: '20260406T100000.000Z', event: { id: 1, mode: 'brawlBall', map: 'Super Beach' } },
    ] as any)
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(1)
  })

  it('returns empty array when no events', async () => {
    mockFetchEvents.mockResolvedValueOnce([] as any)
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })

  it('handles API maintenance error', async () => {
    mockFetchEvents.mockRejectedValueOnce(new SuprecellApiError(503, 'Maintenance'))
    const res = await GET()
    expect(res.status).toBe(503)
  })

  it('returns 500 on unexpected error', async () => {
    mockFetchEvents.mockRejectedValueOnce(new Error('network'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
