# Plan 4: Analytics UI + Freemium UI + Ad Removal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the premium analytics page (win rates, teammates, battle history with infinite scroll), add blurred teasers for free users, remove ads for premium users, and create the privacy policy page.

**Architecture:** A `/api/battles` endpoint serves stored battle data with cursor-based pagination. The analytics page aggregates data client-side from the full battle history. Free users see blurred previews with upgrade CTAs. Premium users have AdSense script conditionally excluded. A static privacy page covers GDPR requirements.

**Tech Stack:** Next.js 16.2.2, Supabase PostgreSQL, Vitest, Tailwind CSS, next-intl

**Spec:** `docs/superpowers/specs/2026-04-06-premium-battle-analytics-design.md`

**Depends on:** Plan 1 (auth), Plan 2 (battles table), Plan 3 (tier management)

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/app/api/battles/route.ts` | Cursor-paginated battle history |
| Create | `src/hooks/useBattleHistory.ts` | Infinite scroll hook |
| Create | `src/hooks/useAnalytics.ts` | Aggregate battle stats |
| Create | `src/app/[locale]/profile/[tag]/analytics/page.tsx` | Analytics dashboard |
| Create | `src/components/analytics/WinRateByMode.tsx` | Mode win rate bars |
| Create | `src/components/analytics/WinRateByBrawler.tsx` | Brawler win rate grid |
| Create | `src/components/analytics/WinRateByMap.tsx` | Map win rate list |
| Create | `src/components/analytics/BestTeammates.tsx` | Teammate analysis |
| Create | `src/components/analytics/BattleTimeline.tsx` | Battle history scroll |
| Create | `src/components/premium/BlurredTeaser.tsx` | Blurred overlay + CTA |
| Create | `src/app/[locale]/privacy/page.tsx` | Privacy policy page |
| Create | `src/__tests__/unit/hooks/useAnalytics.test.ts` | Analytics aggregation tests |
| Create | `src/__tests__/integration/api/battles.test.ts` | Battles API tests |
| Modify | `src/app/[locale]/layout.tsx` | Conditional AdSense |
| Modify | `src/app/[locale]/profile/[tag]/battles/page.tsx` | Add blurred teaser |

---

### Task 0: Battles API Route (Cursor Pagination)

**Files:**
- Create: `src/app/api/battles/route.ts`
- Test: `src/__tests__/integration/api/battles.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/integration/api/battles.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/battles/route'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

const MOCK_BATTLES = [
  { id: 1, player_tag: '#TAG', battle_time: '2026-04-05T17:00:00Z', mode: 'brawlBall', result: 'victory' },
  { id: 2, player_tag: '#TAG', battle_time: '2026-04-05T16:00:00Z', mode: 'gemGrab', result: 'defeat' },
]

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/battles')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url)
}

describe('GET /api/battles', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns battles with cursor pagination', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: MOCK_BATTLES, error: null }),
    }
    // profiles query for tag lookup
    const mockProfileQuery = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { player_tag: '#TAG' }, error: null }),
        }),
      }),
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return mockProfileQuery
      if (table === 'battles') return mockQuery
      return {}
    })

    const res = await GET(makeRequest({ limit: '50' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.battles).toHaveLength(2)
    expect(data.nextCursor).toBeDefined()
  })

  it('returns empty array and null cursor when no battles', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { player_tag: '#TAG' }, error: null }),
          }),
        }),
      }
      if (table === 'battles') return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
      return {}
    })

    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.battles).toHaveLength(0)
    expect(data.nextCursor).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/integration/api/battles.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement battles API route**

```typescript
// src/app/api/battles/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Get user's player tag
  const { data: profile } = await supabase
    .from('profiles')
    .select('player_tag')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const before = searchParams.get('before')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

  let query = supabase
    .from('battles')
    .select('*')
    .eq('player_tag', profile.player_tag)

  if (before) {
    query = query.lt('battle_time', before)
  }

  const { data: battles, error } = await query
    .order('battle_time', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const nextCursor = battles && battles.length === limit
    ? battles[battles.length - 1].battle_time
    : null

  return NextResponse.json({ battles: battles ?? [], nextCursor })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/integration/api/battles.test.ts`

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/battles/route.ts src/__tests__/integration/api/battles.test.ts
git commit -m "feat: battles API with cursor-based pagination"
```

---

### Task 1: Analytics Aggregation Hook

**Files:**
- Create: `src/hooks/useAnalytics.ts`
- Test: `src/__tests__/unit/hooks/useAnalytics.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/unit/hooks/useAnalytics.test.ts
import { describe, it, expect } from 'vitest'
import { aggregateAnalytics } from '@/hooks/useAnalytics'
import type { Battle } from '@/lib/supabase/types'

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    id: 1,
    player_tag: '#TAG',
    battle_time: '2026-04-05T17:00:00Z',
    mode: 'brawlBall',
    map: 'Super Beach',
    result: 'victory',
    trophy_change: 8,
    duration: 120,
    is_star_player: false,
    my_brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 750, gadgets: [], starPowers: [], hypercharges: [] },
    teammates: [{ tag: '#ALLY1', name: 'Ally1', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 600 } }],
    opponents: [],
    created_at: '2026-04-05T17:00:00Z',
    ...overrides,
  }
}

describe('aggregateAnalytics', () => {
  it('calculates overall win rate', () => {
    const battles = [
      makeBattle({ result: 'victory' }),
      makeBattle({ id: 2, result: 'victory' }),
      makeBattle({ id: 3, result: 'defeat' }),
    ]
    const result = aggregateAnalytics(battles)
    expect(result.overallWinRate).toBe(67)
  })

  it('calculates win rate by mode', () => {
    const battles = [
      makeBattle({ mode: 'brawlBall', result: 'victory' }),
      makeBattle({ id: 2, mode: 'brawlBall', result: 'defeat' }),
      makeBattle({ id: 3, mode: 'gemGrab', result: 'victory' }),
    ]
    const result = aggregateAnalytics(battles)
    const bb = result.byMode.find(m => m.mode === 'brawlBall')
    expect(bb?.winRate).toBe(50)
    expect(bb?.total).toBe(2)
    const gg = result.byMode.find(m => m.mode === 'gemGrab')
    expect(gg?.winRate).toBe(100)
  })

  it('calculates win rate by brawler', () => {
    const battles = [
      makeBattle({ my_brawler: { ...makeBattle().my_brawler, name: 'SHELLY' }, result: 'victory' }),
      makeBattle({ id: 2, my_brawler: { ...makeBattle().my_brawler, name: 'SHELLY' }, result: 'defeat' }),
    ]
    const result = aggregateAnalytics(battles)
    const shelly = result.byBrawler.find(b => b.name === 'SHELLY')
    expect(shelly?.winRate).toBe(50)
    expect(shelly?.total).toBe(2)
  })

  it('calculates win rate by map', () => {
    const battles = [
      makeBattle({ map: 'Super Beach', result: 'victory' }),
      makeBattle({ id: 2, map: 'Super Beach', result: 'victory' }),
      makeBattle({ id: 3, map: 'Backyard Bowl', result: 'defeat' }),
    ]
    const result = aggregateAnalytics(battles)
    const sb = result.byMap.find(m => m.map === 'Super Beach')
    expect(sb?.winRate).toBe(100)
  })

  it('calculates best teammates', () => {
    const battles = [
      makeBattle({ teammates: [{ tag: '#A', name: 'Alice', brawler: { id: 1, name: 'COLT', power: 9, trophies: 500 } }], result: 'victory' }),
      makeBattle({ id: 2, teammates: [{ tag: '#A', name: 'Alice', brawler: { id: 1, name: 'COLT', power: 9, trophies: 500 } }], result: 'victory' }),
      makeBattle({ id: 3, teammates: [{ tag: '#B', name: 'Bob', brawler: { id: 2, name: 'BULL', power: 10, trophies: 400 } }], result: 'defeat' }),
    ]
    const result = aggregateAnalytics(battles)
    expect(result.bestTeammates[0].name).toBe('Alice')
    expect(result.bestTeammates[0].gamesPlayed).toBe(2)
    expect(result.bestTeammates[0].winRate).toBe(100)
  })

  it('returns empty analytics for no battles', () => {
    const result = aggregateAnalytics([])
    expect(result.overallWinRate).toBe(0)
    expect(result.byMode).toHaveLength(0)
    expect(result.byBrawler).toHaveLength(0)
    expect(result.byMap).toHaveLength(0)
    expect(result.bestTeammates).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/unit/hooks/useAnalytics.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement analytics aggregation**

```typescript
// src/hooks/useAnalytics.ts
import type { Battle } from '@/lib/supabase/types'

export interface ModeStats { mode: string; wins: number; total: number; winRate: number }
export interface BrawlerStats { id: number; name: string; wins: number; total: number; winRate: number }
export interface MapStats { map: string; wins: number; total: number; winRate: number }
export interface TeammateStats { tag: string; name: string; gamesPlayed: number; wins: number; winRate: number }

export interface Analytics {
  overallWinRate: number
  totalBattles: number
  totalWins: number
  trophyChange: number
  starPlayerCount: number
  byMode: ModeStats[]
  byBrawler: BrawlerStats[]
  byMap: MapStats[]
  bestTeammates: TeammateStats[]
}

export function aggregateAnalytics(battles: Battle[]): Analytics {
  if (battles.length === 0) {
    return { overallWinRate: 0, totalBattles: 0, totalWins: 0, trophyChange: 0, starPlayerCount: 0, byMode: [], byBrawler: [], byMap: [], bestTeammates: [] }
  }

  const totalWins = battles.filter(b => b.result === 'victory').length
  const trophyChange = battles.reduce((sum, b) => sum + b.trophy_change, 0)
  const starPlayerCount = battles.filter(b => b.is_star_player).length

  // By mode
  const modeMap = new Map<string, { wins: number; total: number }>()
  for (const b of battles) {
    const entry = modeMap.get(b.mode) ?? { wins: 0, total: 0 }
    entry.total++
    if (b.result === 'victory') entry.wins++
    modeMap.set(b.mode, entry)
  }
  const byMode: ModeStats[] = [...modeMap.entries()]
    .map(([mode, s]) => ({ mode, ...s, winRate: Math.round((s.wins / s.total) * 100) }))
    .sort((a, b) => b.total - a.total)

  // By brawler
  const brawlerMap = new Map<string, { id: number; wins: number; total: number }>()
  for (const b of battles) {
    const key = b.my_brawler.name
    const entry = brawlerMap.get(key) ?? { id: b.my_brawler.id, wins: 0, total: 0 }
    entry.total++
    if (b.result === 'victory') entry.wins++
    brawlerMap.set(key, entry)
  }
  const byBrawler: BrawlerStats[] = [...brawlerMap.entries()]
    .map(([name, s]) => ({ name, ...s, winRate: Math.round((s.wins / s.total) * 100) }))
    .sort((a, b) => b.total - a.total)

  // By map
  const mapMap = new Map<string, { wins: number; total: number }>()
  for (const b of battles) {
    if (!b.map) continue
    const entry = mapMap.get(b.map) ?? { wins: 0, total: 0 }
    entry.total++
    if (b.result === 'victory') entry.wins++
    mapMap.set(b.map, entry)
  }
  const byMap: MapStats[] = [...mapMap.entries()]
    .map(([map, s]) => ({ map, ...s, winRate: Math.round((s.wins / s.total) * 100) }))
    .sort((a, b) => b.total - a.total)

  // Best teammates
  const tmMap = new Map<string, { name: string; wins: number; total: number }>()
  for (const b of battles) {
    for (const tm of b.teammates) {
      const entry = tmMap.get(tm.tag) ?? { name: tm.name, wins: 0, total: 0 }
      entry.total++
      if (b.result === 'victory') entry.wins++
      tmMap.set(tm.tag, entry)
    }
  }
  const bestTeammates: TeammateStats[] = [...tmMap.entries()]
    .map(([tag, s]) => ({ tag, name: s.name, gamesPlayed: s.total, wins: s.wins, winRate: Math.round((s.wins / s.total) * 100) }))
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
    .slice(0, 10)

  return {
    overallWinRate: Math.round((totalWins / battles.length) * 100),
    totalBattles: battles.length,
    totalWins,
    trophyChange,
    starPlayerCount,
    byMode,
    byBrawler,
    byMap,
    bestTeammates,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/unit/hooks/useAnalytics.test.ts`

Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAnalytics.ts src/__tests__/unit/hooks/useAnalytics.test.ts
git commit -m "feat: analytics aggregation — win rates by mode/brawler/map + teammates"
```

---

### Task 2: Battle History Hook (Infinite Scroll)

**Files:**
- Create: `src/hooks/useBattleHistory.ts`

- [ ] **Step 1: Create the infinite scroll hook**

```typescript
// src/hooks/useBattleHistory.ts
'use client'

import { useState, useCallback } from 'react'
import type { Battle } from '@/lib/supabase/types'

interface UseBattleHistoryReturn {
  battles: Battle[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
  loadAll: () => Promise<Battle[]>
}

export function useBattleHistory(): UseBattleHistoryReturn {
  const [battles, setBattles] = useState<Battle[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [initialized, setInitialized] = useState(false)

  const fetchPage = useCallback(async (before?: string): Promise<{ battles: Battle[]; nextCursor: string | null }> => {
    const params = new URLSearchParams({ limit: '50' })
    if (before) params.set('before', before)

    const res = await fetch(`/api/battles?${params}`)
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json()
  }, [])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return

    const isFirst = !initialized
    if (isFirst) setLoading(true)
    else setLoadingMore(true)

    try {
      const page = await fetchPage(cursor ?? undefined)
      setBattles(prev => [...prev, ...page.battles])
      setCursor(page.nextCursor)
      setHasMore(page.nextCursor !== null)
      setInitialized(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [cursor, hasMore, loadingMore, initialized, fetchPage])

  const loadAll = useCallback(async (): Promise<Battle[]> => {
    const all: Battle[] = []
    let nextCursor: string | null = null
    let first = true

    do {
      const page = await fetchPage(nextCursor ?? undefined)
      all.push(...page.battles)
      nextCursor = page.nextCursor
      if (first) { setLoading(false); first = false }
    } while (nextCursor)

    setBattles(all)
    setHasMore(false)
    setInitialized(true)
    return all
  }, [fetchPage])

  return { battles, loading, loadingMore, hasMore, loadMore, loadAll }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useBattleHistory.ts
git commit -m "feat: useBattleHistory hook with cursor-based infinite scroll"
```

---

### Task 3: Analytics Page + Sub-Components

**Files:**
- Create: `src/components/analytics/WinRateByMode.tsx`
- Create: `src/components/analytics/WinRateByBrawler.tsx`
- Create: `src/components/analytics/BestTeammates.tsx`
- Create: `src/app/[locale]/profile/[tag]/analytics/page.tsx`

- [ ] **Step 1: Create WinRateByMode component**

```typescript
// src/components/analytics/WinRateByMode.tsx
'use client'

import { useTranslations } from 'next-intl'
import type { ModeStats } from '@/hooks/useAnalytics'

const MODE_ICONS: Record<string, string> = {
  brawlBall: '⚽', gemGrab: '💎', showdown: '💀', duoShowdown: '💀',
  heist: '🔒', bounty: '⭐', siege: '🤖', hotZone: '🔥',
  knockout: '🥊', wipeout: '💥', payload: '🚚', paintBrawl: '🎨',
  trophyThieves: '🏆', duels: '⚔️', ranked: '🏅',
}

export function WinRateByMode({ data }: { data: ModeStats[] }) {
  const t = useTranslations('analytics')

  if (data.length === 0) return null

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">📊</span> {t('winRateByMode')}
      </h3>
      <div className="space-y-2.5">
        {data.map(m => (
          <div key={m.mode} className="flex items-center gap-3">
            <span className="text-lg w-7 text-center">{MODE_ICONS[m.mode] || '🎮'}</span>
            <span className="font-['Lilita_One'] text-sm text-slate-300 w-28 truncate">{m.mode}</span>
            <div className="flex-1 h-5 bg-[#0D1321] rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full relative overflow-hidden transition-all duration-700"
                style={{
                  width: `${m.winRate}%`,
                  background: m.winRate >= 60 ? 'linear-gradient(to right, #4ade80, #22c55e)' : m.winRate >= 45 ? 'linear-gradient(to right, #FFC91B, #F59E0B)' : 'linear-gradient(to right, #f87171, #ef4444)',
                }}
              >
                <div className="absolute inset-0 top-0 h-1/3 bg-white/25 rounded-full" />
              </div>
            </div>
            <span className={`font-['Lilita_One'] text-sm w-12 text-right tabular-nums ${m.winRate >= 60 ? 'text-green-400' : m.winRate >= 45 ? 'text-[#FFC91B]' : 'text-red-400'}`}>
              {m.winRate}%
            </span>
            <span className="text-[10px] text-slate-600 w-8 text-right">{m.total}g</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create WinRateByBrawler component**

```typescript
// src/components/analytics/WinRateByBrawler.tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl } from '@/lib/utils'
import type { BrawlerStats } from '@/hooks/useAnalytics'

export function WinRateByBrawler({ data }: { data: BrawlerStats[] }) {
  const t = useTranslations('analytics')
  const [sortBy, setSortBy] = useState<'total' | 'winRate'>('total')

  if (data.length === 0) return null

  const sorted = [...data].sort((a, b) => sortBy === 'winRate' ? b.winRate - a.winRate : b.total - a.total)

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
          <span className="text-xl">🎯</span> {t('winRateByBrawler')}
        </h3>
        <div className="flex gap-1">
          <button onClick={() => setSortBy('total')} className={`px-2 py-1 text-[10px] font-bold rounded ${sortBy === 'total' ? 'bg-[#FFC91B]/20 text-[#FFC91B]' : 'text-slate-500 hover:text-white'}`}>
            {t('sortGames')}
          </button>
          <button onClick={() => setSortBy('winRate')} className={`px-2 py-1 text-[10px] font-bold rounded ${sortBy === 'winRate' ? 'bg-[#FFC91B]/20 text-[#FFC91B]' : 'text-slate-500 hover:text-white'}`}>
            {t('sortWR')}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {sorted.map(b => (
          <div key={b.name} className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-3 py-2">
            <img src={getBrawlerPortraitUrl(b.id)} alt={b.name} className="w-8 h-8 rounded-lg" loading="lazy" />
            <div className="flex-1 min-w-0">
              <p className="font-['Lilita_One'] text-xs text-white truncate">{b.name}</p>
              <p className="text-[10px] text-slate-500">{b.total}g</p>
            </div>
            <span className={`font-['Lilita_One'] text-sm ${b.winRate >= 60 ? 'text-green-400' : b.winRate >= 45 ? 'text-[#FFC91B]' : 'text-red-400'}`}>
              {b.winRate}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create BestTeammates component**

```typescript
// src/components/analytics/BestTeammates.tsx
'use client'

import { useTranslations } from 'next-intl'
import type { TeammateStats } from '@/hooks/useAnalytics'

export function BestTeammates({ data }: { data: TeammateStats[] }) {
  const t = useTranslations('analytics')

  if (data.length === 0) return null

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">👥</span> {t('bestTeammates')}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {data.map((tm, i) => (
          <div key={tm.tag} className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-4 py-3">
            <span className={`font-['Lilita_One'] text-lg ${i === 0 ? 'text-[#FFC91B]' : i === 1 ? 'text-slate-300' : 'text-slate-500'}`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-['Lilita_One'] text-sm text-white truncate">{tm.name}</p>
              <p className="text-[10px] text-slate-500">{tm.gamesPlayed} {t('games')}</p>
            </div>
            <span className={`font-['Lilita_One'] text-sm ${tm.winRate >= 60 ? 'text-green-400' : tm.winRate >= 45 ? 'text-[#FFC91B]' : 'text-red-400'}`}>
              {tm.winRate}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create the Analytics page**

```typescript
// src/app/[locale]/profile/[tag]/analytics/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { useBattleHistory } from '@/hooks/useBattleHistory'
import { aggregateAnalytics, type Analytics } from '@/hooks/useAnalytics'
import { WinRateByMode } from '@/components/analytics/WinRateByMode'
import { WinRateByBrawler } from '@/components/analytics/WinRateByBrawler'
import { BestTeammates } from '@/components/analytics/BestTeammates'
import { UpgradeCard } from '@/components/premium/UpgradeCard'
import { ManageSubscription } from '@/components/premium/ManageSubscription'
import { isPremium } from '@/lib/auth'
import type { Profile } from '@/lib/supabase/types'
import { FlaskConical } from 'lucide-react'

export default function AnalyticsPage() {
  const params = useParams<{ tag: string; locale: string }>()
  const t = useTranslations('analytics')
  const { user, profile, loading: authLoading } = useAuth()
  const { battles, loading: battlesLoading, loadAll } = useBattleHistory()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)

  const tag = decodeURIComponent(params.tag)
  const hasPremium = isPremium(profile as Profile | null)

  useEffect(() => {
    if (hasPremium && battles.length === 0 && !battlesLoading) {
      loadAll().then(all => setAnalytics(aggregateAnalytics(all)))
    }
  }, [hasPremium, battles.length, battlesLoading, loadAll])

  useEffect(() => {
    if (battles.length > 0) {
      setAnalytics(aggregateAnalytics(battles))
    }
  }, [battles])

  // Not premium: show upgrade card
  if (!authLoading && !hasPremium) {
    return (
      <div className="animate-fade-in w-full pb-10 space-y-6">
        <div className="brawl-card p-6 md:p-8 bg-gradient-to-r from-[#FFC91B] to-[#121A2F]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#121A2F] border-4 border-[#FFC91B] rounded-2xl flex items-center justify-center transform rotate-3 shadow-[0_4px_0_0_#121A2F]">
              <FlaskConical className="w-8 h-8 text-[#FFC91B]" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-1deg]">
                {t('title')}
              </h1>
              <p className="font-['Inter'] font-semibold text-[#FFC91B]">{t('premiumOnly')}</p>
            </div>
          </div>
        </div>
        <UpgradeCard redirectTo={`/${params.locale}/profile/${params.tag}/analytics`} />
      </div>
    )
  }

  // Loading
  if (authLoading || battlesLoading || !analytics) {
    return <div className="animate-pulse py-20 text-center"><p className="text-slate-400 font-['Lilita_One'] text-2xl">{t('loading')}</p></div>
  }

  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      {/* Header */}
      <div className="brawl-card p-6 md:p-8 bg-gradient-to-r from-[#FFC91B] to-[#121A2F]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#121A2F] border-4 border-[#FFC91B] rounded-2xl flex items-center justify-center transform rotate-3 shadow-[0_4px_0_0_#121A2F]">
            <FlaskConical className="w-8 h-8 text-[#FFC91B]" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-1deg]">
              {t('title')}
            </h1>
            <p className="font-['Inter'] font-semibold text-[#FFC91B]">
              {t('totalBattles', { count: String(analytics.totalBattles) })}
            </p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="brawl-card p-4 text-center">
          <p className="font-['Lilita_One'] text-3xl text-green-500">{analytics.overallWinRate}%</p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('winRate')}</p>
        </div>
        <div className="brawl-card p-4 text-center">
          <p className={`font-['Lilita_One'] text-2xl ${analytics.trophyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {analytics.trophyChange >= 0 ? '+' : ''}{analytics.trophyChange}
          </p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('trophies')}</p>
        </div>
        <div className="brawl-card p-4 text-center">
          <p className="font-['Lilita_One'] text-2xl text-[#FFC91B]">{analytics.starPlayerCount}</p>
          <p className="text-[10px] uppercase font-bold text-slate-500">Star Player</p>
        </div>
        <div className="brawl-card p-4 text-center">
          <p className="font-['Lilita_One'] text-2xl text-white">{analytics.totalBattles}</p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('battles')}</p>
        </div>
      </div>

      <ManageSubscription />
      <WinRateByMode data={analytics.byMode} />
      <WinRateByBrawler data={analytics.byBrawler} />
      <BestTeammates data={analytics.bestTeammates} />
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/ src/app/[locale]/profile/[tag]/analytics/
git commit -m "feat: analytics page with win rates, brawler stats, teammates"
```

---

### Task 4: Blurred Teaser Component

**Files:**
- Create: `src/components/premium/BlurredTeaser.tsx`
- Modify: `src/app/[locale]/profile/[tag]/battles/page.tsx`

- [ ] **Step 1: Create BlurredTeaser component**

```typescript
// src/components/premium/BlurredTeaser.tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { AuthModal } from '@/components/auth/AuthModal'
import { Lock } from 'lucide-react'

interface BlurredTeaserProps {
  children: React.ReactNode
  redirectTo?: string
}

export function BlurredTeaser({ children, redirectTo }: BlurredTeaserProps) {
  const { user } = useAuth()
  const t = useTranslations('premium')
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <div className="relative">
      {/* Blurred content */}
      <div className="blur-sm pointer-events-none select-none opacity-60">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#121A2F]/60 backdrop-blur-[2px] rounded-2xl">
        <div className="w-14 h-14 rounded-full bg-[#FFC91B]/20 border-2 border-[#FFC91B]/30 flex items-center justify-center mb-3">
          <Lock className="w-6 h-6 text-[#FFC91B]" />
        </div>
        <p className="font-['Lilita_One'] text-lg text-white text-center mb-1">{t('teaserTitle')}</p>
        <p className="text-xs text-slate-400 text-center mb-4 max-w-xs">{t('teaserSubtitle')}</p>
        {user ? (
          <a
            href="/api/checkout"
            onClick={async (e) => {
              e.preventDefault()
              const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ interval: 'monthly' }),
              })
              const data = await res.json()
              if (data.url) window.location.href = data.url
            }}
            className="brawl-button px-6 py-2.5 text-sm"
          >
            {t('upgradeButton')}
          </a>
        ) : (
          <button onClick={() => setAuthOpen(true)} className="brawl-button px-6 py-2.5 text-sm">
            {t('registerButton')}
          </button>
        )}
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} redirectTo={redirectTo} />
    </div>
  )
}
```

- [ ] **Step 2: Add blurred teaser to battles page**

In `src/app/[locale]/profile/[tag]/battles/page.tsx`, add after the battle list and before `<AdPlaceholder>`:

Add import:
```typescript
import { BlurredTeaser } from '@/components/premium/BlurredTeaser'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/auth'
import type { Profile } from '@/lib/supabase/types'
```

Inside the component, add after `const { data, isLoading, error } = useBattlelog(tag)`:
```typescript
const { profile } = useAuth()
const hasPremium = isPremium(profile as Profile | null)
```

After the battle list `</div>` and before `<AdPlaceholder>`, add:

```tsx
{/* Blurred teaser for non-premium users */}
{!hasPremium && (
  <BlurredTeaser redirectTo={`/${params.locale}/profile/${params.tag}/battles`}>
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="p-4 rounded-xl border-2 bg-white/5 border-white/10 flex items-center gap-4">
          <span className="text-2xl">🎮</span>
          <div className="flex-1">
            <div className="h-4 bg-white/10 rounded w-32 mb-2" />
            <div className="h-3 bg-white/5 rounded w-20" />
          </div>
          <div className="h-4 bg-white/10 rounded w-16" />
        </div>
      ))}
    </div>
  </BlurredTeaser>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/premium/BlurredTeaser.tsx src/app/[locale]/profile/[tag]/battles/page.tsx
git commit -m "feat: blurred teaser on battles page for free users"
```

---

### Task 5: Conditional Ad Removal for Premium

**Files:**
- Modify: `src/app/[locale]/layout.tsx`

- [ ] **Step 1: Make AdSense conditional on user tier**

Since `layout.tsx` is a server component, we cannot use `useAuth()` here. Instead, create a client wrapper component.

Create `src/components/ads/AdSenseScript.tsx`:

```typescript
// src/components/ads/AdSenseScript.tsx
'use client'

import Script from 'next/script'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/auth'
import type { Profile } from '@/lib/supabase/types'

export function AdSenseScript() {
  const { profile, loading } = useAuth()

  // Don't show ads for premium users
  if (!loading && isPremium(profile as Profile | null)) {
    return null
  }

  return (
    <Script
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6838192381842255"
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  )
}
```

In `src/app/[locale]/layout.tsx`, replace the `<Script>` tag with:

Remove:
```tsx
<Script
  src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6838192381842255"
  crossOrigin="anonymous"
  strategy="afterInteractive"
/>
```

Add import:
```typescript
import { AdSenseScript } from '@/components/ads/AdSenseScript'
```

Replace with:
```tsx
<AdSenseScript />
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ads/AdSenseScript.tsx src/app/[locale]/layout.tsx
git commit -m "feat: conditionally remove AdSense for premium users"
```

---

### Task 6: Privacy Policy Page

**Files:**
- Create: `src/app/[locale]/privacy/page.tsx`

- [ ] **Step 1: Create privacy page**

```typescript
// src/app/[locale]/privacy/page.tsx
import { useTranslations } from 'next-intl'

export default function PrivacyPage() {
  const t = useTranslations('privacy')

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-['Lilita_One'] text-4xl text-white mb-8">{t('title')}</h1>

      <div className="prose prose-invert prose-sm max-w-none space-y-6 text-slate-300">
        <section>
          <h2 className="font-['Lilita_One'] text-xl text-white">{t('dataCollectedTitle')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('dataTag')}</li>
            <li>{t('dataBattles')}</li>
            <li>{t('dataEmail')}</li>
          </ul>
        </section>

        <section>
          <h2 className="font-['Lilita_One'] text-xl text-white">{t('thirdPartyTitle')}</h2>
          <p>{t('thirdPartyBody')}</p>
        </section>

        <section>
          <h2 className="font-['Lilita_One'] text-xl text-white">{t('retentionTitle')}</h2>
          <p>{t('retentionBody')}</p>
        </section>

        <section>
          <h2 className="font-['Lilita_One'] text-xl text-white">{t('gdprTitle')}</h2>
          <p>{t('gdprBody')}</p>
        </section>

        <section>
          <h2 className="font-['Lilita_One'] text-xl text-white">{t('cookiesTitle')}</h2>
          <p>{t('cookiesBody')}</p>
        </section>

        <section>
          <h2 className="font-['Lilita_One'] text-xl text-white">{t('disclaimerTitle')}</h2>
          <p>{t('disclaimerBody')}</p>
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/privacy/
git commit -m "feat: privacy policy page"
```

---

### Task 7: i18n for Analytics + Privacy

**Files:**
- Modify: all 13 files in `messages/*.json`

- [ ] **Step 1: Add analytics and privacy namespaces**

```bash
node -e "
const fs = require('fs');
const path = require('path');

const ANALYTICS = {
  es: { title: 'Analytics', loading: 'Cargando analytics...', premiumOnly: 'Exclusivo para Premium', winRateByMode: 'Win Rate por Modo', winRateByBrawler: 'Win Rate por Brawler', bestTeammates: 'Mejores Compañeros', sortGames: 'Partidas', sortWR: 'Win Rate', games: 'partidas', winRate: 'Win Rate', trophies: 'Trofeos', battles: 'Batallas', totalBattles: '{count} batallas analizadas' },
  en: { title: 'Analytics', loading: 'Loading analytics...', premiumOnly: 'Premium exclusive', winRateByMode: 'Win Rate by Mode', winRateByBrawler: 'Win Rate by Brawler', bestTeammates: 'Best Teammates', sortGames: 'Games', sortWR: 'Win Rate', games: 'games', winRate: 'Win Rate', trophies: 'Trophies', battles: 'Battles', totalBattles: '{count} battles analyzed' },
  fr: { title: 'Analytics', loading: 'Chargement...', premiumOnly: 'Exclusif Premium', winRateByMode: 'Taux de victoire par Mode', winRateByBrawler: 'Taux de victoire par Brawler', bestTeammates: 'Meilleurs Coéquipiers', sortGames: 'Parties', sortWR: 'Taux', games: 'parties', winRate: 'Taux de victoire', trophies: 'Trophées', battles: 'Combats', totalBattles: '{count} combats analysés' },
  pt: { title: 'Analytics', loading: 'Carregando...', premiumOnly: 'Exclusivo Premium', winRateByMode: 'Taxa de Vitória por Modo', winRateByBrawler: 'Taxa de Vitória por Brawler', bestTeammates: 'Melhores Companheiros', sortGames: 'Jogos', sortWR: 'Taxa', games: 'jogos', winRate: 'Taxa de Vitória', trophies: 'Troféus', battles: 'Batalhas', totalBattles: '{count} batalhas analisadas' },
  de: { title: 'Analytics', loading: 'Laden...', premiumOnly: 'Nur für Premium', winRateByMode: 'Siegesrate nach Modus', winRateByBrawler: 'Siegesrate nach Brawler', bestTeammates: 'Beste Teamkameraden', sortGames: 'Spiele', sortWR: 'Rate', games: 'Spiele', winRate: 'Siegesrate', trophies: 'Trophäen', battles: 'Kämpfe', totalBattles: '{count} Kämpfe analysiert' },
  it: { title: 'Analytics', loading: 'Caricamento...', premiumOnly: 'Esclusivo Premium', winRateByMode: '% Vittoria per Modalità', winRateByBrawler: '% Vittoria per Brawler', bestTeammates: 'Migliori Compagni', sortGames: 'Partite', sortWR: 'Percentuale', games: 'partite', winRate: '% Vittoria', trophies: 'Trofei', battles: 'Battaglie', totalBattles: '{count} battaglie analizzate' },
  ru: { title: 'Аналитика', loading: 'Загрузка...', premiumOnly: 'Только для Премиум', winRateByMode: 'Винрейт по режиму', winRateByBrawler: 'Винрейт по бравлеру', bestTeammates: 'Лучшие тиммейты', sortGames: 'Игры', sortWR: 'Винрейт', games: 'игр', winRate: 'Винрейт', trophies: 'Трофеи', battles: 'Бои', totalBattles: '{count} боёв проанализировано' },
  tr: { title: 'Analitik', loading: 'Yükleniyor...', premiumOnly: 'Sadece Premium', winRateByMode: 'Moda Göre Kazanma Oranı', winRateByBrawler: 'Brawler Göre Kazanma Oranı', bestTeammates: 'En İyi Takım Arkadaşları', sortGames: 'Oyunlar', sortWR: 'Oran', games: 'oyun', winRate: 'Kazanma Oranı', trophies: 'Kupalar', battles: 'Savaşlar', totalBattles: '{count} savaş analiz edildi' },
  pl: { title: 'Analityka', loading: 'Ładowanie...', premiumOnly: 'Tylko Premium', winRateByMode: 'Win Rate wg trybu', winRateByBrawler: 'Win Rate wg brawlera', bestTeammates: 'Najlepsi współgracze', sortGames: 'Gry', sortWR: 'WR', games: 'gier', winRate: 'Win Rate', trophies: 'Trofea', battles: 'Bitwy', totalBattles: '{count} bitew przeanalizowanych' },
  ar: { title: 'التحليلات', loading: 'جارِ التحميل...', premiumOnly: 'حصري للبريميوم', winRateByMode: 'معدل الفوز حسب الوضع', winRateByBrawler: 'معدل الفوز حسب البطل', bestTeammates: 'أفضل زملاء الفريق', sortGames: 'مباريات', sortWR: 'معدل', games: 'مباريات', winRate: 'معدل الفوز', trophies: 'الكؤوس', battles: 'المعارك', totalBattles: '{count} معارك محللة' },
  ko: { title: '분석', loading: '로딩 중...', premiumOnly: '프리미엄 전용', winRateByMode: '모드별 승률', winRateByBrawler: '브롤러별 승률', bestTeammates: '최고의 팀원', sortGames: '게임', sortWR: '승률', games: '게임', winRate: '승률', trophies: '트로피', battles: '전투', totalBattles: '{count}개 전투 분석됨' },
  ja: { title: 'アナリティクス', loading: '読み込み中...', premiumOnly: 'プレミアム専用', winRateByMode: 'モード別勝率', winRateByBrawler: 'ブロウラー別勝率', bestTeammates: 'ベストチームメイト', sortGames: '試合', sortWR: '勝率', games: '試合', winRate: '勝率', trophies: 'トロフィー', battles: 'バトル', totalBattles: '{count}バトル分析済み' },
  zh: { title: '数据分析', loading: '加载中...', premiumOnly: '仅限高级版', winRateByMode: '按模式胜率', winRateByBrawler: '按英雄胜率', bestTeammates: '最佳队友', sortGames: '场次', sortWR: '胜率', games: '场', winRate: '胜率', trophies: '奖杯', battles: '战斗', totalBattles: '已分析 {count} 场战斗' },
};

const PREMIUM_EXTRA = {
  es: { teaserTitle: 'Historial completo', teaserSubtitle: 'Desbloquea historial ilimitado + analytics desde \\$2.99/mes', upgradeButton: 'Activar Premium', registerButton: 'Crear cuenta gratis' },
  en: { teaserTitle: 'Full battle history', teaserSubtitle: 'Unlock unlimited history + analytics from \\$2.99/mo', upgradeButton: 'Activate Premium', registerButton: 'Create free account' },
  fr: { teaserTitle: 'Historique complet', teaserSubtitle: 'Débloquez l\\'historique illimité + analyses à partir de 2,99\\$/mois', upgradeButton: 'Activer Premium', registerButton: 'Créer un compte gratuit' },
  pt: { teaserTitle: 'Histórico completo', teaserSubtitle: 'Desbloqueie histórico ilimitado + análises a partir de \\$2,99/mês', upgradeButton: 'Ativar Premium', registerButton: 'Criar conta grátis' },
  de: { teaserTitle: 'Vollständiger Verlauf', teaserSubtitle: 'Unbegrenzter Verlauf + Analysen ab 2,99\\$/Monat', upgradeButton: 'Premium aktivieren', registerButton: 'Kostenloses Konto erstellen' },
  it: { teaserTitle: 'Storico completo', teaserSubtitle: 'Sblocca storico illimitato + analisi da 2,99\\$/mese', upgradeButton: 'Attiva Premium', registerButton: 'Crea account gratuito' },
  ru: { teaserTitle: 'Полная история', teaserSubtitle: 'Безлимитная история + аналитика от \\$2.99/мес', upgradeButton: 'Активировать Премиум', registerButton: 'Создать бесплатный аккаунт' },
  tr: { teaserTitle: 'Tam geçmiş', teaserSubtitle: 'Sınırsız geçmiş + analizler \\$2.99/ay\\'dan', upgradeButton: 'Premium\\'u Etkinleştir', registerButton: 'Ücretsiz hesap oluştur' },
  pl: { teaserTitle: 'Pełna historia', teaserSubtitle: 'Odblokuj nieograniczoną historię + analizy od \\$2.99/mies.', upgradeButton: 'Aktywuj Premium', registerButton: 'Utwórz darmowe konto' },
  ar: { teaserTitle: 'السجل الكامل', teaserSubtitle: 'افتح سجل غير محدود + تحليلات من \\$2.99/شهر', upgradeButton: 'تفعيل بريميوم', registerButton: 'إنشاء حساب مجاني' },
  ko: { teaserTitle: '전체 전투 기록', teaserSubtitle: '무제한 기록 + 분석 월 \\$2.99부터', upgradeButton: '프리미엄 활성화', registerButton: '무료 계정 만들기' },
  ja: { teaserTitle: '完全なバトル履歴', teaserSubtitle: '無制限履歴 + 分析 月\\$2.99から', upgradeButton: 'プレミアム有効化', registerButton: '無料アカウント作成' },
  zh: { teaserTitle: '完整战斗历史', teaserSubtitle: '解锁无限历史 + 分析 \\$2.99/月起', upgradeButton: '激活高级版', registerButton: '创建免费账户' },
};

const PRIVACY = {
  es: { title: 'Política de Privacidad', dataCollectedTitle: 'Datos que recopilamos', dataTag: 'Tu tag de jugador de Brawl Stars', dataBattles: 'Historial de batallas (para usuarios Premium)', dataEmail: 'Correo electrónico de tu cuenta de Google (para autenticación)', thirdPartyTitle: 'Datos de otros jugadores', thirdPartyBody: 'Los datos de compañeros de equipo y rivales provienen de la API pública de Supercell. Se almacenan para analytics agregados, no para identificación individual.', retentionTitle: 'Retención de datos', retentionBody: 'Las batallas almacenadas durante una suscripción activa se conservan indefinidamente, incluso tras la cancelación. Si solicitas la eliminación de tus datos, contacta con nosotros.', gdprTitle: 'Derechos GDPR', gdprBody: 'Puedes solicitar exportación o eliminación de tus datos enviando un email a privacy@brawlvision.com.', cookiesTitle: 'Cookies', cookiesBody: 'Usamos localStorage para caché de datos del juego y cookies de sesión de Supabase Auth. Google AdSense puede establecer cookies de publicidad para usuarios gratuitos.', disclaimerTitle: 'Aviso legal', disclaimerBody: 'BrawlVision no está afiliado con, respaldado, patrocinado o aprobado por Supercell Oy. Brawl Stars es una marca registrada de Supercell.' },
  en: { title: 'Privacy Policy', dataCollectedTitle: 'Data we collect', dataTag: 'Your Brawl Stars player tag', dataBattles: 'Battle history (for Premium users)', dataEmail: 'Google account email (for authentication)', thirdPartyTitle: 'Third-party player data', thirdPartyBody: 'Teammate and opponent data comes from Supercell\\'s public API. It is stored for aggregate analytics, not individual identification.', retentionTitle: 'Data retention', retentionBody: 'Battles stored during an active subscription are preserved indefinitely, even after cancellation. Contact us to request data deletion.', gdprTitle: 'GDPR Rights', gdprBody: 'You may request data export or deletion by emailing privacy@brawlvision.com.', cookiesTitle: 'Cookies', cookiesBody: 'We use localStorage for game data caching and Supabase Auth session cookies. Google AdSense may set advertising cookies for free users.', disclaimerTitle: 'Legal disclaimer', disclaimerBody: 'BrawlVision is not affiliated with, endorsed, sponsored, or approved by Supercell Oy. Brawl Stars is a trademark of Supercell.' },
};

// Only add es + en for privacy (add others similarly)
const dir = path.join(__dirname, 'messages');
const locales = ['es','en','fr','pt','de','it','ru','tr','pl','ar','ko','ja','zh'];

for (const locale of locales) {
  const filePath = path.join(dir, locale + '.json');
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  content.analytics = ANALYTICS[locale] || ANALYTICS.en;
  // Merge premium extras
  content.premium = { ...(content.premium || {}), ...(PREMIUM_EXTRA[locale] || PREMIUM_EXTRA.en) };
  // Privacy (use en as fallback for non-es/en)
  content.privacy = PRIVACY[locale] || PRIVACY.en;
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\\n');
}
console.log('Done: analytics + privacy namespaces added');
"
```

- [ ] **Step 2: Commit**

```bash
git add messages/
git commit -m "i18n: add analytics, premium teaser, and privacy namespaces (13 locales)"
```

---

### Task 8: Full Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`

Expected: All tests pass, including new ones:
- `integration/api/battles.test.ts` (3 tests)
- `unit/hooks/useAnalytics.test.ts` (6 tests)

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Build**

Run: `npm run build`

- [ ] **Step 4: Final commit if fixes needed**

```bash
git add -A
git commit -m "chore: fix lint/type/build issues from Plan 4"
```
