import { describe, it, expect } from 'vitest'
import { calculateValue } from '@/lib/calculate'
import type { PlayerData, PlayerTag, RarityMap } from '@/lib/types'

const MOCK_RARITY: RarityMap = {
  16000000: 'Trophy Road',   // Shelly
  16000005: 'Legendary',     // Spike
}

function makePlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    tag: '#TEST' as PlayerTag,
    name: 'TestPlayer',
    nameColor: '0xffffffff',
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
    isQualifiedFromChampionshipChallenge: false,
    icon: { id: 28000000 },
    club: {},
    brawlers: [],
    ...overrides,
  }
}

describe('calculateValue', () => {
  it('calculates base vector from trophies and 3vs3 victories', () => {
    const player = makePlayer({ trophies: 35000, '3vs3Victories': 8500 })
    const result = calculateValue(player, MOCK_RARITY)

    // trophies: floor(35000 * 0.02) = 700
    // 3vs3: floor(8500 * 0.08) = 680
    expect(result.breakdown.base.trophies).toBe(700)
    expect(result.breakdown.base.victories3vs3).toBe(680)
    expect(result.breakdown.base.value).toBe(1380)
  })

  it('calculates assets using rarity base + real gem cost of power level', () => {
    const player = makePlayer({
      brawlers: [{
        id: 16000005, name: 'SPIKE', power: 11, rank: 25,
        trophies: 800, highestTrophies: 900, prestigeLevel: 0,
        currentWinStreak: 0, maxWinStreak: 0,
        starPowers: [], gadgets: [], hyperCharges: [], gears: [],
        buffies: { gadget: false, starPower: false, hyperCharge: false },
        skin: { id: 0, name: '' },
      }],
    })
    const result = calculateValue(player, MOCK_RARITY)

    // Spike = Legendary (1500) + power 11 gem cost (1151) = 2651
    expect(result.breakdown.assets.brawlerCount).toBe(1)
    expect(result.breakdown.assets.value).toBe(2651)
  })

  it('calculates enhance from gadgets, star powers, hypercharges, buffies, and skins', () => {
    const player = makePlayer({
      brawlers: [{
        id: 16000000, name: 'SHELLY', power: 11, rank: 25,
        trophies: 846, highestTrophies: 854, prestigeLevel: 0,
        currentWinStreak: 0, maxWinStreak: 0,
        starPowers: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
        gadgets: [{ id: 1, name: 'C' }],
        hyperCharges: [{ id: 1, name: 'D' }],
        gears: [],
        buffies: { gadget: true, starPower: true, hyperCharge: false },
        skin: { id: 29000844, name: 'SQUAD BUSTER\nSHELLY' },
      }],
    })
    const result = calculateValue(player, MOCK_RARITY)

    // gadgets: 1 * 200 = 200
    // starPowers: 2 * 400 = 800
    // hyperCharges: 1 * 1200 = 1200
    // buffies: 2 true * 300 = 600 (1000 coins + 2000 PP = 300 gems each)
    // skin: 1 non-default * 79 = 79
    expect(result.breakdown.enhance.gadgets).toBe(1)
    expect(result.breakdown.enhance.starPowers).toBe(2)
    expect(result.breakdown.enhance.hypercharges).toBe(1)
    expect(result.breakdown.enhance.buffies).toBe(2)
    expect(result.breakdown.enhance.skins).toBe(1)
    expect(result.breakdown.enhance.value).toBe(2879)
  })

  it('calculates elite from prestige levels', () => {
    const player = makePlayer({
      brawlers: [
        { id: 16000000, name: 'SHELLY', power: 11, rank: 25,
          trophies: 1200, highestTrophies: 1500, prestigeLevel: 1,
          currentWinStreak: 0, maxWinStreak: 0,
          starPowers: [], gadgets: [], hyperCharges: [], gears: [],
          buffies: { gadget: false, starPower: false, hyperCharge: false },
          skin: { id: 0, name: '' } },
        { id: 16000005, name: 'SPIKE', power: 9, rank: 20,
          trophies: 600, highestTrophies: 750, prestigeLevel: 0,
          currentWinStreak: 0, maxWinStreak: 0,
          starPowers: [], gadgets: [], hyperCharges: [], gears: [],
          buffies: { gadget: false, starPower: false, hyperCharge: false },
          skin: { id: 0, name: '' } },
      ],
    })
    const result = calculateValue(player, MOCK_RARITY)

    // Shelly: prestigeLevel 1 → 10000
    // Spike: prestigeLevel 0, highestTrophies 750 < 1000 → 0
    expect(result.breakdown.elite.prestige1).toBe(1)
    expect(result.breakdown.elite.prestige2).toBe(0)
    expect(result.breakdown.elite.prestige3).toBe(0)
    expect(result.breakdown.elite.value).toBe(10000)
  })

  it('breakdown sums to totalScore', () => {
    const player = makePlayer({
      trophies: 35000,
      '3vs3Victories': 8500,
      brawlers: [{
        id: 16000000, name: 'SHELLY', power: 11, rank: 25,
        trophies: 1200, highestTrophies: 1500, prestigeLevel: 1,
        currentWinStreak: 0, maxWinStreak: 4,
        starPowers: [{ id: 1, name: 'A' }], gadgets: [{ id: 1, name: 'B' }],
        hyperCharges: [{ id: 1, name: 'C' }], gears: [],
        buffies: { gadget: true, starPower: true, hyperCharge: true },
        skin: { id: 0, name: '' },
      }],
    })
    const result = calculateValue(player, MOCK_RARITY)

    const sum =
      result.breakdown.base.value +
      result.breakdown.assets.value +
      result.breakdown.enhance.value +
      result.breakdown.elite.value

    expect(result.totalScore).toBe(sum)
    expect(result.gemEquivalent).toBe(Math.floor(result.totalScore / 50))
  })

  it('returns 0 for empty player', () => {
    const player = makePlayer({ trophies: 0, '3vs3Victories': 0 })
    const result = calculateValue(player, MOCK_RARITY)

    expect(result.gemEquivalent).toBe(0)
    expect(result.totalScore).toBe(0)
  })

  it('falls back to Trophy Road for unknown brawler ID', () => {
    const player = makePlayer({
      brawlers: [{
        id: 99999999, name: 'UNKNOWN', power: 5, rank: 10,
        trophies: 200, highestTrophies: 300, prestigeLevel: 0,
        currentWinStreak: 0, maxWinStreak: 0,
        starPowers: [], gadgets: [], hyperCharges: [], gears: [],
        buffies: { gadget: false, starPower: false, hyperCharge: false },
        skin: { id: 0, name: '' },
      }],
    })
    const result = calculateValue(player, MOCK_RARITY)

    // Trophy Road (100) + power 5 gem cost (45) = 145
    expect(result.breakdown.assets.value).toBe(145)
  })
})
