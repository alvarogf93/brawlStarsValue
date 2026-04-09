import type { BattleInsert } from '@/lib/supabase/types'

export type PlayerSegment = 'tilt' | 'main' | 'competitive' | 'explorer' | 'streak'

/**
 * Detect player segment from parsed battlelog (BattleInsert[] format) + trophies.
 * Used to select the personalized hook metric for non-premium users.
 * Priority: tilt > main > competitive > explorer > streak > default(tilt)
 */
export function detectSegment(battles: Pick<BattleInsert, 'result' | 'my_brawler' | 'mode'>[], trophies: number): PlayerSegment {
  if (battles.length === 0) return 'tilt'

  // Check for tilt (3+ consecutive recent losses)
  let consecutiveLosses = 0
  for (const b of battles) {
    if (b.result === 'defeat') { consecutiveLosses++; if (consecutiveLosses >= 3) return 'tilt' }
    else break
  }

  // Check for one-trick/main (60%+ games with same brawler)
  const brawlerCounts = new Map<number, number>()
  for (const b of battles) {
    const id = (b.my_brawler as { id: number } | undefined)?.id
    if (id != null) {
      brawlerCounts.set(id, (brawlerCounts.get(id) ?? 0) + 1)
    }
  }
  if (brawlerCounts.size > 0 && battles.length >= 5) {
    const maxBrawlerPct = Math.max(...brawlerCounts.values()) / battles.length
    if (maxBrawlerPct >= 0.6) return 'main'
  }

  // Check for competitive (high trophies)
  if (trophies > 25000) return 'competitive'

  // Check for explorer (3+ different modes)
  const uniqueModes = new Set(battles.map(b => b.mode).filter(Boolean))
  if (uniqueModes.size >= 3) return 'explorer'

  // Check for win streak (3+ consecutive wins)
  let consecutiveWins = 0
  for (const b of battles) {
    if (b.result === 'victory') { consecutiveWins++; if (consecutiveWins >= 3) return 'streak' }
    else break
  }

  return 'tilt' // Default — universal hook
}
