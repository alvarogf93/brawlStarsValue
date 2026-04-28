import type { StatAccumulator } from './types'

/** In-memory accumulators for batch processing */
export interface MetaAccumulators {
  /** Key: "brawlerId|map|mode" → wins/losses/total */
  stats: Map<string, StatAccumulator>
  /** Key: "brawlerId|opponentId|mode" → wins/losses/total */
  matchups: Map<string, StatAccumulator>
  /** Key: "b1|b2|b3|map|mode" → wins/losses/total + metadata */
  trios: Map<string, StatAccumulator & { ids: number[]; map: string; mode: string }>
}

export interface BattleMetaInput {
  myBrawlerId: number
  opponentBrawlerIds: number[]
  map: string | null
  mode: string
  result: string
}

/**
 * Process a single battle into the in-memory accumulators.
 * Skips draws and battles with null maps.
 * Does NOT touch the database — call flushAccumulators() after batch.
 */
export function processBattleForMeta(acc: MetaAccumulators, battle: BattleMetaInput): void {
  // Skip draws and battles without a map
  if (battle.result !== 'victory' && battle.result !== 'defeat') return
  if (!battle.map) return

  // LOG-19 — reject sentinel/missing brawler ids. Callers commonly
  // resolve the brawler with `b.my_brawler?.id ?? 0` as fallback;
  // letting `0` flow through writes a meta_stats row keyed on a
  // non-existent brawler. Same guard for opponents.
  if (!Number.isFinite(battle.myBrawlerId) || battle.myBrawlerId <= 0) return
  const validOpponents = battle.opponentBrawlerIds.filter(
    (id) => Number.isFinite(id) && id > 0,
  )

  const isWin = battle.result === 'victory'
  const wins = isWin ? 1 : 0
  const losses = isWin ? 0 : 1

  // Accumulate meta_stats: brawler + map + mode
  const statKey = `${battle.myBrawlerId}|${battle.map}|${battle.mode}`
  const existing = acc.stats.get(statKey)
  if (existing) {
    existing.wins += wins
    existing.losses += losses
    existing.total += 1
  } else {
    acc.stats.set(statKey, { wins, losses, total: 1 })
  }

  // Accumulate meta_matchups: brawler vs each opponent (mode-level, not map-level)
  for (const opponentId of validOpponents) {
    const matchupKey = `${battle.myBrawlerId}|${opponentId}|${battle.mode}`
    const mexisting = acc.matchups.get(matchupKey)
    if (mexisting) {
      mexisting.wins += wins
      mexisting.losses += losses
      mexisting.total += 1
    } else {
      acc.matchups.set(matchupKey, { wins, losses, total: 1 })
    }
  }
}
