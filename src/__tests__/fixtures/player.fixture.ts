import type { PlayerTag, PlayerData, BrawlerStat } from '@/lib/types'

export function makePlayerData(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    tag: '#TEST123' as PlayerTag,
    name: 'TestPlayer',
    nameColor: '0xffFFFFFF',
    trophies: 25000,
    highestTrophies: 30000,
    expLevel: 200,
    expPoints: 0,
    totalPrestigeLevel: 5,
    soloVictories: 500,
    duoVictories: 300,
    '3vs3Victories': 2000,
    bestRoboRumbleTime: 0,
    bestTimeAsBigBrawler: 0,
    isQualifiedFromChampionshipChallenge: false,
    icon: { id: 28000000 },
    club: { tag: '#CLUB1', name: 'TestClub' },
    brawlers: [],
    ...overrides,
  }
}

export function makeBrawler(overrides: Partial<BrawlerStat> = {}): BrawlerStat {
  return {
    id: 16000000,
    name: 'SHELLY',
    power: 9,
    rank: 20,
    trophies: 500,
    highestTrophies: 750,
    prestigeLevel: 0,
    currentWinStreak: 0,
    maxWinStreak: 5,
    gadgets: [{ id: 1, name: 'Clay Pigeons' }],
    starPowers: [{ id: 1, name: 'Shell Shock' }],
    hyperCharges: [],
    gears: [{ id: 1, name: 'Damage', level: 1 }],
    buffies: { gadget: false, starPower: false, hyperCharge: false },
    skin: { id: 0, name: 'Default' },
    ...overrides,
  }
}

export function makeMaxBrawler(overrides: Partial<BrawlerStat> = {}): BrawlerStat {
  return makeBrawler({
    power: 11,
    gadgets: [{ id: 1, name: 'G1' }, { id: 2, name: 'G2' }],
    starPowers: [{ id: 1, name: 'SP1' }, { id: 2, name: 'SP2' }],
    hyperCharges: [{ id: 1, name: 'HC1' }],
    gears: [{ id: 1, name: 'Gear1', level: 3 }, { id: 2, name: 'Gear2', level: 3 }],
    ...overrides,
  })
}
