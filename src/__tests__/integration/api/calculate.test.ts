import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/calculate/route'
import type { PlayerData } from '@/lib/types'

vi.mock('@/lib/api', () => ({
  fetchPlayer: vi.fn(),
  fetchBattlelog: vi.fn().mockResolvedValue({ items: [] }),
  SuprecellApiError: class extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
      this.name = 'SuprecellApiError'
    }
  },
}))

import { fetchPlayer } from '@/lib/api'
const mockFetchPlayer = vi.mocked(fetchPlayer)

// ───────────────── Mocks for anonymous visit tracking ─────────────────

// Hoisted helper for capturing the after() callback without invoking it.
// All four accessors come from a single vi.hoisted() block so they're
// guaranteed to exist when the vi.mock factory runs.
const { getCaptured, resetCaptured, mockAfter } = vi.hoisted(() => {
  let captured: (() => Promise<void>) | null = null
  return {
    getCaptured: () => captured,
    resetCaptured: () => { captured = null },
    mockAfter: (cb: () => Promise<void>) => { captured = cb },
  }
})

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: vi.fn(mockAfter) }
})

// Mock the tracker — we only verify it was called with the right args.
// Hoisted so the mock factory (which is itself hoisted) can reach it.
const { trackAnonymousVisitMock } = vi.hoisted(() => ({
  trackAnonymousVisitMock: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/anonymous-visits', () => ({
  trackAnonymousVisit: trackAnonymousVisitMock,
}))

// Mock createClient from @/lib/supabase/server to control auth.getUser() response.
// getUserMock is hoisted so it's defined when the vi.mock factory executes.
const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: getUserMock },
  }),
}))

const MOCK_PLAYER: PlayerData = {
  tag: '#YJU282PV' as never,
  name: 'TestPlayer',
  nameColor: '0xffffffff',
  trophies: 50000,
  highestTrophies: 52000,
  expLevel: 200,
  expPoints: 100000,
  totalPrestigeLevel: 5,
  soloVictories: 300,
  duoVictories: 200,
  '3vs3Victories': 10000,
  bestRoboRumbleTime: 0,
  bestTimeAsBigBrawler: 0,
  isQualifiedFromChampionshipChallenge: false,
  icon: { id: 28000000 },
  club: {},
  brawlers: [
    {
      id: 16000000, name: 'SHELLY', power: 11, rank: 25,
      trophies: 1200, highestTrophies: 1500, prestigeLevel: 1,
      currentWinStreak: 0, maxWinStreak: 4,
      starPowers: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
      gadgets: [{ id: 1, name: 'C' }, { id: 2, name: 'D' }],
      hyperCharges: [{ id: 1, name: 'E' }],
      gears: [],
      buffies: { gadget: true, starPower: true, hyperCharge: true },
      skin: { id: 29000844, name: 'SQUAD BUSTER\nSHELLY' },
    },
  ],
}

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/calculate', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 200 with real gem value', async () => {
    mockFetchPlayer.mockResolvedValue(MOCK_PLAYER)
    const res = await POST(makeRequest({ playerTag: '#YJU282PV' }))
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data.playerTag).toBe('#YJU282PV')
    expect(data.totalGems).toBeGreaterThan(0)
    expect(data.breakdown).toBeDefined()
    expect(data.breakdown.powerLevels).toBeDefined()
    expect(data.breakdown.gadgets).toBeDefined()
    expect(data.breakdown.starPowers).toBeDefined()
    expect(data.breakdown.hypercharges).toBeDefined()
    expect(data.breakdown.buffies).toBeDefined()
    expect(data.breakdown.gears).toBeDefined()
    expect(data.stats).toBeDefined()
    expect(data.stats.estimatedHoursPlayed).toBeGreaterThan(0)
  })

  it('breakdown sums to totalGems', async () => {
    mockFetchPlayer.mockResolvedValue(MOCK_PLAYER)
    const res = await POST(makeRequest({ playerTag: '#YJU282PV' }))
    const data = await res.json()

    const sum = data.breakdown.powerLevels.gems
      + data.breakdown.gadgets.gems
      + data.breakdown.starPowers.gems
      + data.breakdown.hypercharges.gems
      + data.breakdown.buffies.gems
      + data.breakdown.gears.gems

    expect(data.totalGems).toBe(sum)
  })

  it('returns 400 for invalid tag', async () => {
    const res = await POST(makeRequest({ playerTag: 'invalid' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when player not found', async () => {
    const { SuprecellApiError: MockError } = await import('@/lib/api')
    mockFetchPlayer.mockRejectedValue(new MockError(404, 'notFound'))
    const res = await POST(makeRequest({ playerTag: '#NOTEXIST' }))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/calculate — anonymous visit tracking', () => {
  beforeEach(() => {
    resetCaptured()
    vi.clearAllMocks()
    // Default: Supercell returns a valid player and user is anonymous
    mockFetchPlayer.mockResolvedValue(MOCK_PLAYER)
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
  })

  function makeTrackingRequest(overrides: Record<string, unknown> = {}) {
    return makeRequest({
      playerTag: '#YJU282PV',
      fromLanding: true,
      locale: 'es',
      ...overrides,
    })
  }

  it('fromLanding=true + anonymous user → registers after() callback, tracker NOT yet invoked', async () => {
    const res = await POST(makeTrackingRequest())

    expect(res.status).toBe(200)

    // Response went out BEFORE any tracking happened
    expect(trackAnonymousVisitMock).not.toHaveBeenCalled()

    // But the after() callback was registered
    const captured = getCaptured()
    expect(captured).not.toBeNull()

    // Now drain the callback — tracker runs
    await captured!()
    expect(trackAnonymousVisitMock).toHaveBeenCalledTimes(1)
    expect(trackAnonymousVisitMock).toHaveBeenCalledWith({
      tag: '#YJU282PV',
      locale: 'es',
    })
  })

  it('fromLanding=false → no after() callback, tracker never called', async () => {
    await POST(makeTrackingRequest({ fromLanding: false }))

    expect(getCaptured()).toBeNull()
    expect(trackAnonymousVisitMock).not.toHaveBeenCalled()
  })

  it('fromLanding=true + locale not in whitelist → no after()', async () => {
    await POST(makeTrackingRequest({ locale: 'xx' }))

    expect(getCaptured()).toBeNull()
    expect(trackAnonymousVisitMock).not.toHaveBeenCalled()
  })

  it('fromLanding=true + HTML-injection locale → no after()', async () => {
    await POST(makeTrackingRequest({ locale: '<b>evil</b>' }))

    expect(getCaptured()).toBeNull()
    expect(trackAnonymousVisitMock).not.toHaveBeenCalled()
  })

  it('fromLanding=true + authenticated user → no after()', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-uuid', email: 'a@b.c' } },
      error: null,
    })
    await POST(makeTrackingRequest())

    expect(getCaptured()).toBeNull()
    expect(trackAnonymousVisitMock).not.toHaveBeenCalled()
  })

  it('fromLanding=true + locale is a number → no after() (type guard)', async () => {
    await POST(makeTrackingRequest({ locale: 12345 }))

    expect(getCaptured()).toBeNull()
    expect(trackAnonymousVisitMock).not.toHaveBeenCalled()
  })

  it('auth.getUser() throws → fail-closed, no after(), no throw', async () => {
    getUserMock.mockRejectedValue(new Error('supabase auth down'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(makeTrackingRequest())

    expect(res.status).toBe(200)  // response still succeeds
    expect(getCaptured()).toBeNull()
    expect(trackAnonymousVisitMock).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      '[calculate] auth check for tracking failed',
      expect.any(Error),
    )
    consoleError.mockRestore()
  })
})
