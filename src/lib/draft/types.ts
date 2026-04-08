/** A row from meta_stats after aggregation (summed over rolling window) */
export interface MetaStat {
  brawlerId: number
  wins: number
  losses: number
  total: number
}

/** A row from meta_matchups after aggregation */
export interface MetaMatchup {
  brawlerId: number
  opponentId: number
  wins: number
  losses: number
  total: number
}

/** Combined data returned by /api/draft/data */
export interface DraftData {
  meta: MetaStat[]
  matchups: MetaMatchup[]
  usersData: MetaStat[]
  personal?: MetaStat[]
  userBrawlers?: { id: number; power: number }[]
}

/** Accumulated counter for batch upsert */
export interface StatAccumulator {
  wins: number
  losses: number
  total: number
}
