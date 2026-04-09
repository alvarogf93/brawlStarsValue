/** Per-map performance stats for a single brawler */
export interface BrawlerMapStat {
  map: string
  mode: string
  winRate: number
  pickCount: number
  wins: number
  losses: number
  total: number
}

/** Aggregated meta response for a single brawler */
export interface BrawlerMetaResponse {
  brawlerId: number
  /** Rolling window in days used for aggregation */
  window: number
  /** Overall win rate across all maps (bayesian-adjusted) */
  overallWinRate: number
  /** Total battles observed across all maps */
  totalBattles: number
  /** Per-map breakdown sorted by win rate descending */
  maps: BrawlerMapStat[]
}
