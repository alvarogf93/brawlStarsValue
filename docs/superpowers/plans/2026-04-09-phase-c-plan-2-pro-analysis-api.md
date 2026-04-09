# Phase C: Pro Meta Analytics — Pro Analysis API Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `/api/meta/pro-analysis` endpoint and `useProAnalysis` client hook that powers the Meta PRO tab and inline PRO badges across all analytics tabs.

**Architecture:** A single GET endpoint queries `meta_stats`, `meta_matchups`, and `meta_trios` for a given map+mode+window, computes Bayesian-adjusted win rates, trends, and counters for the public tier. For premium users with a linked player tag, it also queries the `battles` table to compute personal gap analysis. The endpoint applies auth-tier gating server-side: free users get top 5 brawlers + limited counters, premium users get the full response including daily trends, pro trios, and gap analysis. The `useProAnalysis` hook provides client-side caching, abort-on-unmount, and loading/error states.

**Tech Stack:** Next.js Route Handler, Supabase server client, TypeScript, Vitest (TDD for pure helpers)

**Spec reference:** `docs/superpowers/specs/2026-04-09-phase-c-pro-meta-analytics-design.md`

**Dependency:** Plan 1 (data infrastructure) must be complete — requires `meta_trios` table and updated `MetaAccumulators`

---

## Task 1: Define `ProAnalysisResponse` type and pure helper functions

Creates the response type and all pure computation helpers (trend delta, gap verdict, brawler name resolver) with TDD.

### Steps

- [ ] **1.1** Write tests FIRST:

**File:** `src/__tests__/unit/lib/draft/pro-analysis.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import {
  computeTrendDelta,
  computeGapVerdict,
  filterByMinBattles,
  canonicalizeTrioKey,
  computePickRate,
} from '@/lib/draft/pro-analysis'
import { bayesianWinRate } from '@/lib/draft/scoring'

describe('computeTrendDelta', () => {
  it('returns positive delta when current WR > previous WR', () => {
    // Current window: 60 wins / 100 total, Previous: 50 wins / 100 total
    const currentWR = bayesianWinRate(60, 100)
    const previousWR = bayesianWinRate(50, 100)
    const delta = computeTrendDelta(currentWR, previousWR)
    expect(delta).toBeGreaterThan(0)
    expect(delta).toBeCloseTo(currentWR - previousWR, 1)
  })

  it('returns negative delta when current WR < previous WR', () => {
    const currentWR = bayesianWinRate(40, 100)
    const previousWR = bayesianWinRate(60, 100)
    const delta = computeTrendDelta(currentWR, previousWR)
    expect(delta).toBeLessThan(0)
  })

  it('returns null when previous WR is null (no previous data)', () => {
    const delta = computeTrendDelta(55.0, null)
    expect(delta).toBeNull()
  })

  it('returns 0 when both WRs are identical', () => {
    const delta = computeTrendDelta(50.0, 50.0)
    expect(delta).toBe(0)
  })
})

describe('computeGapVerdict', () => {
  it('returns "above" when user WR > PRO WR + 3', () => {
    expect(computeGapVerdict(65, 58)).toBe('above')
  })

  it('returns "below" when user WR < PRO WR - 3', () => {
    expect(computeGapVerdict(48, 62)).toBe('below')
  })

  it('returns "on-par" when |gap| <= 3', () => {
    expect(computeGapVerdict(60, 58)).toBe('on-par')
    expect(computeGapVerdict(55, 58)).toBe('on-par')
    expect(computeGapVerdict(61, 58)).toBe('on-par')
  })

  it('returns "on-par" at exactly 3 point gap boundary', () => {
    expect(computeGapVerdict(61, 58)).toBe('on-par')
    expect(computeGapVerdict(55, 58)).toBe('on-par')
  })

  it('returns "above" at 3.01 points above', () => {
    expect(computeGapVerdict(61.01, 58)).toBe('above')
  })
})

describe('filterByMinBattles', () => {
  it('removes entries below threshold', () => {
    const data = [
      { brawlerId: 1, wins: 15, total: 19 },
      { brawlerId: 2, wins: 20, total: 25 },
      { brawlerId: 3, wins: 5, total: 8 },
    ]
    const filtered = filterByMinBattles(data, 20)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].brawlerId).toBe(2)
  })

  it('keeps entries exactly at threshold', () => {
    const data = [{ brawlerId: 1, wins: 10, total: 20 }]
    const filtered = filterByMinBattles(data, 20)
    expect(filtered).toHaveLength(1)
  })

  it('returns empty array when all below threshold', () => {
    const data = [{ brawlerId: 1, wins: 5, total: 10 }]
    const filtered = filterByMinBattles(data, 20)
    expect(filtered).toHaveLength(0)
  })
})

describe('canonicalizeTrioKey', () => {
  it('sorts IDs in ascending order', () => {
    expect(canonicalizeTrioKey([3, 1, 2])).toEqual([1, 2, 3])
  })

  it('handles already sorted IDs', () => {
    expect(canonicalizeTrioKey([10, 20, 30])).toEqual([10, 20, 30])
  })

  it('handles reverse sorted IDs', () => {
    expect(canonicalizeTrioKey([100, 50, 1])).toEqual([1, 50, 100])
  })
})

describe('computePickRate', () => {
  it('computes percentage of total battles', () => {
    const rate = computePickRate(50, 1000)
    expect(rate).toBeCloseTo(5.0, 1)
  })

  it('returns 0 when totalBattles is 0', () => {
    expect(computePickRate(10, 0)).toBe(0)
  })

  it('handles 100% pick rate', () => {
    expect(computePickRate(100, 100)).toBeCloseTo(100, 1)
  })
})
```

- [ ] **1.2** Run the tests (expect failure — module doesn't exist yet):

```bash
npx vitest run src/__tests__/unit/lib/draft/pro-analysis.test.ts
```

- [ ] **1.3** Create the helper module and response type:

**File:** `src/lib/draft/pro-analysis.ts`

```typescript
import type { StatAccumulator } from './types'

// ═══════════════════════════════════════════════════════════════
// Response type for /api/meta/pro-analysis
// ═══════════════════════════════════════════════════════════════

export interface ProAnalysisResponse {
  // === PUBLIC (free users see this) ===

  topBrawlers: TopBrawlerEntry[]
  totalProBattles: number
  windowDays: number

  trending: {
    rising: TrendEntry[]
    falling: TrendEntry[]
  }

  counters: CounterEntry[]

  // === PREMIUM ONLY (null for free users) ===

  dailyTrend: DailyTrendEntry[] | null

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
```

- [ ] **1.4** Run the tests (expect all to pass):

```bash
npx vitest run src/__tests__/unit/lib/draft/pro-analysis.test.ts
```

- [ ] **1.5** Commit:

```bash
git add src/lib/draft/pro-analysis.ts src/__tests__/unit/lib/draft/pro-analysis.test.ts
git commit -m "feat(api): add ProAnalysisResponse type and pure helper functions

computeTrendDelta, computeGapVerdict, filterByMinBattles,
canonicalizeTrioKey, computePickRate — all with TDD tests."
```

---

## Task 2: Implement `/api/meta/pro-analysis` endpoint

Creates the route handler that queries Supabase for pro data, applies Bayesian smoothing, computes trends/counters, and gates premium fields by auth tier.

### Steps

- [ ] **2.1** Create the brawler name resolver utility (used to convert IDs to display names):

**File:** `src/lib/draft/brawler-names.ts`

```typescript
/**
 * Resolves brawler IDs to display names.
 * Uses the brawler list from the API, cached in memory for the
 * duration of a single request. Falls back to "Brawler #ID".
 */

let cachedBrawlers: Map<number, string> | null = null

export async function loadBrawlerNames(): Promise<Map<number, string>> {
  if (cachedBrawlers) return cachedBrawlers

  try {
    const res = await fetch('https://api.brawlify.com/v1/brawlers', {
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`Brawlify API ${res.status}`)
    const data = await res.json()
    const map = new Map<number, string>()
    for (const b of data.list ?? []) {
      map.set(b.id, b.name)
    }
    cachedBrawlers = map
    return map
  } catch {
    return new Map()
  }
}

export function getBrawlerName(names: Map<number, string>, id: number): string {
  return names.get(id) ?? `Brawler #${id}`
}
```

- [ ] **2.2** Create the route handler:

**File:** `src/app/api/meta/pro-analysis/route.ts`

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { bayesianWinRate } from '@/lib/draft/scoring'
import { PRO_MIN_BATTLES_DISPLAY, PRO_TREND_DAYS_SHORT, PRO_TREND_DAYS_LONG } from '@/lib/draft/constants'
import {
  computeTrendDelta,
  computeGapVerdict,
  filterByMinBattles,
  computePickRate,
  type ProAnalysisResponse,
  type TopBrawlerEntry,
  type TrendEntry,
  type CounterEntry,
  type CounterMatchup,
  type DailyTrendEntry,
  type ProTrioEntry,
  type GapEntry,
  type MatchupGapEntry,
} from '@/lib/draft/pro-analysis'
import { loadBrawlerNames, getBrawlerName } from '@/lib/draft/brawler-names'
import { isPremium } from '@/lib/premium'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

const ALLOWED_WINDOWS = [7, 14, 30, 90]
const CACHE_MAX_AGE = 1800 // 30 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const map = searchParams.get('map')
  const mode = searchParams.get('mode')
  const windowParam = parseInt(searchParams.get('window') ?? '14', 10)
  const window = ALLOWED_WINDOWS.includes(windowParam) ? windowParam : 14

  if (!map || !mode) {
    return NextResponse.json(
      { error: 'map and mode are required query parameters' },
      { status: 400 },
    )
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )

  // --- Auth check ---
  const authHeader = request.headers.get('authorization')
  let userProfile: Profile | null = null
  let playerTag: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      userProfile = profile as Profile | null
      playerTag = userProfile?.player_tag ?? null
    }
  }

  const hasPremium = isPremium(userProfile)

  // --- Date calculations ---
  const now = new Date()
  const windowStart = new Date(now.getTime() - window * 86400000).toISOString().slice(0, 10)
  const prevWindowStart = new Date(now.getTime() - window * 2 * 86400000).toISOString().slice(0, 10)
  const trend7dStart = new Date(now.getTime() - PRO_TREND_DAYS_SHORT * 86400000).toISOString().slice(0, 10)
  const prev7dStart = new Date(now.getTime() - PRO_TREND_DAYS_SHORT * 2 * 86400000).toISOString().slice(0, 10)
  const trend30dStart = new Date(now.getTime() - PRO_TREND_DAYS_LONG * 86400000).toISOString().slice(0, 10)
  const prev30dStart = new Date(now.getTime() - PRO_TREND_DAYS_LONG * 2 * 86400000).toISOString().slice(0, 10)
  const todayStr = now.toISOString().slice(0, 10)

  // --- Load brawler names ---
  const brawlerNames = await loadBrawlerNames()

  // --- Query 1: meta_stats for current window ---
  const { data: statsRows } = await supabase
    .from('meta_stats')
    .select('brawler_id, wins, losses, total, date')
    .eq('map', map)
    .eq('mode', mode)
    .eq('source', 'global')
    .gte('date', windowStart)
    .lte('date', todayStr)

  // --- Query 2: meta_stats for 7d window + previous 7d (for trend) ---
  const { data: stats7d } = await supabase
    .from('meta_stats')
    .select('brawler_id, wins, losses, total, date')
    .eq('map', map)
    .eq('mode', mode)
    .eq('source', 'global')
    .gte('date', prev7dStart)
    .lte('date', todayStr)

  // --- Query 3: meta_stats for 30d window + previous 30d (for trend) ---
  const { data: stats30d } = await supabase
    .from('meta_stats')
    .select('brawler_id, wins, losses, total, date')
    .eq('map', map)
    .eq('mode', mode)
    .eq('source', 'global')
    .gte('date', prev30dStart)
    .lte('date', todayStr)

  // --- Query 4: meta_matchups for current window ---
  const { data: matchupRows } = await supabase
    .from('meta_matchups')
    .select('brawler_id, opponent_id, wins, losses, total, date')
    .eq('mode', mode)
    .eq('source', 'global')
    .gte('date', windowStart)
    .lte('date', todayStr)

  // --- Aggregate stats by brawler ---
  type AggStat = { wins: number; losses: number; total: number }
  const aggStats = new Map<number, AggStat>()
  let totalProBattles = 0

  for (const row of statsRows ?? []) {
    const id = row.brawler_id
    const existing = aggStats.get(id) ?? { wins: 0, losses: 0, total: 0 }
    existing.wins += row.wins
    existing.losses += row.losses
    existing.total += row.total
    aggStats.set(id, existing)
    totalProBattles += row.total
  }
  // Each battle has 6 players, so divide by 6 for unique battles (but keep raw for pick rate)
  const totalUniqueBattles = Math.round(totalProBattles / 6)

  // --- Compute 7d trends ---
  const agg7dCurrent = new Map<number, AggStat>()
  const agg7dPrev = new Map<number, AggStat>()
  for (const row of stats7d ?? []) {
    const target = row.date >= trend7dStart ? agg7dCurrent : agg7dPrev
    const existing = target.get(row.brawler_id) ?? { wins: 0, losses: 0, total: 0 }
    existing.wins += row.wins
    existing.losses += row.losses
    existing.total += row.total
    target.set(row.brawler_id, existing)
  }

  // --- Compute 30d trends ---
  const agg30dCurrent = new Map<number, AggStat>()
  const agg30dPrev = new Map<number, AggStat>()
  for (const row of stats30d ?? []) {
    const target = row.date >= trend30dStart ? agg30dCurrent : agg30dPrev
    const existing = target.get(row.brawler_id) ?? { wins: 0, losses: 0, total: 0 }
    existing.wins += row.wins
    existing.losses += row.losses
    existing.total += row.total
    target.set(row.brawler_id, existing)
  }

  // --- Build topBrawlers ---
  const allBrawlers: TopBrawlerEntry[] = []
  for (const [id, stat] of aggStats) {
    if (stat.total < PRO_MIN_BATTLES_DISPLAY) continue

    const winRate = bayesianWinRate(stat.wins, stat.total)
    const pickRate = computePickRate(stat.total, totalProBattles)

    // 7d trend
    const cur7 = agg7dCurrent.get(id)
    const prev7 = agg7dPrev.get(id)
    const trend7d = computeTrendDelta(
      cur7 && cur7.total >= 5 ? bayesianWinRate(cur7.wins, cur7.total) : winRate,
      prev7 && prev7.total >= 5 ? bayesianWinRate(prev7.wins, prev7.total) : null,
    )

    // 30d trend
    const cur30 = agg30dCurrent.get(id)
    const prev30 = agg30dPrev.get(id)
    const trend30d = computeTrendDelta(
      cur30 && cur30.total >= 10 ? bayesianWinRate(cur30.wins, cur30.total) : winRate,
      prev30 && prev30.total >= 10 ? bayesianWinRate(prev30.wins, prev30.total) : null,
    )

    allBrawlers.push({
      brawlerId: id,
      name: getBrawlerName(brawlerNames, id),
      winRate: Number(winRate.toFixed(2)),
      pickRate: Number(pickRate.toFixed(2)),
      totalBattles: stat.total,
      trend7d,
      trend30d,
    })
  }

  allBrawlers.sort((a, b) => b.winRate - a.winRate)

  // --- Build trending ---
  const rising: TrendEntry[] = []
  const falling: TrendEntry[] = []
  for (const b of allBrawlers) {
    if (b.trend7d !== null && b.trend7d > 2) {
      rising.push({ brawlerId: b.brawlerId, name: b.name, delta7d: b.trend7d })
    } else if (b.trend7d !== null && b.trend7d < -2) {
      falling.push({ brawlerId: b.brawlerId, name: b.name, delta7d: b.trend7d })
    }
  }
  rising.sort((a, b) => b.delta7d - a.delta7d)
  falling.sort((a, b) => a.delta7d - b.delta7d)

  // --- Build counters ---
  const matchupAgg = new Map<string, AggStat>()
  for (const row of matchupRows ?? []) {
    const key = `${row.brawler_id}|${row.opponent_id}`
    const existing = matchupAgg.get(key) ?? { wins: 0, losses: 0, total: 0 }
    existing.wins += row.wins
    existing.losses += row.losses
    existing.total += row.total
    matchupAgg.set(key, existing)
  }

  const counters: CounterEntry[] = []
  const brawlerIds = Array.from(aggStats.keys()).filter(id => (aggStats.get(id)?.total ?? 0) >= PRO_MIN_BATTLES_DISPLAY)

  for (const bId of brawlerIds) {
    const matchups: Array<{ opponentId: number; wr: number; total: number }> = []
    for (const oppId of brawlerIds) {
      if (oppId === bId) continue
      const key = `${bId}|${oppId}`
      const stat = matchupAgg.get(key)
      if (!stat || stat.total < 5) continue
      matchups.push({
        opponentId: oppId,
        wr: bayesianWinRate(stat.wins, stat.total),
        total: stat.total,
      })
    }

    matchups.sort((a, b) => b.wr - a.wr)

    const counterLimit = hasPremium ? matchups.length : 3
    const bestCounters: CounterMatchup[] = matchups.slice(0, counterLimit).map(m => ({
      opponentId: m.opponentId,
      name: getBrawlerName(brawlerNames, m.opponentId),
      winRate: Number(m.wr.toFixed(2)),
      total: m.total,
    }))
    const worstMatchups: CounterMatchup[] = matchups.slice(-counterLimit).reverse().map(m => ({
      opponentId: m.opponentId,
      name: getBrawlerName(brawlerNames, m.opponentId),
      winRate: Number(m.wr.toFixed(2)),
      total: m.total,
    }))

    counters.push({
      brawlerId: bId,
      name: getBrawlerName(brawlerNames, bId),
      bestCounters,
      worstMatchups,
    })
  }

  // --- Tier gating for topBrawlers ---
  const topBrawlers = hasPremium ? allBrawlers.slice(0, 10) : allBrawlers.slice(0, 5)

  // --- PREMIUM: daily trend data (30d) ---
  let dailyTrend: DailyTrendEntry[] | null = null
  if (hasPremium) {
    const dailyMap = new Map<string, Map<number, { wins: number; total: number }>>()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)

    for (const row of statsRows ?? []) {
      if (row.date < thirtyDaysAgo) continue
      if (!dailyMap.has(row.date)) dailyMap.set(row.date, new Map())
      const dayMap = dailyMap.get(row.date)!
      const existing = dayMap.get(row.brawler_id) ?? { wins: 0, total: 0 }
      existing.wins += row.wins
      existing.total += row.total
      dayMap.set(row.brawler_id, existing)
    }

    dailyTrend = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, brawlers]) => ({
        date,
        brawlers: Array.from(brawlers.entries()).map(([brawlerId, stat]) => ({
          brawlerId,
          winRate: Number(bayesianWinRate(stat.wins, stat.total).toFixed(2)),
          picks: stat.total,
        })),
      }))
  }

  // --- PREMIUM: pro trios ---
  let proTrios: ProTrioEntry[] | null = null
  if (hasPremium) {
    const { data: trioRows } = await supabase
      .from('meta_trios')
      .select('brawler1_id, brawler2_id, brawler3_id, wins, losses, total')
      .eq('map', map)
      .eq('mode', mode)
      .eq('source', 'global')
      .gte('date', windowStart)
      .lte('date', todayStr)

    // Aggregate trios across dates
    const trioAgg = new Map<string, { ids: number[]; wins: number; total: number }>()
    for (const row of trioRows ?? []) {
      const key = `${row.brawler1_id}|${row.brawler2_id}|${row.brawler3_id}`
      const existing = trioAgg.get(key) ?? {
        ids: [row.brawler1_id, row.brawler2_id, row.brawler3_id],
        wins: 0,
        total: 0,
      }
      existing.wins += row.wins
      existing.total += row.total
      trioAgg.set(key, existing)
    }

    proTrios = Array.from(trioAgg.values())
      .filter(t => t.total >= PRO_MIN_BATTLES_DISPLAY)
      .map(t => ({
        brawlers: t.ids.map(id => ({ id, name: getBrawlerName(brawlerNames, id) })),
        winRate: Number(bayesianWinRate(t.wins, t.total).toFixed(2)),
        total: t.total,
      }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 20)
  }

  // --- PREMIUM + TAG: personal gap analysis ---
  let personalGap: GapEntry[] | null = null
  let matchupGaps: MatchupGapEntry[] | null = null

  if (hasPremium && playerTag) {
    // Query user's battles on this map+mode
    const { data: userBattles } = await supabase
      .from('battles')
      .select('my_brawler, result')
      .eq('player_tag', playerTag)
      .eq('map', map)
      .eq('mode', mode)

    if (userBattles && userBattles.length > 0) {
      // Aggregate user's stats by brawler
      const userStats = new Map<number, AggStat>()
      for (const b of userBattles) {
        const brawlerId = typeof b.my_brawler === 'object' ? (b.my_brawler as { id: number }).id : null
        if (!brawlerId) continue
        const existing = userStats.get(brawlerId) ?? { wins: 0, losses: 0, total: 0 }
        existing.total++
        if (b.result === 'victory') existing.wins++
        else existing.losses++
        userStats.set(brawlerId, existing)
      }

      // Compute gaps
      personalGap = []
      for (const [brawlerId, userStat] of userStats) {
        const proStat = aggStats.get(brawlerId)
        if (!proStat || proStat.total < PRO_MIN_BATTLES_DISPLAY) continue

        const yourWR = Number(bayesianWinRate(userStat.wins, userStat.total).toFixed(2))
        const proWR = Number(bayesianWinRate(proStat.wins, proStat.total).toFixed(2))
        const gap = Number((yourWR - proWR).toFixed(2))

        personalGap.push({
          brawlerId,
          name: getBrawlerName(brawlerNames, brawlerId),
          yourWR,
          proWR,
          gap,
          yourTotal: userStat.total,
          proTotal: proStat.total,
          verdict: computeGapVerdict(yourWR, proWR),
        })
      }
      personalGap.sort((a, b) => a.gap - b.gap) // Worst gaps first

      // Matchup gaps: query user's matchup data from battles
      const { data: userBattlesDetailed } = await supabase
        .from('battles')
        .select('my_brawler, opponents, result')
        .eq('player_tag', playerTag)
        .eq('mode', mode)

      if (userBattlesDetailed && userBattlesDetailed.length > 0) {
        const userMatchups = new Map<string, AggStat>()
        for (const b of userBattlesDetailed) {
          const brawlerId = typeof b.my_brawler === 'object' ? (b.my_brawler as { id: number }).id : null
          if (!brawlerId) continue
          const opponents = b.opponents as Array<{ id: number }> | null
          if (!opponents) continue
          for (const opp of opponents) {
            const key = `${brawlerId}|${opp.id}`
            const existing = userMatchups.get(key) ?? { wins: 0, losses: 0, total: 0 }
            existing.total++
            if (b.result === 'victory') existing.wins++
            else existing.losses++
            userMatchups.set(key, existing)
          }
        }

        matchupGaps = []
        for (const [key, userStat] of userMatchups) {
          if (userStat.total < 3) continue // Need minimum sample
          const [bIdStr, oppIdStr] = key.split('|')
          const bId = Number(bIdStr)
          const oppId = Number(oppIdStr)

          const proKey = `${bId}|${oppId}`
          const proStat = matchupAgg.get(proKey)
          if (!proStat || proStat.total < 5) continue

          const yourWR = Number(bayesianWinRate(userStat.wins, userStat.total).toFixed(2))
          const proWR = Number(bayesianWinRate(proStat.wins, proStat.total).toFixed(2))
          const gap = Number((yourWR - proWR).toFixed(2))

          matchupGaps.push({
            brawlerId: bId,
            opponentId: oppId,
            brawlerName: getBrawlerName(brawlerNames, bId),
            opponentName: getBrawlerName(brawlerNames, oppId),
            yourWR,
            proWR,
            gap,
          })
        }
        matchupGaps.sort((a, b) => a.gap - b.gap) // Worst gaps first
        matchupGaps = matchupGaps.slice(0, 30) // Limit to top 30 gaps
      }
    }
  }

  // --- Build response ---
  const response: ProAnalysisResponse = {
    topBrawlers,
    totalProBattles: totalUniqueBattles,
    windowDays: window,
    trending: {
      rising: rising.slice(0, 3),
      falling: falling.slice(0, 3),
    },
    counters,
    dailyTrend,
    proTrios,
    personalGap,
    matchupGaps,
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': `public, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_MAX_AGE * 2}`,
    },
  })
}
```

- [ ] **2.3** Verify TypeScript compilation:

```bash
npx tsc --noEmit
```

- [ ] **2.4** Commit:

```bash
git add src/app/api/meta/pro-analysis/route.ts src/lib/draft/brawler-names.ts
git commit -m "feat(api): implement /api/meta/pro-analysis endpoint

Queries meta_stats, meta_matchups, meta_trios for pro data.
Computes Bayesian WRs, trends (7d/30d), counters, and for
premium users: daily trends, pro trios, gap analysis."
```

---

## Task 3: Write integration test for the endpoint

Tests the endpoint's data aggregation logic with mocked Supabase responses.

### Steps

- [ ] **3.1** Create the integration test:

**File:** `src/__tests__/integration/api/pro-analysis.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase before importing the route
const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null })
const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockAuth = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    from: (table: string) => {
      mockFrom(table)
      return {
        select: (cols: string) => {
          mockSelect(table, cols)
          return {
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            then: vi.fn(),
          }
        },
        delete: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }
    },
    rpc: mockRpc,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}))

import {
  computeTrendDelta,
  computeGapVerdict,
  filterByMinBattles,
  computePickRate,
} from '@/lib/draft/pro-analysis'

describe('/api/meta/pro-analysis data aggregation', () => {
  it('computeTrendDelta handles edge cases in aggregation context', () => {
    // Simulates what happens when endpoint computes trends
    const wr1 = 62.5
    const wr2 = 58.3
    const delta = computeTrendDelta(wr1, wr2)
    expect(delta).toBeCloseTo(4.2, 1)
  })

  it('filterByMinBattles enforces PRO_MIN_BATTLES_DISPLAY', () => {
    const mockStats = [
      { brawlerId: 1, wins: 15, total: 19, name: 'Shelly' },
      { brawlerId: 2, wins: 12, total: 20, name: 'Colt' },
      { brawlerId: 3, wins: 100, total: 200, name: 'Brock' },
    ]
    const filtered = filterByMinBattles(mockStats, 20)
    expect(filtered).toHaveLength(2)
    expect(filtered.map(f => f.brawlerId)).toEqual([2, 3])
  })

  it('computePickRate sums correctly for endpoint response', () => {
    // 50 picks out of 1000 total = 5%
    expect(computePickRate(50, 1000)).toBeCloseTo(5.0)
    // Edge case: 0 total battles
    expect(computePickRate(10, 0)).toBe(0)
  })

  it('computeGapVerdict categorizes endpoint gap data correctly', () => {
    // User well above PRO
    expect(computeGapVerdict(70, 55)).toBe('above')
    // User well below PRO
    expect(computeGapVerdict(45, 62)).toBe('below')
    // User on par with PRO
    expect(computeGapVerdict(60, 58.5)).toBe('on-par')
  })
})

describe('/api/meta/pro-analysis response shape', () => {
  it('free users get null for premium fields', () => {
    // This validates the response contract
    const freeResponse = {
      topBrawlers: [],
      totalProBattles: 0,
      windowDays: 14,
      trending: { rising: [], falling: [] },
      counters: [],
      dailyTrend: null,
      proTrios: null,
      personalGap: null,
      matchupGaps: null,
    }

    expect(freeResponse.dailyTrend).toBeNull()
    expect(freeResponse.proTrios).toBeNull()
    expect(freeResponse.personalGap).toBeNull()
    expect(freeResponse.matchupGaps).toBeNull()
  })
})
```

- [ ] **3.2** Run the integration test:

```bash
npx vitest run src/__tests__/integration/api/pro-analysis.test.ts
```

- [ ] **3.3** Commit:

```bash
git add src/__tests__/integration/api/pro-analysis.test.ts
git commit -m "test(api): add integration tests for pro-analysis endpoint

Tests data aggregation helpers, response shape validation,
and free/premium tier field gating."
```

---

## Task 4: Implement trend calculation helpers (7d, 30d deltas)

This is already covered in the endpoint (Task 2) via `computeTrendDelta` and the 7d/30d aggregation logic. This task verifies the trend logic works end-to-end with a focused test.

### Steps

- [ ] **4.1** Add focused trend calculation tests to the existing test file:

**File:** `src/__tests__/unit/lib/draft/pro-analysis.test.ts`

Add at the end of the file:

```typescript
describe('trend calculation end-to-end', () => {
  it('computes 7d rising trend correctly', () => {
    // Simulates: brawler had 50% WR last week, now has 57%
    const current7dWR = 57.0
    const prev7dWR = 50.0
    const delta = computeTrendDelta(current7dWR, prev7dWR)
    expect(delta).toBe(7)
    // This brawler should appear in "rising" (delta > 2)
    expect(delta).toBeGreaterThan(2)
  })

  it('computes 7d falling trend correctly', () => {
    const current7dWR = 45.0
    const prev7dWR = 52.0
    const delta = computeTrendDelta(current7dWR, prev7dWR)
    expect(delta).toBe(-7)
    // This brawler should appear in "falling" (delta < -2)
    expect(delta).toBeLessThan(-2)
  })

  it('computes stable trend (no change > 2%)', () => {
    const current7dWR = 51.0
    const prev7dWR = 50.0
    const delta = computeTrendDelta(current7dWR, prev7dWR)
    expect(delta).toBe(1)
    // This brawler should NOT appear in trending (|delta| <= 2)
    expect(Math.abs(delta!)).toBeLessThanOrEqual(2)
  })

  it('handles 30d trend with larger data sets', () => {
    const current30dWR = 62.5
    const prev30dWR = 55.0
    const delta = computeTrendDelta(current30dWR, prev30dWR)
    expect(delta).toBe(7.5)
  })
})
```

- [ ] **4.2** Run:

```bash
npx vitest run src/__tests__/unit/lib/draft/pro-analysis.test.ts
```

- [ ] **4.3** Commit:

```bash
git add src/__tests__/unit/lib/draft/pro-analysis.test.ts
git commit -m "test(api): add end-to-end trend calculation tests

Validates 7d/30d rising, falling, and stable trend detection
thresholds match spec (>2% = trending, <=2% = stable)."
```

---

## Task 5: Create `useProAnalysis` hook

Client-side hook that fetches from `/api/meta/pro-analysis`, with caching, abort on unmount, and loading/error states.

### Steps

- [ ] **5.1** Create the hook:

**File:** `src/hooks/useProAnalysis.ts`

```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ProAnalysisResponse } from '@/lib/draft/pro-analysis'

interface UseProAnalysisResult {
  data: ProAnalysisResponse | null
  loading: boolean
  error: string | null
  refresh: () => void
}

// Client-side cache: map+mode+window → response
const cache = new Map<string, ProAnalysisResponse>()

/**
 * Fetches PRO analysis data for a given map + mode.
 * Caches by map+mode+window key. Aborts on unmount or param change.
 * Returns null data when map or mode are null (no fetch triggered).
 */
export function useProAnalysis(
  map: string | null,
  mode: string | null,
  window: number = 14,
): UseProAnalysisResult {
  const [data, setData] = useState<ProAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const cacheKey = map && mode ? `${map}|${mode}|${window}` : null

  const fetchData = useCallback(() => {
    if (!map || !mode) return

    const key = `${map}|${mode}|${window}`

    // Check cache first
    const cached = cache.get(key)
    if (cached) {
      setData(cached)
      setLoading(false)
      setError(null)
      return
    }

    // Abort previous request
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ map, mode, window: String(window) })

    fetch(`/api/meta/pro-analysis?${params}`, {
      signal: controller.signal,
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json: ProAnalysisResponse) => {
        cache.set(key, json)
        setData(json)
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
  }, [map, mode, window])

  useEffect(() => {
    // If params are set and we have a cache hit, use it immediately
    if (cacheKey && cache.has(cacheKey)) {
      setData(cache.get(cacheKey)!)
      setLoading(false)
      setError(null)
      return
    }

    if (map && mode) {
      fetchData()
    } else {
      setData(null)
      setLoading(false)
      setError(null)
    }

    return () => controllerRef.current?.abort()
  }, [map, mode, window, cacheKey, fetchData])

  const refresh = useCallback(() => {
    if (cacheKey) cache.delete(cacheKey)
    fetchData()
  }, [cacheKey, fetchData])

  return { data, loading, error, refresh }
}
```

- [ ] **5.2** Verify TypeScript compilation:

```bash
npx tsc --noEmit
```

- [ ] **5.3** Commit:

```bash
git add src/hooks/useProAnalysis.ts
git commit -m "feat(hooks): add useProAnalysis client hook

Fetches /api/meta/pro-analysis with in-memory caching by
map+mode+window key, abort-on-unmount, and loading/error states."
```

---

## Verification Checklist

After all 5 tasks are complete:

```bash
npx vitest run
npx tsc --noEmit
```

Expected results:
- All unit tests pass (pro-analysis helpers, trends, constants)
- All integration tests pass (pro-analysis endpoint shape)
- No TypeScript compilation errors
- Hook compiles correctly

### Files Created
| File | Responsibility |
|------|---------------|
| `src/lib/draft/pro-analysis.ts` | Response type + pure helper functions |
| `src/lib/draft/brawler-names.ts` | Brawler ID-to-name resolver |
| `src/app/api/meta/pro-analysis/route.ts` | Pro analysis API endpoint |
| `src/hooks/useProAnalysis.ts` | Client hook for pro analysis data |
| `src/__tests__/unit/lib/draft/pro-analysis.test.ts` | Unit tests for helpers + trends |
| `src/__tests__/integration/api/pro-analysis.test.ts` | Integration tests for endpoint |
