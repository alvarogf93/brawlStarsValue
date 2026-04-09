// ═══════════════════════════════════════════════════════════════
// Types for Brawler Detail page — MetaIntelligence component
// ═══════════════════════════════════════════════════════════════

export interface GlobalStats {
  winRate: number
  pickRate: number
  totalBattles: number
  trend7d: number
}

export interface MapStat {
  eventId: number
  mapName: string
  mode: string
  winRate: number
  totalBattles: number
}

export interface MatchupStat {
  opponentId: number
  winRate: number
  totalBattles: number
}

export interface TeammateStat {
  teammateId: number
  winRate: number
  totalBattles: number
}

export interface BrawlerMetaResponse {
  brawlerId: number
  brawlerName: string
  globalStats: GlobalStats
  bestMaps: MapStat[]
  strongAgainst: MatchupStat[]
  weakAgainst: MatchupStat[]
  bestTeammates: TeammateStat[]
}
