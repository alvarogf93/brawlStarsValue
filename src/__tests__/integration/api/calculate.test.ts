import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/calculate/route'
import type { PlayerData } from '@/lib/types'

// Mock the fetch to Supercell API so tests don't hit the real API
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

import { fetchPlayer, SuprecellApiError } from '@/lib/api'
const mockFetchPlayer = vi.mocked(fetchPlayer)

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
      skin: { id: 0, name: '' },
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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with GemScore for valid tag', async () => {
    mockFetchPlayer.mockResolvedValue(MOCK_PLAYER)
    const res = await POST(makeRequest({ playerTag: '#YJU282PV' }))

    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data.playerTag).toBe('#YJU282PV')
    expect(data.playerName).toBe('TestPlayer')
    expect(data.gemEquivalent).toBeGreaterThan(0)
    expect(data.totalScore).toBeGreaterThan(0)
    expect(data.breakdown).toBeDefined()
    expect(data.breakdown.base).toBeDefined()
    expect(data.breakdown.assets).toBeDefined()
    expect(data.breakdown.enhance).toBeDefined()
    expect(data.breakdown.elite).toBeDefined()
  })

  it('breakdown sums to totalScore', async () => {
    mockFetchPlayer.mockResolvedValue(MOCK_PLAYER)
    const res = await POST(makeRequest({ playerTag: '#YJU282PV' }))
    const data = await res.json()

    const sum =
      data.breakdown.base.value +
      data.breakdown.assets.value +
      data.breakdown.enhance.value +
      data.breakdown.elite.value

    expect(data.totalScore).toBe(sum)
    expect(data.gemEquivalent).toBe(Math.floor(data.totalScore / 50))
  })

  it('returns 400 for invalid tag', async () => {
    const res = await POST(makeRequest({ playerTag: 'invalid' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it('returns 400 for missing playerTag', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 404 when player not found', async () => {
    const { SuprecellApiError: MockError } = await import('@/lib/api')
    mockFetchPlayer.mockRejectedValue(new MockError(404, 'notFound'))
    const res = await POST(makeRequest({ playerTag: '#NOTEXIST' }))

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toContain('not found')
  })

  it('returns 403 when API access denied', async () => {
    const { SuprecellApiError: MockError } = await import('@/lib/api')
    mockFetchPlayer.mockRejectedValue(new MockError(403, 'accessDenied'))
    const res = await POST(makeRequest({ playerTag: '#DENIED' }))

    expect(res.status).toBe(403)
  })
})
