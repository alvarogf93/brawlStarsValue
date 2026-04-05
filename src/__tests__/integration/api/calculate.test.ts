import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/calculate/route'
import type { PlayerData } from '@/lib/types'

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
    expect(data.breakdown.unlocks).toBeDefined()
    expect(data.breakdown.powerLevels).toBeDefined()
    expect(data.stats).toBeDefined()
    expect(data.stats.estimatedHoursPlayed).toBeGreaterThan(0)
  })

  it('breakdown sums to totalGems', async () => {
    mockFetchPlayer.mockResolvedValue(MOCK_PLAYER)
    const res = await POST(makeRequest({ playerTag: '#YJU282PV' }))
    const data = await res.json()

    const sum = data.breakdown.unlocks.gems
      + data.breakdown.powerLevels.gems
      + data.breakdown.gadgets.gems
      + data.breakdown.starPowers.gems
      + data.breakdown.hypercharges.gems
      + data.breakdown.buffies.gems
      + data.breakdown.skins.gems

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
