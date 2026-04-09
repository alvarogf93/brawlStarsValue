/** Stats for a brawler on a specific map */
export interface MapStat {
  map: string
  mode: string
  eventId: number | null
  winRate: number
  totalBattles: number
}

/** Stats for a brawler vs a specific opponent */
export interface MatchupStat {
  opponentId: number
  opponentName: string
  winRate: number
  totalBattles: number
}

/** Stats for a brawler paired with a specific teammate */
export interface TeammateStat {
  teammateId: number
  teammateName: string
  winRate: number
  totalBattles: number
}

/** Aggregated meta response for a single brawler */
export interface BrawlerMetaResponse {
  brawlerId: number
  globalStats: {
    winRate: number
    pickRate: number
    totalBattles: number
    trend7d: number
  }
  bestMaps: MapStat[]
  worstMaps: MapStat[]
  strongAgainst: MatchupStat[]
  weakAgainst: MatchupStat[]
  bestTeammates: TeammateStat[]
}

/** Actionable recommendation comparing personal vs meta performance */
export interface Recommendation {
  type: 'play' | 'avoid' | 'team'
  brawlerName: string
  /** Map name for 'play', opponent name for 'avoid', teammate name for 'team' */
  context: string
  yourWR: number
  metaWR: number
  /** yourWR - metaWR (positive = you outperform, negative = you underperform) */
  diff: number
}

/** A single day of battle activity for the calendar heatmap */
export interface CalendarDay {
  /** ISO date string YYYY-MM-DD */
  date: string
  games: number
  wins: number
}
