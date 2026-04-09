# Brawler Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a per-brawler detail page at `/brawlers/[brawlerId]` showing public meta intelligence + premium personal analytics with blur gating.

**Architecture:** Client page under existing DashboardLayoutClient. New API endpoint `/api/meta/brawler-detail` queries Supabase `meta_stats`/`meta_matchups`. Personal data from existing `useAdvancedAnalytics` filtered client-side. BlurredTeaser for premium gating.

**Tech Stack:** Next.js 16 (App Router, client components), next-intl, Supabase, Tailwind CSS, framer-motion, Vitest

**Spec:** `docs/superpowers/specs/2026-04-09-brawler-detail-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/constants.ts` | Modify | Extract shared `RARITY_COLORS` |
| `src/lib/brawler-detail/types.ts` | Create | `BrawlerMetaResponse` interface + recommendation types |
| `src/lib/brawler-detail/compute.ts` | Create | Pure functions: recommendations, calendar bucketing, meta aggregation |
| `src/app/api/meta/brawler-detail/route.ts` | Create | GET endpoint returning meta data for one brawler |
| `src/hooks/useBrawlerMeta.ts` | Create | Hook fetching + caching brawler meta |
| `src/components/brawler-detail/HeroBanner.tsx` | Create | Rarity gradient hero with brawler portrait + player stats |
| `src/components/brawler-detail/MetaIntelligence.tsx` | Create | Public meta cards, maps, counters, teammates |
| `src/components/brawler-detail/PersonalAnalysis.tsx` | Create | Premium section: comparison, maps, matchups |
| `src/components/brawler-detail/MasteryTimeline.tsx` | Create | Line chart of WR progression over time |
| `src/components/brawler-detail/ActivityCalendar.tsx` | Create | GitHub-style 90-day usage grid |
| `src/components/brawler-detail/BrawlerRecommendations.tsx` | Create | Actionable tips from data gaps |
| `src/app/[locale]/profile/[tag]/brawlers/[brawlerId]/page.tsx` | Create | Main page orchestrator |
| `src/components/layout/Sidebar.tsx` | Modify | `isActive` prefix match for sub-routes |
| `src/app/[locale]/profile/[tag]/brawlers/page.tsx` | Modify | Make cards clickable `<Link>` |
| `messages/es.json` (+ 12 locales) | Modify | Add `brawlerDetail` namespace |
| `src/__tests__/unit/lib/brawler-detail.test.ts` | Create | Unit tests for pure functions |
| `src/__tests__/integration/api/brawler-detail.test.ts` | Create | API route tests |

---

### Task 1: Extract shared RARITY_COLORS constant

**Why first:** Both brawlers page and BrawlerParade define RARITY_COLORS with DIFFERENT values. The detail page needs one canonical source. Fix this before building on it.

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/app/[locale]/profile/[tag]/brawlers/page.tsx` (lines 16-25)
- Modify: `src/components/landing/BrawlerParade.tsx` (lines 9-18)

- [ ] **Step 1: Read existing RARITY_COLORS from both files**

Brawlers page uses hex colors: `#95A5A6`, `#27AE60`, `#3498DB`, `#8E44AD`, `#E74C3C`, `#F39C12`, `#E91E63`, `#FFD700`

BrawlerParade uses Tailwind-style: `#9CA3AF`, `#4ADE80`, `#3B82F6`, `#A855F7`, `#EF4444`, `#FFC91B`, `#E879F9`, `#FF6B35`

Use the brawlers page values (they came first and are the canonical set). Ultra Legendary use `#FFD700`.

- [ ] **Step 2: Add to constants.ts**

Add at the end of `src/lib/constants.ts`:

```typescript
import type { BrawlerRarityName } from './types'

export const RARITY_COLORS: Record<BrawlerRarityName, string> = {
  'Trophy Road': '#95A5A6',
  'Rare': '#27AE60',
  'Super Rare': '#3498DB',
  'Epic': '#8E44AD',
  'Mythic': '#E74C3C',
  'Legendary': '#F39C12',
  'Chromatic': '#E91E63',
  'Ultra Legendary': '#FFD700',
}
```

Check that `BrawlerRarityName` type exists in `src/lib/types.ts`. If not, check the brawlers page for its definition and export it from types.ts.

- [ ] **Step 3: Update brawlers/page.tsx**

Remove lines 16-25 (local `RARITY_COLORS`). Add import:

```typescript
import { RARITY_COLORS } from '@/lib/constants'
```

- [ ] **Step 4: Update BrawlerParade.tsx**

Remove lines 9-18 (local `RARITY_COLORS`). Add import:

```typescript
import { RARITY_COLORS } from '@/lib/constants'
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Verify pages render**

Open `http://localhost:3000/es/profile/%23YJU282PV/brawlers` — brawler cards should show colored rarity headers.
Open `http://localhost:3000/es` — landing BrawlerParade should render with colored borders.

- [ ] **Step 7: Commit**

```bash
git add src/lib/constants.ts src/lib/types.ts src/app/\[locale\]/profile/\[tag\]/brawlers/page.tsx src/components/landing/BrawlerParade.tsx
git commit -m "refactor: extract RARITY_COLORS to shared constant"
```

---

### Task 2: Types + pure computation functions (TDD)

**Files:**
- Create: `src/lib/brawler-detail/types.ts`
- Create: `src/lib/brawler-detail/compute.ts`
- Create: `src/__tests__/unit/lib/brawler-detail.test.ts`

- [ ] **Step 1: Create types file**

Create `src/lib/brawler-detail/types.ts`:

```typescript
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

export interface MapStat {
  map: string
  mode: string
  eventId: number | null
  winRate: number
  totalBattles: number
}

export interface MatchupStat {
  opponentId: number
  opponentName: string
  winRate: number
  totalBattles: number
}

export interface TeammateStat {
  teammateId: number
  teammateName: string
  winRate: number
  totalBattles: number
}

export interface Recommendation {
  type: 'play' | 'avoid' | 'team'
  brawlerName: string
  context: string  // map name or opponent name or teammate name
  yourWR: number
  metaWR: number
  diff: number
}

export interface CalendarDay {
  date: string  // YYYY-MM-DD
  games: number
  wins: number
}
```

- [ ] **Step 2: Write failing tests for recommendation logic**

Create `src/__tests__/unit/lib/brawler-detail.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateRecommendations, bucketBattlesToCalendar } from '@/lib/brawler-detail/compute'
import type { Recommendation, CalendarDay } from '@/lib/brawler-detail/types'

describe('generateRecommendations', () => {
  it('returns "play" recommendation when personal WR exceeds meta WR on a map', () => {
    const personalMaps = [
      { map: 'Pinhole Punt', mode: 'brawlBall', winRate: 75, total: 10 },
    ]
    const metaMaps = [
      { map: 'Pinhole Punt', mode: 'brawlBall', winRate: 55, totalBattles: 200 },
    ]
    const result = generateRecommendations('Shelly', personalMaps, metaMaps, [], [], 'es')
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].type).toBe('play')
    expect(result[0].diff).toBe(20)
  })

  it('returns "avoid" recommendation when personal matchup WR is below meta', () => {
    const personalMatchups = [
      { opponentId: 16000001, opponentName: 'Colt', winRate: 25, total: 8 },
    ]
    const metaMatchups = [
      { opponentId: 16000001, opponentName: 'Colt', winRate: 52, totalBattles: 300 },
    ]
    const result = generateRecommendations('Shelly', [], [], personalMatchups, metaMatchups, 'es')
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].type).toBe('avoid')
    expect(result[0].diff).toBe(-27)
  })

  it('returns empty array when no significant gaps exist', () => {
    const personalMaps = [
      { map: 'Pinhole Punt', mode: 'brawlBall', winRate: 55, total: 10 },
    ]
    const metaMaps = [
      { map: 'Pinhole Punt', mode: 'brawlBall', winRate: 54, totalBattles: 200 },
    ]
    const result = generateRecommendations('Shelly', personalMaps, metaMaps, [], [], 'es')
    expect(result).toHaveLength(0)
  })

  it('caps recommendations at 5', () => {
    const personalMaps = Array.from({ length: 10 }, (_, i) => ({
      map: `Map${i}`, mode: 'brawlBall', winRate: 80, total: 10,
    }))
    const metaMaps = Array.from({ length: 10 }, (_, i) => ({
      map: `Map${i}`, mode: 'brawlBall', winRate: 40, totalBattles: 200,
    }))
    const result = generateRecommendations('Shelly', personalMaps, metaMaps, [], [], 'es')
    expect(result.length).toBeLessThanOrEqual(5)
  })
})

describe('bucketBattlesToCalendar', () => {
  it('groups battles by date and counts wins', () => {
    const battles = [
      { battle_time: '2026-04-01T10:00:00Z', result: 'victory' as const },
      { battle_time: '2026-04-01T14:00:00Z', result: 'defeat' as const },
      { battle_time: '2026-04-02T09:00:00Z', result: 'victory' as const },
    ]
    const result = bucketBattlesToCalendar(battles)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ date: '2026-04-01', games: 2, wins: 1 })
    expect(result[1]).toEqual({ date: '2026-04-02', games: 1, wins: 1 })
  })

  it('returns empty array for no battles', () => {
    expect(bucketBattlesToCalendar([])).toEqual([])
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/unit/lib/brawler-detail.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement compute.ts**

Create `src/lib/brawler-detail/compute.ts`:

```typescript
import type { Recommendation, CalendarDay, MapStat, MatchupStat } from './types'

const MIN_GAP = 10  // minimum WR difference to trigger recommendation
const MAX_RECOMMENDATIONS = 5
const MIN_PERSONAL_GAMES = 3

interface PersonalMapEntry {
  map: string
  mode: string
  winRate: number
  total: number
}

interface PersonalMatchupEntry {
  opponentId: number
  opponentName: string
  winRate: number
  total: number
}

export function generateRecommendations(
  brawlerName: string,
  personalMaps: PersonalMapEntry[],
  metaMaps: MapStat[],
  personalMatchups: PersonalMatchupEntry[],
  metaMatchups: MatchupStat[],
  _locale: string,
): Recommendation[] {
  const recs: Recommendation[] = []

  // Map recommendations: find maps where player is significantly above/below meta
  for (const pm of personalMaps) {
    if (pm.total < MIN_PERSONAL_GAMES) continue
    const meta = metaMaps.find(m => m.map === pm.map && m.mode === pm.mode)
    if (!meta) continue
    const diff = pm.winRate - meta.winRate
    if (diff >= MIN_GAP) {
      recs.push({ type: 'play', brawlerName, context: pm.map, yourWR: pm.winRate, metaWR: meta.winRate, diff })
    }
  }

  // Matchup recommendations: find opponents where player struggles vs meta
  for (const pm of personalMatchups) {
    if (pm.total < MIN_PERSONAL_GAMES) continue
    const meta = metaMatchups.find(m => m.opponentId === pm.opponentId)
    if (!meta) continue
    const diff = pm.winRate - meta.winRate
    if (diff <= -MIN_GAP) {
      recs.push({ type: 'avoid', brawlerName, context: pm.opponentName, yourWR: pm.winRate, metaWR: meta.winRate, diff })
    }
  }

  // Sort by absolute gap descending, take top N
  recs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  return recs.slice(0, MAX_RECOMMENDATIONS)
}

interface BattleForCalendar {
  battle_time: string
  result: 'victory' | 'defeat' | 'draw'
}

export function bucketBattlesToCalendar(battles: BattleForCalendar[]): CalendarDay[] {
  if (battles.length === 0) return []

  const buckets = new Map<string, { games: number; wins: number }>()

  for (const b of battles) {
    const date = b.battle_time.slice(0, 10)  // YYYY-MM-DD
    const bucket = buckets.get(date) ?? { games: 0, wins: 0 }
    bucket.games++
    if (b.result === 'victory') bucket.wins++
    buckets.set(date, bucket)
  }

  return Array.from(buckets.entries())
    .map(([date, { games, wins }]) => ({ date, games, wins }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/unit/lib/brawler-detail.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/brawler-detail/ src/__tests__/unit/lib/brawler-detail.test.ts
git commit -m "feat(brawler-detail): types + compute functions with tests"
```

---

### Task 3: API endpoint `/api/meta/brawler-detail`

**Files:**
- Create: `src/app/api/meta/brawler-detail/route.ts`
- Create: `src/__tests__/integration/api/brawler-detail.test.ts`

- [ ] **Step 1: Write integration test**

Create `src/__tests__/integration/api/brawler-detail.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockFrom = vi.fn(() => ({ select: mockSelect }))
const mockServiceSupabase = { from: mockFrom }

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => mockServiceSupabase),
}))

import { GET } from '@/app/api/meta/brawler-detail/route'

describe('GET /api/meta/brawler-detail', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 for missing brawlerId', async () => {
    const req = new Request('http://localhost:3000/api/meta/brawler-detail')
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 400 for non-numeric brawlerId', async () => {
    const req = new Request('http://localhost:3000/api/meta/brawler-detail?brawlerId=abc')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns shaped response for valid brawlerId', async () => {
    const statsData = [
      { brawler_id: 16000000, map: 'Pinhole Punt', mode: 'brawlBall', wins: 100, losses: 50, total: 150 },
      { brawler_id: 16000000, map: 'Snake Pit', mode: 'gemGrab', wins: 30, losses: 70, total: 100 },
    ]
    const matchupData = [
      { brawler_id: 16000000, opponent_id: 16000001, wins: 80, losses: 20, total: 100 },
      { brawler_id: 16000000, opponent_id: 16000002, wins: 20, losses: 80, total: 100 },
    ]
    const totalData = [{ total: 5000 }]

    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ data: statsData, error: null }),
        }),
      }),
    })
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ data: matchupData, error: null }),
        }),
      }),
    })
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ data: totalData, error: null }),
        }),
      }),
    })

    const req = new Request('http://localhost:3000/api/meta/brawler-detail?brawlerId=16000000&window=14')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.brawlerId).toBe(16000000)
    expect(body.globalStats).toBeDefined()
    expect(body.bestMaps).toBeInstanceOf(Array)
    expect(body.strongAgainst).toBeInstanceOf(Array)
    expect(body.weakAgainst).toBeInstanceOf(Array)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/integration/api/brawler-detail.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement API route**

Create `src/app/api/meta/brawler-detail/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { bayesianWinRate } from '@/lib/draft/scoring'
import { META_ROLLING_DAYS } from '@/lib/draft/constants'
import type { BrawlerMetaResponse, MapStat, MatchupStat } from '@/lib/brawler-detail/types'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const rawId = searchParams.get('brawlerId')
  const window = parseInt(searchParams.get('window') ?? '14', 10)

  if (!rawId || isNaN(parseInt(rawId, 10))) {
    return NextResponse.json({ error: 'brawlerId is required and must be numeric' }, { status: 400 })
  }

  const brawlerId = parseInt(rawId, 10)
  const rollingDays = isNaN(window) ? META_ROLLING_DAYS : window
  const cutoffDate = new Date(Date.now() - rollingDays * 86400000).toISOString().slice(0, 10)

  const supabase = createServiceClient()

  // 1. Fetch meta_stats for this brawler across all maps/modes
  const { data: rawStats } = await supabase
    .from('meta_stats')
    .select('brawler_id, map, mode, wins, losses, total')
    .eq('brawler_id', brawlerId)
    .eq('source', 'global')
    .gte('date', cutoffDate)

  // 2. Fetch meta_matchups for this brawler
  const { data: rawMatchups } = await supabase
    .from('meta_matchups')
    .select('brawler_id, opponent_id, wins, losses, total')
    .eq('brawler_id', brawlerId)
    .eq('source', 'global')
    .gte('date', cutoffDate)

  // 3. Fetch total battles for pick rate calculation
  const { data: totalRow } = await supabase
    .from('meta_stats')
    .select('total')
    .eq('source', 'global')
    .gte('date', cutoffDate)

  // Aggregate stats by map
  const mapAgg = new Map<string, { map: string; mode: string; wins: number; losses: number; total: number }>()
  let totalWins = 0
  let totalLosses = 0
  let totalGames = 0

  for (const row of rawStats ?? []) {
    const key = `${row.map}|${row.mode}`
    const existing = mapAgg.get(key) ?? { map: row.map, mode: row.mode, wins: 0, losses: 0, total: 0 }
    existing.wins += row.wins
    existing.losses += row.losses
    existing.total += row.total
    mapAgg.set(key, existing)
    totalWins += row.wins
    totalLosses += row.losses
    totalGames += row.total
  }

  // Global WR
  const globalWR = totalGames > 0 ? bayesianWinRate(totalWins, totalGames) : 50

  // Pick rate
  const allBattlesTotal = (totalRow ?? []).reduce((sum, r) => sum + (r.total ?? 0), 0)
  const pickRate = allBattlesTotal > 0 ? (totalGames / allBattlesTotal) * 100 : 0

  // Map rankings by Bayesian WR
  const mapStats: (MapStat & { _bayesian: number })[] = Array.from(mapAgg.values())
    .filter(m => m.total >= 10)
    .map(m => ({
      map: m.map,
      mode: m.mode,
      eventId: null,
      winRate: Math.round(bayesianWinRate(m.wins, m.total) * 10) / 10,
      totalBattles: m.total,
      _bayesian: bayesianWinRate(m.wins, m.total),
    }))

  mapStats.sort((a, b) => b._bayesian - a._bayesian)
  const bestMaps = mapStats.slice(0, 5).map(({ _bayesian, ...rest }) => rest)
  const worstMaps = mapStats.slice(-5).reverse().map(({ _bayesian, ...rest }) => rest)

  // Matchup aggregation
  const matchupAgg = new Map<number, { wins: number; losses: number; total: number }>()
  for (const row of rawMatchups ?? []) {
    const existing = matchupAgg.get(row.opponent_id) ?? { wins: 0, losses: 0, total: 0 }
    existing.wins += row.wins
    existing.losses += row.losses
    existing.total += row.total
    matchupAgg.set(row.opponent_id, existing)
  }

  const matchupList = Array.from(matchupAgg.entries())
    .filter(([, m]) => m.total >= 10)
    .map(([opponentId, m]) => ({
      opponentId,
      opponentName: '', // Resolved client-side via brawler-registry
      winRate: Math.round(bayesianWinRate(m.wins, m.total) * 10) / 10,
      totalBattles: m.total,
      _bayesian: bayesianWinRate(m.wins, m.total),
    }))

  matchupList.sort((a, b) => b._bayesian - a._bayesian)
  const strongAgainst: MatchupStat[] = matchupList.slice(0, 5).map(({ _bayesian, ...rest }) => rest)
  const weakAgainst: MatchupStat[] = matchupList.slice(-5).reverse().map(({ _bayesian, ...rest }) => rest)

  // TODO trend7d: requires comparing current window vs shifted window — simplified for v1
  const trend7d = 0

  const response: BrawlerMetaResponse = {
    brawlerId,
    globalStats: {
      winRate: Math.round(globalWR * 10) / 10,
      pickRate: Math.round(pickRate * 100) / 100,
      totalBattles: totalGames,
      trend7d,
    },
    bestMaps,
    worstMaps,
    strongAgainst,
    weakAgainst,
    bestTeammates: [], // v1: populated client-side from battle data
  }

  return NextResponse.json(response)
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/__tests__/integration/api/brawler-detail.test.ts`
Expected: PASS (adjust mocks if chaining differs)

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/meta/brawler-detail/ src/__tests__/integration/api/brawler-detail.test.ts
git commit -m "feat(api): brawler-detail endpoint with meta stats + matchups"
```

---

### Task 4: useBrawlerMeta hook

**Files:**
- Create: `src/hooks/useBrawlerMeta.ts`

- [ ] **Step 1: Create hook**

Create `src/hooks/useBrawlerMeta.ts`:

```typescript
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { BrawlerMetaResponse } from '@/lib/brawler-detail/types'

const CACHE_PREFIX = 'brawlvalue:brawler-meta:'
const CACHE_TTL = 10 * 60 * 1000  // 10 minutes

interface UseBrawlerMetaResult {
  data: BrawlerMetaResponse | null
  isLoading: boolean
  error: string | null
}

export function useBrawlerMeta(brawlerId: number, window = 14): UseBrawlerMetaResult {
  const [data, setData] = useState<BrawlerMetaResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const fetch_ = useCallback(async () => {
    if (!brawlerId || isNaN(brawlerId)) {
      setIsLoading(false)
      setError('Invalid brawler ID')
      return
    }

    const cacheKey = `${CACHE_PREFIX}${brawlerId}:${window}`

    // Check cache
    try {
      const raw = localStorage.getItem(cacheKey)
      if (raw) {
        const { data: cached, ts } = JSON.parse(raw)
        if (Date.now() - ts < CACHE_TTL) {
          setData(cached)
          setIsLoading(false)
          return
        }
      }
    } catch { /* ignore */ }

    // Fetch
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const res = await globalThis.fetch(
        `/api/meta/brawler-detail?brawlerId=${brawlerId}&window=${window}`,
        { signal: controller.signal },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const json: BrawlerMetaResponse = await res.json()
      setData(json)

      // Cache
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ data: json, ts: Date.now() }))
      } catch { /* ignore */ }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message)
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [brawlerId, window])

  useEffect(() => {
    fetch_()
    return () => { controllerRef.current?.abort() }
  }, [fetch_])

  return { data, isLoading, error }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useBrawlerMeta.ts
git commit -m "feat(hooks): useBrawlerMeta with localStorage cache + abort"
```

---

### Task 5: Translations (es.json + 12 locales)

**Files:**
- Modify: `messages/es.json` (+ 12 other locale files)

- [ ] **Step 1: Add brawlerDetail namespace to es.json**

Open `messages/es.json` and add the `brawlerDetail` namespace at the appropriate alphabetical position (after `battles` or similar). Use the exact keys from the spec section 6.

- [ ] **Step 2: Add to remaining 12 locales**

For all other locale files (`en.json`, `fr.json`, `pt.json`, `de.json`, `it.json`, `ru.json`, `tr.json`, `pl.json`, `ar.json`, `ko.json`, `ja.json`, `zh.json`), add the same `brawlerDetail` namespace. For v1, use the English translations as placeholder — they can be translated later.

Consider using the existing `scripts/update-i18n-translations.js` if it handles this.

- [ ] **Step 3: Verify app loads without i18n errors**

Run: `npx tsc --noEmit`
Open any page — should have no console errors about missing translation keys.

- [ ] **Step 4: Commit**

```bash
git add messages/
git commit -m "feat(i18n): add brawlerDetail namespace to all 13 locales"
```

---

### Task 6: HeroBanner component

**Files:**
- Create: `src/components/brawler-detail/HeroBanner.tsx`

- [ ] **Step 1: Create component**

Create `src/components/brawler-detail/HeroBanner.tsx`:

```typescript
'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { RARITY_COLORS } from '@/lib/constants'
import type { BrawlerStat, BrawlerRarityName } from '@/lib/types'
import type { BrawlerEntry } from '@/lib/brawler-registry'

interface Props {
  brawlerId: number
  brawlerInfo: BrawlerEntry | null
  playerBrawler: BrawlerStat | null  // null if player doesn't own
}

export function HeroBanner({ brawlerId, brawlerInfo, playerBrawler }: Props) {
  const t = useTranslations('brawlerDetail')
  const params = useParams<{ tag: string; locale: string }>()
  const basePath = `/${params.locale}/profile/${encodeURIComponent(params.tag)}`

  const rarity = (brawlerInfo?.rarity ?? 'Trophy Road') as BrawlerRarityName
  const rarityColor = RARITY_COLORS[rarity] ?? '#95A5A6'
  const name = brawlerInfo?.name ?? playerBrawler?.name ?? `#${brawlerId}`
  const className_ = brawlerInfo?.class ?? ''

  return (
    <div
      className="brawl-card p-5 md:p-8 relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${rarityColor}20 0%, transparent 60%)` }}
    >
      {/* Back button */}
      <Link
        href={`${basePath}/brawlers`}
        className="text-sm text-slate-400 hover:text-white transition-colors font-['Lilita_One'] mb-4 inline-block"
      >
        {t('backToBrawlers')}
      </Link>

      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Portrait */}
        <div className="shrink-0">
          <div
            className="w-[120px] h-[120px] md:w-[160px] md:h-[160px] rounded-2xl border-4 overflow-hidden"
            style={{ borderColor: rarityColor }}
          >
            <BrawlImg
              src={getBrawlerPortraitUrl(brawlerId)}
              fallbackSrc={getBrawlerPortraitFallback(brawlerId)}
              alt={name}
              className="w-full h-full object-cover"
              width={160}
              height={160}
            />
          </div>
        </div>

        {/* Info */}
        <div className="text-center md:text-left flex-1">
          <h1 className="font-['Lilita_One'] text-3xl md:text-4xl text-white">{name}</h1>
          {className_ && (
            <p className="text-sm text-slate-400 mt-1">{className_}</p>
          )}
          <span
            className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-['Lilita_One'] text-white"
            style={{ backgroundColor: `${rarityColor}40`, border: `2px solid ${rarityColor}` }}
          >
            {rarity}
          </span>

          {/* Player stats row */}
          {playerBrawler ? (
            <div className="flex flex-wrap items-center gap-3 mt-4 justify-center md:justify-start">
              <span className="px-2 py-1 rounded-lg bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-['Lilita_One']">
                P{playerBrawler.power}
              </span>
              <span className="px-2 py-1 rounded-lg bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-['Lilita_One']">
                R{playerBrawler.rank}
              </span>
              <span className="text-sm text-white font-['Lilita_One']">
                🏆 {playerBrawler.trophies.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">
                (max {playerBrawler.highestTrophies.toLocaleString()})
              </span>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500 font-['Lilita_One']">{t('notUnlocked')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/brawler-detail/HeroBanner.tsx
git commit -m "feat(ui): HeroBanner component with rarity gradient + player stats"
```

---

### Task 7: MetaIntelligence component

**Files:**
- Create: `src/components/brawler-detail/MetaIntelligence.tsx`

- [ ] **Step 1: Create component**

Create `src/components/brawler-detail/MetaIntelligence.tsx`. This shows:
- 4 stat cards (WR, Pick Rate, Total Battles, Trend)
- Best Maps grid (top 5)
- Counters: Strong Against / Weak Against
- Best Teammates (if available)

Use:
- `.brawl-card-dark p-5 md:p-6 border-[#090E17]` for sections
- `font-['Lilita_One']` for titles and data values
- `grid grid-cols-2 md:grid-cols-4 gap-3` for stat cards
- `BrawlImg` for brawler portraits (40x40)
- `getMapImageUrl(eventId)` for map thumbnails, `getGameModeImageUrl(mode)` for mode icons
- Trend arrow: `↑` green if trend7d > 0, `↓` red if < 0, `→` gray if 0
- WR color coding: `text-green-400` if > 55, `text-amber-400` if 45-55, `text-red-400` if < 45

**Full component code must be written here — see spec section 3.2 for all details. Resolve opponent names client-side from brawler-registry cache.**

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/brawler-detail/MetaIntelligence.tsx
git commit -m "feat(ui): MetaIntelligence with stats, maps, counters"
```

---

### Task 8: ActivityCalendar component

**Files:**
- Create: `src/components/brawler-detail/ActivityCalendar.tsx`

- [ ] **Step 1: Create component**

GitHub-style contribution grid:
- 90 days, 7 rows (Mon-Sun), ~13 columns
- Cell: `w-3 h-3 rounded-sm` with opacity based on game count
- Color: base `bg-[#FFC91B]` with opacity levels (10%, 30%, 60%, 100%)
- Uses `bucketBattlesToCalendar()` from compute.ts
- Tooltip on hover showing date + games + WR
- Wrapped in `.brawl-card-dark p-5 md:p-6`

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/brawler-detail/ActivityCalendar.tsx
git commit -m "feat(ui): ActivityCalendar GitHub-style 90-day grid"
```

---

### Task 9: MasteryTimeline component

**Files:**
- Create: `src/components/brawler-detail/MasteryTimeline.tsx`

- [ ] **Step 1: Create component**

Line chart showing WR progression:
- Uses `framer-motion` for SVG path animation
- Data from `BrawlerMastery.points[]` (existing type)
- X-axis: date labels, Y-axis: cumulative WR%
- SVG-based (no chart library needed — simple line)
- Color: `#FFC91B` (gold) stroke
- Area fill: `#FFC91B10`
- Wrapped in `.brawl-card-dark p-5 md:p-6`
- Dynamic import: `const MasteryTimeline = dynamic(() => import(...))`

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/brawler-detail/MasteryTimeline.tsx
git commit -m "feat(ui): MasteryTimeline SVG line chart with framer-motion"
```

---

### Task 10: PersonalAnalysis + BrawlerRecommendations

**Files:**
- Create: `src/components/brawler-detail/PersonalAnalysis.tsx`
- Create: `src/components/brawler-detail/BrawlerRecommendations.tsx`

- [ ] **Step 1: Create BrawlerRecommendations**

Shows 3-5 actionable tips from `generateRecommendations()`:
- Each tip: icon (map/sword/users) + text from i18n with interpolated values
- Card style: `.brawl-row rounded-xl px-4 py-3`
- Green border-l-4 for "play", red for "avoid", blue for "team"

- [ ] **Step 2: Create PersonalAnalysis**

Orchestrator for premium section:
- Comparison cards (Your WR vs Meta WR)
- Personal Map table
- Personal Matchups table
- `<ActivityCalendar>` (Task 8)
- `<MasteryTimeline>` (Task 9)
- `<BrawlerRecommendations>` (Step 1)

Receives:
- `brawlerId: number`
- `analytics: AdvancedAnalytics` (from useAdvancedAnalytics)
- `metaData: BrawlerMetaResponse` (from useBrawlerMeta)

Filters analytics data:
- `analytics.byBrawler.find(b => b.brawlerId === brawlerId)`
- `analytics.brawlerMapMatrix.filter(b => b.brawlerId === brawlerId)`
- `analytics.matchups.filter(m => m.myBrawlerId === brawlerId)`
- `analytics.brawlerMastery.find(b => b.brawlerId === brawlerId)`
- `analytics.brawlerComfort.find(b => b.brawlerId === brawlerId)`

Uses `<BlurredTeaser>` wrapping when `!isPremium`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/brawler-detail/PersonalAnalysis.tsx src/components/brawler-detail/BrawlerRecommendations.tsx
git commit -m "feat(ui): PersonalAnalysis + BrawlerRecommendations with blur gate"
```

---

### Task 11: Main page + skeleton

**Files:**
- Create: `src/app/[locale]/profile/[tag]/brawlers/[brawlerId]/page.tsx`

- [ ] **Step 1: Create page component**

```typescript
'use client'

import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePlayerData } from '@/hooks/usePlayerData'
import { useBrawlerMeta } from '@/hooks/useBrawlerMeta'
import { useAdvancedAnalytics } from '@/hooks/useAdvancedAnalytics'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import { getCachedRegistry } from '@/lib/brawler-registry'
import { HeroBanner } from '@/components/brawler-detail/HeroBanner'
import { MetaIntelligence } from '@/components/brawler-detail/MetaIntelligence'
import { PersonalAnalysis } from '@/components/brawler-detail/PersonalAnalysis'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import type { Profile } from '@/lib/supabase/types'

function BrawlerDetailSkeleton() {
  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      <div className="brawl-card p-5 md:p-8">
        <Skeleton className="h-4 w-24 mb-4" />
        <div className="flex flex-col md:flex-row items-center gap-6">
          <Skeleton className="w-[120px] h-[120px] rounded-2xl shrink-0" />
          <div className="space-y-3 flex-1 w-full">
            <Skeleton className="h-10 w-48 mx-auto md:mx-0" />
            <Skeleton className="h-4 w-32 mx-auto md:mx-0" />
            <Skeleton className="h-6 w-24 mx-auto md:mx-0" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="brawl-card-dark p-5 md:p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </div>
  )
}

export default function BrawlerDetailPage() {
  const params = useParams<{ tag: string; locale: string; brawlerId: string }>()
  const router = useRouter()
  const tag = decodeURIComponent(params.tag)
  const brawlerId = parseInt(params.brawlerId, 10)
  const t = useTranslations('brawlerDetail')

  const { user, profile, loading: authLoading } = useAuth()
  const { data: playerData, isLoading: playerLoading } = usePlayerData(tag)
  const { data: metaData, isLoading: metaLoading, error: metaError } = useBrawlerMeta(brawlerId)
  const hasPremium = !authLoading && user && profile && isPremium(profile as Profile)

  // Only fetch analytics for premium users
  const { data: analytics } = useAdvancedAnalytics(hasPremium ? tag : '')

  if (isNaN(brawlerId)) {
    router.push(`/${params.locale}/profile/${encodeURIComponent(params.tag)}/brawlers`)
    return null
  }

  if (playerLoading || metaLoading) return <BrawlerDetailSkeleton />

  if (metaError) {
    return (
      <div className="glass p-8 rounded-2xl text-center border-red-500/30">
        <p className="text-red-400">{metaError}</p>
      </div>
    )
  }

  // Find player's brawler in roster
  const playerBrawler = playerData?.player?.brawlers?.find(b => b.id === brawlerId) ?? null

  // Resolve brawler info from registry
  const registry = getCachedRegistry()
  const brawlerInfo = registry?.find(b => b.id === brawlerId) ?? null

  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      <HeroBanner
        brawlerId={brawlerId}
        brawlerInfo={brawlerInfo}
        playerBrawler={playerBrawler}
      />

      {metaData && (
        <MetaIntelligence data={metaData} />
      )}

      {playerBrawler && (
        <PersonalAnalysis
          brawlerId={brawlerId}
          analytics={analytics}
          metaData={metaData}
          hasPremium={!!hasPremium}
          tag={tag}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/app/\[locale\]/profile/\[tag\]/brawlers/\[brawlerId\]/
git commit -m "feat(page): brawler detail page with skeleton + data orchestration"
```

---

### Task 12: Navigation — Sidebar fix + clickable brawler cards

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (line 59)
- Modify: `src/app/[locale]/profile/[tag]/brawlers/page.tsx` (lines 289-295)

- [ ] **Step 1: Fix Sidebar isActive**

In `src/components/layout/Sidebar.tsx`, change line 59 from:

```typescript
const isActive = pathname === href || (item.path === '' && pathname === basePath)
```

To:

```typescript
const isActive = pathname === href || pathname.startsWith(href + '/') || (item.path === '' && pathname === basePath)
```

This makes "Brawlers" stay highlighted when on `/brawlers/16000000`.

- [ ] **Step 2: Make brawler cards clickable**

In `src/app/[locale]/profile/[tag]/brawlers/page.tsx`, find the brawler card `<div>` (around line 289-294) and wrap it with a `<Link>`. Import Link at the top:

```typescript
import Link from 'next/link'
```

Wrap the card's outer `<div>` with:

```typescript
<Link
  href={`${basePath}/brawlers/${brawler.id}`}
  key={brawler.id}
  className="group relative pt-6 transition-transform hover:scale-[1.02] active:scale-[0.98]"
>
```

Remove the existing `key={brawler.id}` from the inner `<div>` if present (move to Link).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Visual verify**

Open `http://localhost:3000/es/profile/%23YJU282PV/brawlers`:
- Brawler cards should be clickable
- Clicking one should navigate to `/brawlers/{id}`
- Sidebar "Brawlers" should stay highlighted on the detail page

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/app/\[locale\]/profile/\[tag\]/brawlers/page.tsx
git commit -m "feat(nav): clickable brawler cards + sidebar active state for sub-routes"
```

---

### Task 13: End-to-end verification + push

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass including new brawler-detail tests

- [ ] **Step 3: Visual verification on mobile (375px)**

Using Playwright or dev tools:
1. Navigate to `/es/profile/%23YJU282PV/brawlers`
2. Click a brawler card → should navigate to detail page
3. Verify: Hero banner renders with portrait + name + rarity
4. Verify: Meta Intelligence section shows (may be empty if no meta data)
5. Verify: Personal Analysis shows with blur (no premium session)
6. Verify: Back button "← Brawlers" works
7. Verify: Sidebar "Brawlers" is highlighted

- [ ] **Step 4: Visual verification on desktop (1280px)**

Same checks, verify layout adapts (horizontal hero, 4-col grid, no horizontal scroll).

- [ ] **Step 5: Push**

```bash
git push origin main
```

Verify Vercel deployment succeeds (no TypeScript errors).
