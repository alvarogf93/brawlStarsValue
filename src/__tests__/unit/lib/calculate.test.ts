import { describe, it, expect } from 'vitest'
import { calculateValue } from '@/lib/calculate'
import type { PlayerData, PlayerTag, RarityMap, BrawlerStat } from '@/lib/types'

const MOCK_RARITY: RarityMap = {
  16000000: 'Trophy Road',
  16000005: 'Legendary',
}

function makePlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    tag: '#TEST' as PlayerTag, name: 'TestPlayer', nameColor: '0xffffffff',
    trophies: 10000, highestTrophies: 11000, expLevel: 100, expPoints: 1000,
    totalPrestigeLevel: 0, soloVictories: 100, duoVictories: 50, '3vs3Victories': 500,
    bestRoboRumbleTime: 0, bestTimeAsBigBrawler: 0, isQualifiedFromChampionshipChallenge: false,
    icon: { id: 28000000 }, club: {}, brawlers: [],
    ...overrides,
  }
}

function makeBrawler(id: number, overrides: Partial<BrawlerStat> = {}): BrawlerStat {
  return {
    id, name: 'TEST', power: 1, rank: 1, trophies: 0, highestTrophies: 0,
    prestigeLevel: 0, currentWinStreak: 0, maxWinStreak: 0,
    starPowers: [], gadgets: [], hyperCharges: [], gears: [],
    buffies: { gadget: false, starPower: false, hyperCharge: false },
    skin: { id: 0, name: 'TEST' },
    ...overrides,
  }
}

describe('calculateValue — real verified gems only', () => {
  it('returns 0 gems for empty player', () => {
    const result = calculateValue(makePlayer(), { rarityMap: MOCK_RARITY })
    expect(result.totalGems).toBe(0)
  })

  it('calculates power level real gem cost', () => {
    const player = makePlayer({ brawlers: [makeBrawler(16000000, { power: 11 })] })
    const result = calculateValue(player, { rarityMap: MOCK_RARITY })
    expect(result.breakdown.powerLevels.gems).toBe(1151)
  })

  it('calculates gadgets at 100 gems each', () => {
    const player = makePlayer({ brawlers: [makeBrawler(16000000, {
      gadgets: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
    })] })
    const result = calculateValue(player, { rarityMap: MOCK_RARITY })
    expect(result.breakdown.gadgets).toEqual({ count: 2, gems: 200 })
  })

  it('calculates star powers at 200 gems each', () => {
    const player = makePlayer({ brawlers: [makeBrawler(16000000, {
      starPowers: [{ id: 1, name: 'A' }],
    })] })
    const result = calculateValue(player, { rarityMap: MOCK_RARITY })
    expect(result.breakdown.starPowers).toEqual({ count: 1, gems: 200 })
  })

  it('calculates hypercharges at 500 gems each', () => {
    const player = makePlayer({ brawlers: [makeBrawler(16000000, {
      hyperCharges: [{ id: 1, name: 'A' }],
    })] })
    const result = calculateValue(player, { rarityMap: MOCK_RARITY })
    expect(result.breakdown.hypercharges).toEqual({ count: 1, gems: 500 })
  })

  it('calculates buffies at 300 gems each', () => {
    const player = makePlayer({ brawlers: [makeBrawler(16000000, {
      buffies: { gadget: true, starPower: true, hyperCharge: false },
    })] })
    const result = calculateValue(player, { rarityMap: MOCK_RARITY })
    expect(result.breakdown.buffies).toEqual({ count: 2, gems: 600 })
  })

  it('does NOT include skins in totalGems (user classifies separately)', () => {
    const player = makePlayer({ brawlers: [makeBrawler(16000000, {
      name: 'SHELLY', skin: { id: 29000844, name: 'SQUAD BUSTER\nSHELLY' },
    })] })
    const result = calculateValue(player, { rarityMap: MOCK_RARITY })
    expect(result.userInput.skinsEquipped).toBe(1)
    // Skins NOT in totalGems
    expect(result.totalGems).toBe(0)
  })

  it('calculates gears at 100 gems each', () => {
    const player = makePlayer({ brawlers: [makeBrawler(16000000, {
      gears: [{ id: 1, name: 'A', level: 1 }, { id: 2, name: 'B', level: 1 }],
    })] })
    const result = calculateValue(player, { rarityMap: MOCK_RARITY })
    expect(result.breakdown.gears).toEqual({ count: 2, gems: 200 })
  })

  it('totalGems equals sum of all breakdown gems', () => {
    const player = makePlayer({ brawlers: [makeBrawler(16000005, {
      power: 11,                                                    // 1151
      gadgets: [{ id: 1, name: 'A' }],                             // 100
      starPowers: [{ id: 1, name: 'B' }, { id: 2, name: 'C' }],   // 400
      hyperCharges: [{ id: 1, name: 'D' }],                        // 500
      buffies: { gadget: true, starPower: true, hyperCharge: true },// 900
      gears: [{ id: 1, name: 'E', level: 1 }],                    // 100
      name: 'SPIKE', skin: { id: 29000777, name: 'POOP SPIKE' },
    })] })
    const result = calculateValue(player, { rarityMap: MOCK_RARITY })

    const sum = result.breakdown.powerLevels.gems
      + result.breakdown.gadgets.gems
      + result.breakdown.starPowers.gems
      + result.breakdown.hypercharges.gems
      + result.breakdown.buffies.gems
      + result.breakdown.gears.gems

    expect(result.totalGems).toBe(sum)
    expect(result.totalGems).toBe(1151 + 100 + 400 + 500 + 900 + 100)
  })

  it('calculates estimated hours played accounting for losses (~50% win rate)', () => {
    const player = makePlayer({ soloVictories: 100, duoVictories: 200, '3vs3Victories': 300 })
    const result = calculateValue(player, { rarityMap: MOCK_RARITY })
    expect(result.stats.totalVictories).toBe(600)
    // 600 wins / 0.5 = 1200 estimated matches × 2min / 60 = 40h
    expect(result.stats.estimatedTotalMatches).toBe(1200)
    expect(result.stats.estimatedHoursPlayed).toBe(40)
  })
})
