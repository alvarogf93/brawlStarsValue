import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fetchEventRotationMock, buildEventsMock } = vi.hoisted(() => ({
  fetchEventRotationMock: vi.fn(),
  buildEventsMock: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  fetchEventRotation: fetchEventRotationMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/meta/cascade', async () => {
  const actual = await vi.importActual<typeof import('@/lib/meta/cascade')>('@/lib/meta/cascade')
  return {
    ...actual,
    buildEventsWithCascade: buildEventsMock,
  }
})

import { GET } from '@/app/api/meta/route'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/meta', () => {
  it('returns empty events array when rotation has no draft modes', async () => {
    fetchEventRotationMock.mockResolvedValue([
      { event: { mode: 'showdown', map: 'X', id: 1 }, startTime: '', endTime: '' },
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.events).toEqual([])
    expect(buildEventsMock).not.toHaveBeenCalled()
  })

  it('delegates to buildEventsWithCascade and emits public Cache-Control', async () => {
    fetchEventRotationMock.mockResolvedValue([
      { event: { mode: 'gemGrab', map: 'Hard Rock Mine', id: 1 }, startTime: 'a', endTime: 'b' },
      { event: { mode: 'brawlBall', map: 'Sneaky Fields', id: 2 }, startTime: 'c', endTime: 'd' },
    ])
    buildEventsMock.mockResolvedValue([
      { mode: 'gemGrab', map: 'Hard Rock Mine', eventId: 1, startTime: 'a', endTime: 'b', totalBattles: 100, topBrawlers: [], source: 'map-mode' },
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('public')
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=1800')
    const body = await res.json()
    expect(body.events).toHaveLength(1)
    expect(buildEventsMock).toHaveBeenCalledTimes(1)
    // Only draft events are passed to the helper (showdown filtered out).
    const passedEvents = buildEventsMock.mock.calls[0][1] as Array<{ event: { mode: string } }>
    expect(passedEvents.every(e => ['gemGrab', 'brawlBall'].includes(e.event.mode))).toBe(true)
  })

  it('returns 500 when fetchEventRotation throws (Supercell down)', async () => {
    fetchEventRotationMock.mockRejectedValue(new Error('supercell down'))
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    // SEG-08 — generic message, no leak.
    expect(body.error).toBe('Failed to load meta data')
    expect(body.events).toEqual([])
  })

  it('returns 500 when the cascade helper throws', async () => {
    fetchEventRotationMock.mockResolvedValue([
      { event: { mode: 'gemGrab', map: 'X', id: 1 }, startTime: '', endTime: '' },
    ])
    buildEventsMock.mockRejectedValue(new Error('db down'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
