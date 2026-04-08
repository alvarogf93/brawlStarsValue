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

export interface Buffies {
  gadget: boolean
  starPower: boolean
  hyperCharge: boolean
}

export interface BrawlerStat {
  id: number
  name: string
  power: number
  rank: number
  trophies: number
  highestTrophies: number
  prestigeLevel: number
  currentWinStreak: number
  maxWinStreak: number
  starPowers: Array<{ id: number; name: string }>
  gadgets: Array<{ id: number; name: string }>
  hyperCharges: Array<{ id: number; name: string }>
  gears: Array<{ id: number; name: string; level: number }>
  buffies: Buffies
  skin: { id: number; name: string }
}

export type BrawlerRarityName =
  | 'Trophy Road'
  | 'Rare'
  | 'Super Rare'
  | 'Epic'
  | 'Mythic'
  | 'Legendary'
  | 'Chromatic'
  | 'Ultra Legendary'

export type RarityMap = Record<number, BrawlerRarityName>

/** Output: real gem value of account + profile stats */
export interface GemScore {
  playerTag: string
  playerName: string
  /** Total real gems invested in the account */
  totalGems: number
  /** Breakdown of VERIFIED gem costs (from API data + game economics) */
  breakdown: {
    powerLevels: { count: number; gems: number }
    gadgets: { count: number; gems: number }
    starPowers: { count: number; gems: number }
    hypercharges: { count: number; gems: number }
    buffies: { count: number; gems: number }
    gears: { count: number; gems: number }
  }
  /** Data for user-input values (skins) — not counted in totalGems until user classifies */
  userInput: {
    skinsEquipped: number  // how many non-default skins we detected
  }
  /** Profile stats (not gem costs — achievements/time) */
  stats: {
    trophies: number
    highestTrophies: number
    totalPrestigeLevel: number
    soloVictories: number
    duoVictories: number
    threeVsThreeVictories: number
    totalVictories: number
    /** Estimated total matches (victories / winRate) */
    estimatedTotalMatches: number
    /** Estimated hours played (estimatedTotalMatches × 2min / 60) */
    estimatedHoursPlayed: number
    /** Win rate used for estimation (0-1). From battlelog if available, else 0.5 */
    winRateUsed: number
  }
  timestamp: Date
  cached: boolean
  /** Raw player data for sub-pages */
  player?: {
    trophies: number
    highestTrophies: number
    totalPrestigeLevel: number
    expLevel: number
    soloVictories: number
    duoVictories: number
    '3vs3Victories': number
    club: { tag: string; name: string; badgeId?: number | null } | Record<string, never>
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
