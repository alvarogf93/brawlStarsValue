import type { StatAccumulator } from './types'

/** In-memory accumulators for batch processing */
export interface MetaAccumulators {
  /** Key: "brawlerId|map|mode" → wins/losses/total */
  stats: Map<string, StatAccumulator>
  /** Key: "brawlerId|opponentId|mode" → wins/losses/total */
  matchups: Map<string, StatAccumulator>
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
  for (const opponentId of battle.opponentBrawlerIds) {
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
