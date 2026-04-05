import { describe, it, expect } from 'vitest'
import { calculateValue } from '../../../lib/calculate'
import type { PlayerData, PlayerTag } from '../../../lib/types'

describe('calculateValue', () => {
  it('calculates the correct Gem Score', () => {
    const mockData: PlayerData = {
      tag: '#TEST' as PlayerTag,
      name: 'Player 1',
      nameColor: '#FFF',
      trophies: 10000,
      highestTrophies: 11000,
      expLevel: 100,
      expPoints: 1000,
      totalPrestigeLevel: 0,
      soloVictories: 100,
      duoVictories: 50,
      '3vs3Victories': 500,
      bestRoboRumbleTime: 0,
      bestTimeAsBigBrawler: 0,
      isQualifiedFromChampionshipChallenge: true,
      icon: { id: 1 },
      club: {},
      brawlers: [
        {
          id: 1,
          name: { value: 'Shelly' },
          power: 10,
          rank: 20,
          trophies: 500,
          highestTrophies: 600,
          prestigeLevel: 0,
          currentWinStreak: 0,
          maxWinStreak: 0,
          starPowers: [{ id: 1, name: 'A' }],
          gadgets: [{ id: 1, name: 'B' }],
          hyperCharges: [],
          gears: [],
          skin: { id: 1 }
        }
      ]
    }

    const result = calculateValue(mockData)
    
    // Trophies = 10000 * 0.02 = 200
    // 3vs3 = 500 * 0.08 = 40
    // Base = 240
    // Assets: Shelly is rare (100) * (Power 10 * 0.1=1) = 100
    // Enhance: 1 SP (400) + 1 Gadget (200) = 600
    // Total = 240 + 100 + 600 = 940
    // Gem Eq = 940 / 50 = 18.8 -> Math.floor = 18

    expect(result.breakdown.base.value).toBe(240)
    expect(result.breakdown.assets.value).toBe(100)
    expect(result.breakdown.enhance.value).toBe(600)
    expect(result.totalScore).toBe(940)
    expect(result.gemEquivalent).toBe(18)
  })
})
