import { describe, it, expect } from 'vitest'
import { calculateValue } from '@/lib/calculate'
import type { PlayerData, PlayerTag, RarityMap } from '@/lib/types'

const MOCK_RARITY: RarityMap = {
  16000000: 'Trophy Road',   // Shelly — unlock 0
  16000005: 'Legendary',     // Spike — unlock 700
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

function makeBrawler(id: number, overrides: Partial<import('@/lib/types').BrawlerStat> = {}): import('@/lib/types').BrawlerStat {
  return {
    id, name: 'TEST', power: 1, rank: 1,
    trophies: 0, highestTrophies: 0, prestigeLevel: 0,
    currentWinStreak: 0, maxWinStreak: 0,
    starPowers: [], gadgets: [], hyperCharges: [], gears: [],
    buffies: { gadget: false, starPower: false, hyperCharge: false },
    skin: { id: 0, name: 'TEST' },
    ...overrides,
  }
}

describe('calculateValue — real gems', () => {
  it('returns 0 gems for empty player', () => {
    const result = calculateValue(makePlayer(), MOCK_RARITY)
    expect(result.totalGems).toBe(0)
  })

  it('calculates unlock cost by rarity', () => {
    const player = makePlayer({
      brawlers: [
        makeBrawler(16000000), // Trophy Road = 0
        makeBrawler(16000005), // Legendary = 700
      ],
    })
    const result = calculateValue(player, MOCK_RARITY)
    expect(result.breakdown.unlocks.count).toBe(2)
    expect(result.breakdown.unlocks.gems).toBe(700) // 0 + 700
  })

  it('calculates power level real gem cost', () => {
    const player = makePlayer({
      brawlers: [makeBrawler(16000000, { power: 11 })],
    })
    const result = calculateValue(player, MOCK_RARITY)
    expect(result.breakdown.powerLevels.gems).toBe(1151) // Level 11 real cost
  })

  it('calculates gadgets at 100 gems each', () => {
    const player = makePlayer({
      brawlers: [makeBrawler(16000000, {
        gadgets: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
      })],
    })
    const result = calculateValue(player, MOCK_RARITY)
    expect(result.breakdown.gadgets).toEqual({ count: 2, gems: 200 })
  })

  it('calculates star powers at 200 gems each', () => {
    const player = makePlayer({
      brawlers: [makeBrawler(16000000, {
        starPowers: [{ id: 1, name: 'A' }],
      })],
    })
    const result = calculateValue(player, MOCK_RARITY)
    expect(result.breakdown.starPowers).toEqual({ count: 1, gems: 200 })
  })

  it('calculates hypercharges at 500 gems each', () => {
    const player = makePlayer({
      brawlers: [makeBrawler(16000000, {
        hyperCharges: [{ id: 1, name: 'A' }],
      })],
    })
    const result = calculateValue(player, MOCK_RARITY)
    expect(result.breakdown.hypercharges).toEqual({ count: 1, gems: 500 })
  })

  it('calculates buffies at 300 gems each', () => {
    const player = makePlayer({
      brawlers: [makeBrawler(16000000, {
        buffies: { gadget: true, starPower: true, hyperCharge: false },
      })],
    })
    const result = calculateValue(player, MOCK_RARITY)
    expect(result.breakdown.buffies).toEqual({ count: 2, gems: 600 })
  })

  it('calculates non-default skins at 79 gems each', () => {
    const player = makePlayer({
      brawlers: [makeBrawler(16000000, {
        name: 'SHELLY',
        skin: { id: 29000844, name: 'SQUAD BUSTER\nSHELLY' },
      })],
    })
    const result = calculateValue(player, MOCK_RARITY)
    expect(result.breakdown.skins).toEqual({ count: 1, gems: 79 })
  })

  it('does not count default skin', () => {
    const player = makePlayer({
      brawlers: [makeBrawler(16000000, {
        name: 'SHELLY',
        skin: { id: 0, name: 'SHELLY' },
      })],
    })
    const result = calculateValue(player, MOCK_RARITY)
    expect(result.breakdown.skins).toEqual({ count: 0, gems: 0 })
  })

  it('totalGems equals sum of all breakdown gems', () => {
    const player = makePlayer({
      brawlers: [makeBrawler(16000005, { // Legendary = 700 unlock
        power: 11,                       // 1151 gems
        gadgets: [{ id: 1, name: 'A' }], // 100
        starPowers: [{ id: 1, name: 'B' }, { id: 2, name: 'C' }], // 400
        hyperCharges: [{ id: 1, name: 'D' }], // 500
        buffies: { gadget: true, starPower: true, hyperCharge: true }, // 900
        name: 'SPIKE',
        skin: { id: 29000777, name: 'POOP SPIKE' }, // 79
      })],
    })
    const result = calculateValue(player, MOCK_RARITY)

    const sum = result.breakdown.unlocks.gems
      + result.breakdown.powerLevels.gems
      + result.breakdown.gadgets.gems
      + result.breakdown.starPowers.gems
      + result.breakdown.hypercharges.gems
      + result.breakdown.buffies.gems
      + result.breakdown.skins.gems

    expect(result.totalGems).toBe(sum)
    expect(result.totalGems).toBe(700 + 1151 + 100 + 400 + 500 + 900 + 79)
  })

  it('calculates estimated hours played', () => {
    const player = makePlayer({
      soloVictories: 100,
      duoVictories: 200,
      '3vs3Victories': 300,
    })
    const result = calculateValue(player, MOCK_RARITY)
    // 600 total victories × 2 min / 60 = 20 hours
    expect(result.stats.totalVictories).toBe(600)
    expect(result.stats.estimatedHoursPlayed).toBe(20)
  })
})
