import { getCachedRegistry } from '@/lib/brawler-registry'
import { readSupercellRosterCache } from '@/lib/supercell-roster-cache'

/**
 * Resolve a brawler name from multiple sources, priority order chosen
 * so a brand-new brawler (e.g. DAMIAN, NAJIA, SIRIUS, STARR NOVA, BOLT
 * — all of which exist in Supercell's API but were missing from
 * Brawlify on 2026-05-04) ALWAYS shows its real name instead of the
 * fallback `#16000104` ID.
 *
 *   1. Supercell roster cache (populated by `useBrawlerRegistry`,
 *      sourced from /api/brawlers which proxies the official endpoint).
 *      Authoritative for which brawlers exist + their canonical names.
 *      Available the same day a brawler ships.
 *
 *   2. Brawlify community registry (populated by MetaIntelligence /
 *      DraftSimulator). Adds class/rarity/imageUrl that Supercell
 *      doesn't expose, but lags Supercell by 1-3 days for new brawlers.
 *
 *   3. Caller-supplied map from `data.player.brawlers` (Supercell again,
 *      but only includes brawlers the player owns). Useful when the
 *      caller is a per-player view that hydrates this map up-front.
 *
 *   4. Fallback to `#${id}`. Only reachable on a cold load when both
 *      caches are empty AND the caller didn't supply a player map —
 *      should be very rare in practice.
 */
export function resolveBrawlerName(
  brawlerId: number,
  playerBrawlerNames?: Map<number, string>,
): string {
  // 1. Supercell roster cache — canonical, includes new brawlers.
  const supercell = readSupercellRosterCache()
  if (supercell) {
    const fromSupercell = supercell.roster.find(b => b.id === brawlerId)?.name
    if (fromSupercell) return fromSupercell
  }

  // 2. Brawlify registry — fills any gap (e.g. cache version mismatch
  //    on the Supercell side after a schema bump).
  const registry = getCachedRegistry()
  const fromRegistry = registry?.find(b => b.id === brawlerId)?.name
  if (fromRegistry) return fromRegistry

  // 3. Caller-supplied player names map.
  const fromPlayer = playerBrawlerNames?.get(brawlerId)
  if (fromPlayer) return fromPlayer

  // 4. Last-resort fallback — visible to the user only when everything
  //    above missed. Tests assert this code path isn't reached when
  //    either cache is populated.
  return `#${brawlerId}`
}
