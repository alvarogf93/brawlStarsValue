import { getCachedRegistry } from '@/lib/brawler-registry'

/**
 * Resolve a brawler name from multiple sources.
 * Order: BrawlAPI registry → player data → fallback ID.
 *
 * BrawlAPI community registry may lag behind Supercell (missing new brawlers).
 * Player data from Supercell API is always complete for brawlers the player owns.
 */
export function resolveBrawlerName(
  brawlerId: number,
  playerBrawlerNames?: Map<number, string>,
): string {
  // 1. Try BrawlAPI registry (cached in localStorage)
  const registry = getCachedRegistry()
  const fromRegistry = registry?.find(b => b.id === brawlerId)?.name
  if (fromRegistry) return fromRegistry

  // 2. Try player's own brawler data (from Supercell API)
  const fromPlayer = playerBrawlerNames?.get(brawlerId)
  if (fromPlayer) return fromPlayer

  // 3. Fallback to ID
  return `#${brawlerId}`
}
