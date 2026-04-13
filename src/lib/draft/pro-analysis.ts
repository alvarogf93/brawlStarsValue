// ═══════════════════════════════════════════════════════════════
// Response type for /api/meta/pro-analysis
// ═══════════════════════════════════════════════════════════════

export interface ProAnalysisResponse {
  // === PUBLIC (free users see this) ===

  topBrawlers: TopBrawlerEntry[]
  totalProBattles: number
  windowDays: number

  /**
   * Indicates whether `topBrawlers` was aggregated from the exact
   * (map, mode) filter ('map-mode') or from the mode-only fallback
   * when the map had no brawlers passing the display threshold
   * ('mode-fallback'). The UI renders a banner explaining the
   * fallback when this is 'mode-fallback'.
   *
   * Added in Sprint C — see docs/superpowers/specs/2026-04-13-meta-ux-remediation-design.md §7.2.
   */
  topBrawlersSource: 'map-mode' | 'mode-fallback'

  trending: {
    rising: TrendEntry[]
    falling: TrendEntry[]
  }

  counters: CounterEntry[]

  /**
   * Most-repeated teammate pairings per top brawler — derived from
   * meta_trios for the same map+mode. Each entry is keyed by
   * brawlerId and carries up to 3 trios sorted by pick frequency.
   * Surfaced inline under each card in TopBrawlersGrid (top 1 visible,
   * "Ver más" expands to the rest). Shown to all users; the standalone
   * ProTrioGrid section was removed in Sprint D because per-brawler
   * context is more actionable than a decontextualised global ranking.
   */
  topBrawlerTeammates: TeammateGroupEntry[]

  // === PREMIUM ONLY (null for free users) ===

  dailyTrend: DailyTrendEntry[] | null

  /**
   * Full list of trios (3 brawlers) the pros used on this map+mode,
   * filtered by PRO_MIN_BATTLES_DISPLAY and sorted by WR. Consumed by
   * the private profile analytics page (TeamSynergyView) as a lookup
   * map to annotate the user's own trios with a PRO comparison badge.
   * The standalone ProTrioGrid section was removed in Sprint D; this
   * field remains to power the cross-reference on the analytics page.
   */
  proTrios: ProTrioEntry[] | null

  personalGap: GapEntry[] | null

  matchupGaps: MatchupGapEntry[] | null
}

export interface TopBrawlerEntry {
  brawlerId: number
  name: string
  winRate: number
  pickRate: number
  totalBattles: number
  trend7d: number | null
  trend30d: number | null
}

export interface TrendEntry {
  brawlerId: number
  name: string
  delta7d: number
}

export interface CounterEntry {
  brawlerId: number
  name: string
  bestCounters: CounterMatchup[]
  worstMatchups: CounterMatchup[]
}

export interface CounterMatchup {
  opponentId: number
  name: string
  winRate: number
  total: number
}

export interface DailyTrendEntry {
  date: string
  brawlers: Array<{ brawlerId: number; winRate: number; picks: number }>
}

export interface TeammateTrio {
  /** The 2 OTHER brawlers in the trio — the anchor brawler is excluded. */
  teammates: Array<{ id: number; name: string }>
  winRate: number
  total: number
}

export interface TeammateGroupEntry {
  /** Anchor brawler — one of the topBrawlers entries. */
  brawlerId: number
  /** Up to 3 teammate trios, sorted by total (frequency) descending. */
  trios: TeammateTrio[]
}

/**
 * Full pro trio (3 brawlers) on a specific map+mode. Used by the
 * private profile analytics page to annotate the user's own trios
 * with a PRO comparison badge. Retained in Sprint D after the
 * standalone ProTrioGrid was removed — the field still powers the
 * cross-reference on TeamSynergyView.
 */
export interface ProTrioEntry {
  brawlers: Array<{ id: number; name: string }>
  winRate: number
  total: number
}

export interface GapEntry {
  brawlerId: number
  name: string
  yourWR: number
  proWR: number
  gap: number
  yourTotal: number
  proTotal: number
  verdict: 'above' | 'below' | 'on-par'
}

export interface MatchupGapEntry {
  brawlerId: number
  opponentId: number
  brawlerName: string
  opponentName: string
  yourWR: number
  proWR: number
  gap: number
}

// ═══════════════════════════════════════════════════════════════
// Pure helper functions (no DB, no side effects)
// ═══════════════════════════════════════════════════════════════

/**
 * Compute the trend delta between current and previous window WRs.
 * Returns null if previous data is unavailable.
 */
export function computeTrendDelta(currentWR: number, previousWR: number | null): number | null {
  if (previousWR === null) return null
  return Number((currentWR - previousWR).toFixed(2))
}

/**
 * Determine gap verdict: 'above' if user > PRO by >3pp,
 * 'below' if user < PRO by >3pp, 'on-par' otherwise.
 */
export function computeGapVerdict(userWR: number, proWR: number): 'above' | 'below' | 'on-par' {
  const gap = userWR - proWR
  if (gap > 3) return 'above'
  if (gap < -3) return 'below'
  return 'on-par'
}

/**
 * Filter entries that have at least `minBattles` total.
 */
export function filterByMinBattles<T extends { total: number }>(
  data: T[],
  minBattles: number,
): T[] {
  return data.filter(d => d.total >= minBattles)
}

/**
 * Sort 3 brawler IDs into canonical ascending order for deduplication.
 */
export function canonicalizeTrioKey(ids: number[]): number[] {
  return [...ids].sort((a, b) => a - b)
}

/**
 * Compute pick rate as a percentage of total battles.
 */
export function computePickRate(brawlerBattles: number, totalBattles: number): number {
  if (totalBattles === 0) return 0
  return (brawlerBattles / totalBattles) * 100
}
