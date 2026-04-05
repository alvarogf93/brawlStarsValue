export type PlayerTag = string & { readonly __brand: 'PlayerTag' }

export interface PlayerData {
  tag: PlayerTag
  name: string
  nameColor: string
  trophies: number
  highestTrophies: number
  expLevel: number
  expPoints: number
  totalPrestigeLevel: number
  soloVictories: number
  duoVictories: number
  '3vs3Victories': number
  bestRoboRumbleTime: number
  bestTimeAsBigBrawler: number
  isQualifiedFromChampionshipChallenge: boolean
  icon: { id: number }
  club: { tag: string; name: string } | Record<string, never>
  brawlers: BrawlerStat[]
}

/** Buffies — verified from real API (always present, 3 booleans) */
export interface Buffies {
  gadget: boolean
  starPower: boolean
  hyperCharge: boolean
}

/** Single brawler from /players/{tag} — verified from real API April 2026 */
export interface BrawlerStat {
  id: number
  name: string                         // "SHELLY" — plain string, NOT { value: string }
  power: number                        // 1-11
  rank: number
  trophies: number
  highestTrophies: number
  prestigeLevel: number                // 0, 1, 2, 3
  currentWinStreak: number
  maxWinStreak: number
  starPowers: Array<{ id: number; name: string }>
  gadgets: Array<{ id: number; name: string }>
  hyperCharges: Array<{ id: number; name: string }>  // Real data, no heuristic needed
  gears: Array<{ id: number; name: string; level: number }>
  buffies: Buffies                     // Real data, no heuristic needed
  skin: { id: number; name: string }
}

/** Rarity map: brawler ID → rarity name. Must be maintained manually — API does NOT expose rarity. */
export type RarityMap = Record<number, BrawlerRarityName>

export type BrawlerRarityName =
  | 'Trophy Road'
  | 'Rare'
  | 'Super Rare'
  | 'Epic'
  | 'Mythic'
  | 'Legendary'
  | 'Chromatic'
  | 'Ultra Legendary'

export interface GemScore {
  playerTag: PlayerTag
  playerName: string
  gemEquivalent: number
  totalScore: number
  breakdown: {
    base: { trophies: number; victories3vs3: number; value: number }
    assets: { brawlerCount: number; value: number }
    enhance: {
      gadgets: number
      starPowers: number
      hypercharges: number
      buffies: number
      skins: number
      value: number
    }
    elite: {
      prestige1: number
      prestige2: number
      prestige3: number
      value: number
    }
  }
  timestamp: Date
  cached: boolean
  /** Raw player data included for brawlers/stats pages */
  player?: {
    trophies: number
    highestTrophies: number
    totalPrestigeLevel: number
    expLevel: number
    soloVictories: number
    duoVictories: number
    '3vs3Victories': number
    club: { tag: string; name: string } | Record<string, never>
    icon: { id: number }
    brawlers: BrawlerStat[]
  }
}

export type ApiError =
  | { code: 400; message: 'Invalid player tag format' }
  | { code: 403; message: 'Access denied (API key or IP)' }
  | { code: 404; message: 'Player not found' }
  | { code: 429; message: 'Rate limited' }
  | { code: 500; message: 'Server error' }
  | { code: 503; message: 'Supercell maintenance' }

export type CalculationState = 'idle' | 'loading' | 'success' | 'error'
