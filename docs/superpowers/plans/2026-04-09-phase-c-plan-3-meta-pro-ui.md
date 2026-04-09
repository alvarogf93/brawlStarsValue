# Phase C: Pro Meta Analytics — Meta PRO UI Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Meta PRO tab with all sub-components, add inline PRO badges in existing analytics tabs, and add the `metaPro` translation namespace to all 13 locales.

**Architecture:** The Meta PRO tab is added as the 7th tab in the analytics page. It consists of a container component (`MetaProTab`) that uses `useProAnalysis` to fetch data, with a `MapSelector` for map/mode selection. Public sections (TopBrawlersGrid, TrendingSection, CounterQuickView) are visible to all users. Premium sections (ProTrendChart, ProTrioGrid, GapAnalysisCards, MatchupGapTable) are wrapped in `PremiumGate`. Inline `ProBadge` components are added to 5 existing analytics tabs. All text uses `next-intl` with the `metaPro` namespace.

**Tech Stack:** React, Next.js 16, next-intl, Tailwind CSS, framer-motion, SVG charts (custom), `useMapImages` hook

**Spec reference:** `docs/superpowers/specs/2026-04-09-phase-c-pro-meta-analytics-design.md`

**Dependency:** Plan 2 (pro analysis API) must be complete — requires `/api/meta/pro-analysis` endpoint and `useProAnalysis` hook

---

## Task 1: ProBadge reusable component

Shared component that displays PRO win rate data inline, with optional user comparison.

### Steps

- [ ] **1.1** Create the component:

**File:** `src/components/analytics/ProBadge.tsx`

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface ProBadgeProps {
  proValue: number    // PRO win rate (e.g., 62.1)
  userValue?: number  // User's win rate — if provided, shows gap indicator
  total: number       // PRO sample size (for tooltip)
  compact?: boolean   // true = inline text, false = full badge with tooltip
}

export function ProBadge({ proValue, userValue, total, compact = false }: ProBadgeProps) {
  const t = useTranslations('metaPro')
  const [showTooltip, setShowTooltip] = useState(false)

  const gap = userValue !== undefined ? userValue - proValue : null
  const gapColor = gap !== null
    ? gap > 3 ? 'text-green-400' : gap < -3 ? 'text-red-400' : 'text-[#FFC91B]'
    : ''
  const gapArrow = gap !== null
    ? gap > 3 ? '\u2191' : gap < -3 ? '\u2193' : '\u2014'
    : ''

  if (compact) {
    return (
      <span className="text-[#FFC91B] text-[10px] font-bold tracking-wide whitespace-nowrap">
        PRO {proValue.toFixed(1)}%
      </span>
    )
  }

  return (
    <div
      className="relative inline-flex items-center gap-1"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onTouchStart={() => setShowTooltip(prev => !prev)}
    >
      {/* Badge pill */}
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFC91B]/15 border border-[#FFC91B]/30">
        <span className="text-[#FFC91B] text-[10px] font-bold">PRO</span>
        <span className="text-white text-[10px] font-bold tabular-nums">
          {proValue.toFixed(1)}%
        </span>
        {gap !== null && (
          <span className={`text-[10px] font-bold ${gapColor}`}>
            {gapArrow}
          </span>
        )}
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-[#0D1321] border border-[#1E293B] rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
            <p className="text-[10px] text-slate-400">
              {t('proBadgeTooltip', { count: String(total) })}
            </p>
            <p className="text-xs font-bold text-[#FFC91B]">
              {t('proWR', { wr: proValue.toFixed(1) })}
            </p>
            {userValue !== undefined && (
              <>
                <p className="text-xs font-bold text-white">
                  {t('yourWR', { wr: userValue.toFixed(1) })}
                </p>
                <p className={`text-xs font-bold ${gapColor}`}>
                  {gap !== null && gap > 0 ? '+' : ''}{gap?.toFixed(1)}pp
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **1.2** Verify it compiles:

```bash
npx tsc --noEmit
```

- [ ] **1.3** Commit:

```bash
git add src/components/analytics/ProBadge.tsx
git commit -m "feat(ui): add ProBadge reusable component

Displays PRO win rate inline with optional user comparison.
Compact mode for tight spaces, full mode with tooltip."
```

---

## Task 2: MapSelector for Meta PRO tab

Map/mode selector with live maps (free) and historical maps (premium-gated). Fetches current rotation from `/api/events`.

### Steps

- [ ] **2.1** Create the component:

**File:** `src/components/analytics/MapSelector.tsx`

```tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useMapImages } from '@/hooks/useMapImages'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import type { Profile } from '@/lib/supabase/types'
import { ModeIcon } from '@/components/ui/ModeIcon'
import { Crown, Lock } from 'lucide-react'

interface MapOption {
  map: string
  mode: string
  imageUrl?: string
  isLive: boolean
}

interface MapSelectorProps {
  selectedMap: string | null
  selectedMode: string | null
  onSelect: (map: string, mode: string) => void
}

export function MapSelector({ selectedMap, selectedMode, onSelect }: MapSelectorProps) {
  const t = useTranslations('metaPro')
  const { profile } = useAuth()
  const hasPremium = isPremium(profile as Profile | null)
  const mapImages = useMapImages()

  const [maps, setMaps] = useState<MapOption[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch live events
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/events', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then((events: Array<{ map: string; mode: string }>) => {
        const liveMaps: MapOption[] = events
          .filter(e => e.map && e.mode)
          .map(e => ({
            map: e.map,
            mode: e.mode,
            imageUrl: mapImages[e.map],
            isLive: true,
          }))
        setMaps(liveMaps)
        setLoading(false)

        // Auto-select first live map if none selected
        if (!selectedMap && liveMaps.length > 0) {
          onSelect(liveMaps[0].map, liveMaps[0].mode)
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') setLoading(false)
      })
    return () => controller.abort()
  }, [mapImages]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="brawl-card-dark p-4 border-[#090E17]">
        <div className="h-8 w-48 bg-white/5 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-4 md:p-5 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-sm text-slate-400 mb-3 uppercase tracking-wider">
        {t('mapSelectorTitle')}
      </h3>

      {/* Live maps section */}
      <div className="mb-4">
        <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-2">
          {t('liveMaps')}
        </p>
        <div className="flex flex-wrap gap-2">
          {maps.filter(m => m.isLive).map(m => (
            <button
              key={`${m.map}-${m.mode}`}
              onClick={() => onSelect(m.map, m.mode)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-['Lilita_One'] transition-all border-2 ${
                selectedMap === m.map && selectedMode === m.mode
                  ? 'bg-[#FFC91B]/20 text-[#FFC91B] border-[#FFC91B]/40 shadow-[0_0_12px_rgba(255,201,27,0.15)]'
                  : 'bg-[#0F172A] text-slate-300 border-[#1E293B] hover:bg-[#1E293B] hover:text-white'
              }`}
            >
              <ModeIcon mode={m.mode} size={16} />
              <span className="truncate max-w-[120px]">{m.map}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Historical maps section (premium-gated) */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          {t('historicalMaps')}
          {!hasPremium && <Lock className="w-3 h-3" />}
        </p>
        {!hasPremium ? (
          <p className="text-xs text-slate-600 italic">{t('historicalLocked')}</p>
        ) : (
          <p className="text-xs text-slate-500 italic">
            {/* Historical maps will be populated from meta_stats distinct maps */}
            {t('historicalMaps')}
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **2.2** Commit:

```bash
git add src/components/analytics/MapSelector.tsx
git commit -m "feat(ui): add MapSelector component for Meta PRO tab

Live map buttons with mode icons, auto-selects first map.
Historical maps section with premium gate."
```

---

## Task 3: TopBrawlersGrid component

Grid showing top 5-10 brawlers with WR, pick rate, and trend badges.

### Steps

- [ ] **3.1** Create the component:

**File:** `src/components/analytics/TopBrawlersGrid.tsx`

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { TopBrawlerEntry } from '@/lib/draft/pro-analysis'

interface Props {
  brawlers: TopBrawlerEntry[]
  totalBattles: number
}

function TrendBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null
  if (delta > 2) {
    return (
      <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-md">
        {'\u2191'}{delta.toFixed(1)}%
      </span>
    )
  }
  if (delta < -2) {
    return (
      <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-md">
        {'\u2193'}{Math.abs(delta).toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-md">
      {'\u2014'}
    </span>
  )
}

export function TopBrawlersGrid({ brawlers, totalBattles }: Props) {
  const t = useTranslations('metaPro')

  if (brawlers.length === 0) {
    return (
      <div className="brawl-card-dark p-5 border-[#090E17] text-center">
        <p className="text-sm text-slate-500">{t('noDataForMap')}</p>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
          <span className="text-xl">{'\uD83C\uDFC6'}</span> {t('topBrawlersTitle')}
        </h3>
        <span className="text-[10px] text-slate-500 font-bold">
          {t('totalBattles', { count: String(totalBattles) })}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {brawlers.map((b, i) => (
          <div
            key={b.brawlerId}
            className="brawl-row rounded-xl p-3 flex flex-col items-center gap-2 relative"
          >
            {/* Rank badge */}
            {i < 3 && (
              <span className="absolute top-1.5 left-2 text-sm">
                {i === 0 ? '\uD83E\uDD47' : i === 1 ? '\uD83E\uDD48' : '\uD83E\uDD49'}
              </span>
            )}

            {/* Brawler portrait */}
            <BrawlImg
              src={getBrawlerPortraitUrl(b.brawlerId)}
              fallbackSrc={getBrawlerPortraitFallback(b.brawlerId)}
              alt={b.name}
              className="w-12 h-12 rounded-lg ring-2 ring-[#090E17]"
            />

            {/* Name */}
            <p className="font-['Lilita_One'] text-xs text-white truncate max-w-full">
              {b.name}
            </p>

            {/* Win rate */}
            <p className={`font-['Lilita_One'] text-lg tabular-nums ${wrColor(b.winRate)}`}>
              {b.winRate.toFixed(1)}%
            </p>

            {/* Pick rate */}
            <p className="text-[10px] text-slate-500 tabular-nums">
              {b.pickRate.toFixed(1)}% picks
            </p>

            {/* Trend badge */}
            <TrendBadge delta={b.trend7d} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **3.2** Commit:

```bash
git add src/components/analytics/TopBrawlersGrid.tsx
git commit -m "feat(ui): add TopBrawlersGrid component

Grid of top brawlers with portraits, Bayesian WR, pick rate,
and 7d trend badges (rising/falling/stable)."
```

---

## Task 4: TrendingSection component

Two-column layout showing rising and falling brawlers.

### Steps

- [ ] **4.1** Create the component:

**File:** `src/components/analytics/TrendingSection.tsx`

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { TrendEntry } from '@/lib/draft/pro-analysis'

interface Props {
  rising: TrendEntry[]
  falling: TrendEntry[]
}

export function TrendingSection({ rising, falling }: Props) {
  const t = useTranslations('metaPro')

  if (rising.length === 0 && falling.length === 0) return null

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Rising */}
        <div>
          <h4 className="font-['Lilita_One'] text-sm text-green-400 mb-3 flex items-center gap-1.5">
            {t('trendRising')} {'\uD83D\uDCC8'}
          </h4>
          {rising.length === 0 ? (
            <p className="text-xs text-slate-600">{t('trendStable')}</p>
          ) : (
            <div className="space-y-2">
              {rising.map(entry => (
                <div
                  key={entry.brawlerId}
                  className="flex items-center gap-3 brawl-row rounded-xl px-3 py-2"
                >
                  <BrawlImg
                    src={getBrawlerPortraitUrl(entry.brawlerId)}
                    fallbackSrc={getBrawlerPortraitFallback(entry.brawlerId)}
                    alt={entry.name}
                    className="w-8 h-8 rounded-lg"
                  />
                  <span className="font-['Lilita_One'] text-xs text-white flex-1 truncate">
                    {entry.name}
                  </span>
                  <span className="text-xs font-bold text-green-400 tabular-nums">
                    +{entry.delta7d.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Falling */}
        <div>
          <h4 className="font-['Lilita_One'] text-sm text-red-400 mb-3 flex items-center gap-1.5">
            {t('trendFalling')} {'\uD83D\uDCC9'}
          </h4>
          {falling.length === 0 ? (
            <p className="text-xs text-slate-600">{t('trendStable')}</p>
          ) : (
            <div className="space-y-2">
              {falling.map(entry => (
                <div
                  key={entry.brawlerId}
                  className="flex items-center gap-3 brawl-row rounded-xl px-3 py-2"
                >
                  <BrawlImg
                    src={getBrawlerPortraitUrl(entry.brawlerId)}
                    fallbackSrc={getBrawlerPortraitFallback(entry.brawlerId)}
                    alt={entry.name}
                    className="w-8 h-8 rounded-lg"
                  />
                  <span className="font-['Lilita_One'] text-xs text-white flex-1 truncate">
                    {entry.name}
                  </span>
                  <span className="text-xs font-bold text-red-400 tabular-nums">
                    {entry.delta7d.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **4.2** Commit:

```bash
git add src/components/analytics/TrendingSection.tsx
git commit -m "feat(ui): add TrendingSection component

Two-column rising/falling brawler trends with delta percentages."
```

---

## Task 5: CounterQuickView component

"If enemy picks X, play Y" cards for quick counter-pick reference.

### Steps

- [ ] **5.1** Create the component:

**File:** `src/components/analytics/CounterQuickView.tsx`

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { CounterEntry } from '@/lib/draft/pro-analysis'

interface Props {
  counters: CounterEntry[]
  isPremium: boolean
}

export function CounterQuickView({ counters, isPremium }: Props) {
  const t = useTranslations('metaPro')
  const [expanded, setExpanded] = useState(false)

  if (counters.length === 0) return null

  // Free users: show top 3, premium: show all (with expand)
  const INITIAL_LIMIT = isPremium ? 6 : 3
  const displayed = expanded ? counters : counters.slice(0, INITIAL_LIMIT)
  const hasMore = counters.length > INITIAL_LIMIT

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">{'\u2694\uFE0F'}</span> {t('counterTitle')}
      </h3>

      <div className="space-y-3">
        {displayed.map(entry => (
          <div key={entry.brawlerId} className="brawl-row rounded-xl p-3">
            {/* "If enemy picks X, play:" */}
            <div className="flex items-center gap-2 mb-2">
              <BrawlImg
                src={getBrawlerPortraitUrl(entry.brawlerId)}
                fallbackSrc={getBrawlerPortraitFallback(entry.brawlerId)}
                alt={entry.name}
                className="w-7 h-7 rounded-lg"
              />
              <p className="text-[11px] text-slate-400">
                {t('counterHint', { name: entry.name })}
              </p>
            </div>

            {/* Best counters row */}
            <div className="flex flex-wrap gap-2">
              {entry.bestCounters.slice(0, 3).map(counter => (
                <div
                  key={counter.opponentId}
                  className="flex items-center gap-1.5 bg-[#0D1321] rounded-lg px-2 py-1.5"
                >
                  <BrawlImg
                    src={getBrawlerPortraitUrl(counter.opponentId)}
                    fallbackSrc={getBrawlerPortraitFallback(counter.opponentId)}
                    alt={counter.name}
                    className="w-6 h-6 rounded-md"
                  />
                  <span className="font-['Lilita_One'] text-[11px] text-white truncate max-w-[60px]">
                    {counter.name}
                  </span>
                  <span className={`text-[10px] font-bold tabular-nums ${wrColor(counter.winRate)}`}>
                    {counter.winRate.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="mt-3 w-full py-2 text-xs font-bold text-slate-400 hover:text-[#FFC91B] transition-colors rounded-lg bg-white/[0.02] hover:bg-white/[0.04]"
        >
          {expanded ? t('trendStable') : `+${counters.length - INITIAL_LIMIT} more`}
        </button>
      )}
    </div>
  )
}
```

- [ ] **5.2** Commit:

```bash
git add src/components/analytics/CounterQuickView.tsx
git commit -m "feat(ui): add CounterQuickView component

Counter-pick cards showing best responses per brawler.
Limited for free users, expandable for premium."
```

---

## Task 6: ProTrendChart component (premium)

Interactive 30-day line chart showing daily win rate trends for top brawlers. Uses the custom SVG chart pattern from `TrendsChart.tsx`.

### Steps

- [ ] **6.1** Create the component:

**File:** `src/components/analytics/ProTrendChart.tsx`

```tsx
'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { DailyTrendEntry, TopBrawlerEntry } from '@/lib/draft/pro-analysis'

interface Props {
  dailyTrend: DailyTrendEntry[]
  topBrawlers: TopBrawlerEntry[]
}

// Chart constants (matching TrendsChart pattern)
const PAD = { top: 10, right: 20, bottom: 30, left: 40 } as const
const CHART_W = 600
const CHART_H = 200
const INNER_W = CHART_W - PAD.left - PAD.right
const INNER_H = CHART_H - PAD.top - PAD.bottom

const COLORS = ['#FFC91B', '#4EC0FA', '#4ade80', '#f472b6', '#a78bfa']

function formatLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
}

function pickLabelIndices(total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  const target = 6
  const step = (total - 1) / (target - 1)
  const indices: number[] = []
  for (let i = 0; i < target; i++) indices.push(Math.round(i * step))
  return indices
}

export function ProTrendChart({ dailyTrend, topBrawlers }: Props) {
  const t = useTranslations('metaPro')
  const top5Ids = useMemo(() => topBrawlers.slice(0, 5).map(b => b.brawlerId), [topBrawlers])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(top5Ids.slice(0, 3)))

  const toggleBrawler = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Build per-brawler daily data
  const brawlerSeries = useMemo(() => {
    const series = new Map<number, Array<{ date: string; wr: number }>>()
    for (const id of top5Ids) series.set(id, [])

    for (const day of dailyTrend) {
      for (const b of day.brawlers) {
        if (top5Ids.includes(b.brawlerId)) {
          series.get(b.brawlerId)?.push({ date: day.date, wr: b.winRate })
        }
      }
    }
    return series
  }, [dailyTrend, top5Ids])

  if (dailyTrend.length === 0) return null

  const dates = dailyTrend.map(d => d.date)
  const labelIndices = pickLabelIndices(dates.length)

  const toX = (i: number) =>
    PAD.left + (dates.length === 1 ? INNER_W / 2 : (i / (dates.length - 1)) * INNER_W)

  // Y scale: 30-70% range for win rate focus
  const yMin = 30
  const yMax = 70
  const yTicks = [30, 40, 50, 60, 70]
  const toY = (v: number) => PAD.top + INNER_H - ((v - yMin) / (yMax - yMin)) * INNER_H

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">{'\uD83D\uDCC8'}</span> PRO Trends (30d)
      </h3>

      {/* Legend / brawler selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {top5Ids.map((id, idx) => {
          const b = topBrawlers.find(x => x.brawlerId === id)
          if (!b) return null
          const isActive = selectedIds.has(id)
          return (
            <button
              key={id}
              onClick={() => toggleBrawler(id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                isActive
                  ? 'border-white/20 bg-white/5'
                  : 'border-transparent bg-transparent opacity-40'
              }`}
            >
              <BrawlImg
                src={getBrawlerPortraitUrl(id)}
                fallbackSrc={getBrawlerPortraitFallback(id)}
                alt={b.name}
                className="w-5 h-5 rounded"
              />
              <span style={{ color: COLORS[idx] }}>{b.name}</span>
            </button>
          )
        })}
      </div>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y-axis grid */}
        {yTicks.map(tick => (
          <g key={tick}>
            <line
              x1={PAD.left} y1={toY(tick)}
              x2={CHART_W - PAD.right} y2={toY(tick)}
              stroke="#1e293b" strokeWidth={0.5}
            />
            <text x={PAD.left - 6} y={toY(tick) + 3} textAnchor="end" fontSize={9} fill="#64748b">
              {tick}%
            </text>
          </g>
        ))}

        {/* 50% reference line */}
        <line
          x1={PAD.left} y1={toY(50)}
          x2={CHART_W - PAD.right} y2={toY(50)}
          stroke="#64748b" strokeWidth={1} strokeDasharray="6 4" opacity={0.6}
        />

        {/* X-axis labels */}
        {labelIndices.map(idx => (
          <text key={idx} x={toX(idx)} y={CHART_H - 4} textAnchor="middle" fontSize={9} fill="#64748b">
            {formatLabel(dates[idx])}
          </text>
        ))}

        {/* Data lines per brawler */}
        {top5Ids.map((id, colorIdx) => {
          if (!selectedIds.has(id)) return null
          const series = brawlerSeries.get(id) ?? []
          if (series.length < 2) return null

          // Map series dates to x positions
          const points = series.map(s => {
            const dateIdx = dates.indexOf(s.date)
            if (dateIdx === -1) return null
            return { x: toX(dateIdx), y: toY(Math.max(yMin, Math.min(yMax, s.wr))) }
          }).filter(Boolean) as Array<{ x: number; y: number }>

          return (
            <g key={id}>
              {points.map((p, i) => {
                if (i === 0) return null
                const prev = points[i - 1]
                return (
                  <line
                    key={i}
                    x1={prev.x} y1={prev.y}
                    x2={p.x} y2={p.y}
                    stroke={COLORS[colorIdx]}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                )
              })}
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill={COLORS[colorIdx]} stroke="#0D1321" strokeWidth={1} />
              ))}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
```

- [ ] **6.2** Commit:

```bash
git add src/components/analytics/ProTrendChart.tsx
git commit -m "feat(ui): add ProTrendChart component (premium)

Interactive 30d SVG line chart showing daily WR trends for
top 5 brawlers with selectable legend. Custom SVG pattern."
```

---

## Task 7: ProTrioGrid component (premium, with map background)

Grid of top trio compositions using the same card layout as `TeamSynergyView`.

### Steps

- [ ] **7.1** Create the component:

**File:** `src/components/analytics/ProTrioGrid.tsx`

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { useMapImages } from '@/hooks/useMapImages'
import type { ProTrioEntry } from '@/lib/draft/pro-analysis'

interface Props {
  trios: ProTrioEntry[]
  mapName: string
}

function medal(i: number): string {
  if (i === 0) return '\uD83E\uDD47'
  if (i === 1) return '\uD83E\uDD48'
  if (i === 2) return '\uD83E\uDD49'
  return ''
}

export function ProTrioGrid({ trios, mapName }: Props) {
  const t = useTranslations('metaPro')
  const mapImages = useMapImages()
  const mapImageUrl = mapImages[mapName] ?? null

  if (trios.length === 0) {
    return (
      <div className="brawl-card-dark p-5 border-[#090E17] text-center">
        <p className="text-sm text-slate-500">{t('noDataForMap')}</p>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">{'\uD83E\uDD1D'}</span> {t('proTriosTitle')}
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {trios.map((trio, i) => (
          <div
            key={trio.brawlers.map(b => b.id).join('-')}
            className="relative rounded-xl overflow-hidden border border-white/10"
          >
            {/* Map background */}
            {mapImageUrl && (
              <>
                <img
                  src={mapImageUrl}
                  alt={mapName}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E1A] via-[#0A0E1A]/75 to-[#0A0E1A]/30" />
              </>
            )}

            {/* Content */}
            <div className={`relative p-3 flex flex-col items-center gap-2 ${!mapImageUrl ? 'brawl-row' : ''}`}>
              {/* Medal */}
              {i < 3 && (
                <span className="absolute top-1.5 left-2 text-sm">{medal(i)}</span>
              )}

              {/* 3 brawler portraits */}
              <div className="flex items-center -space-x-1.5">
                {trio.brawlers.map(b => (
                  <BrawlImg
                    key={b.id}
                    src={getBrawlerPortraitUrl(b.id)}
                    fallbackSrc={getBrawlerPortraitFallback(b.id)}
                    alt={b.name}
                    className="w-9 h-9 rounded-lg ring-2 ring-[#090E17]"
                  />
                ))}
              </div>

              {/* Win rate */}
              <span className={`font-['Lilita_One'] text-lg tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${wrColor(trio.winRate)}`}>
                {trio.winRate.toFixed(1)}%
              </span>

              {/* Total games */}
              <span className="text-[10px] text-slate-400">
                {trio.total} {t('totalBattles', { count: String(trio.total) }).split(' ').slice(-2).join(' ')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **7.2** Commit:

```bash
git add src/components/analytics/ProTrioGrid.tsx
git commit -m "feat(ui): add ProTrioGrid component (premium)

Top trio compositions with map background, brawler portraits,
Bayesian WR, and medal badges. Follows TeamSynergyView layout."
```

---

## Task 8: GapAnalysisCards component (premium)

Cards showing user vs PRO win rate gap for each brawler, sorted by worst gaps first.

### Steps

- [ ] **8.1** Create the component:

**File:** `src/components/analytics/GapAnalysisCards.tsx`

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { GapEntry } from '@/lib/draft/pro-analysis'

interface Props {
  gaps: GapEntry[]
}

function verdictBadge(verdict: 'above' | 'below' | 'on-par', t: (key: string) => string) {
  switch (verdict) {
    case 'above':
      return (
        <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
          {t('gapAbove')}
        </span>
      )
    case 'below':
      return (
        <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
          {t('gapBelow')}
        </span>
      )
    case 'on-par':
      return (
        <span className="text-[10px] font-bold text-[#FFC91B] bg-[#FFC91B]/10 px-2 py-0.5 rounded-full">
          {t('gapOnPar')}
        </span>
      )
  }
}

export function GapAnalysisCards({ gaps }: Props) {
  const t = useTranslations('metaPro')

  if (gaps.length === 0) {
    return (
      <div className="brawl-card-dark p-5 border-[#090E17] text-center">
        <p className="text-sm text-slate-500">{t('noDataForMap')}</p>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-2 flex items-center gap-2">
        <span className="text-xl">{'\uD83C\uDFAF'}</span> {t('gapTitle')}
      </h3>
      <p className="text-[10px] text-slate-500 mb-4">{t('gapImprove')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {gaps.map(g => (
          <div
            key={g.brawlerId}
            className="flex items-center gap-3 brawl-row rounded-xl px-4 py-3"
          >
            <BrawlImg
              src={getBrawlerPortraitUrl(g.brawlerId)}
              fallbackSrc={getBrawlerPortraitFallback(g.brawlerId)}
              alt={g.name}
              className="w-10 h-10 rounded-lg"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-['Lilita_One'] text-xs text-white truncate">{g.name}</p>
                {verdictBadge(g.verdict, t)}
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-white">
                  {t('yourWR', { wr: g.yourWR.toFixed(1) })}
                  <span className="text-slate-600 ml-1">({g.yourTotal})</span>
                </span>
                <span className="text-[#FFC91B]">
                  {t('proWR', { wr: g.proWR.toFixed(1) })}
                  <span className="text-slate-600 ml-1">({g.proTotal})</span>
                </span>
              </div>
            </div>

            {/* Gap number */}
            <span className={`font-['Lilita_One'] text-sm tabular-nums ${
              g.gap > 3 ? 'text-green-400' : g.gap < -3 ? 'text-red-400' : 'text-[#FFC91B]'
            }`}>
              {g.gap > 0 ? '+' : ''}{g.gap.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **8.2** Commit:

```bash
git add src/components/analytics/GapAnalysisCards.tsx
git commit -m "feat(ui): add GapAnalysisCards component (premium)

User vs PRO win rate gap cards with verdict badges (above/on-par/below).
Sorted by worst gaps first for improvement opportunities."
```

---

## Task 9: MatchupGapTable component (premium)

Compact table showing matchup deviations from PRO meta.

### Steps

- [ ] **9.1** Create the component:

**File:** `src/components/analytics/MatchupGapTable.tsx`

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { MatchupGapEntry } from '@/lib/draft/pro-analysis'

interface Props {
  gaps: MatchupGapEntry[]
}

type SortField = 'gap' | 'yourWR' | 'proWR'

export function MatchupGapTable({ gaps }: Props) {
  const t = useTranslations('metaPro')
  const [sortBy, setSortBy] = useState<SortField>('gap')

  if (gaps.length === 0) {
    return (
      <div className="brawl-card-dark p-5 border-[#090E17] text-center">
        <p className="text-sm text-slate-500">{t('noDataForMap')}</p>
      </div>
    )
  }

  const sorted = [...gaps].sort((a, b) => {
    switch (sortBy) {
      case 'gap': return a.gap - b.gap
      case 'yourWR': return a.yourWR - b.yourWR
      case 'proWR': return b.proWR - a.proWR
      default: return a.gap - b.gap
    }
  })

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-2 flex items-center gap-2">
        <span className="text-xl">{'\u2694\uFE0F'}</span> {t('matchupGapTitle')}
      </h3>
      <p className="text-[10px] text-slate-500 mb-4">{t('matchupGapHint')}</p>

      {/* Sort controls */}
      <div className="flex gap-1 mb-3">
        {(['gap', 'yourWR', 'proWR'] as SortField[]).map(field => (
          <button
            key={field}
            onClick={() => setSortBy(field)}
            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${
              sortBy === field
                ? 'bg-[#FFC91B]/20 text-[#FFC91B]'
                : 'text-slate-500 hover:text-white'
            }`}
          >
            {field === 'gap' ? 'Gap' : field === 'yourWR' ? 'Your WR' : 'PRO WR'}
          </button>
        ))}
      </div>

      {/* Table rows */}
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {sorted.slice(0, 20).map((g, i) => (
          <div
            key={`${g.brawlerId}-${g.opponentId}`}
            className="flex items-center gap-2 brawl-row rounded-lg px-3 py-2"
          >
            {/* Your brawler */}
            <BrawlImg
              src={getBrawlerPortraitUrl(g.brawlerId)}
              fallbackSrc={getBrawlerPortraitFallback(g.brawlerId)}
              alt={g.brawlerName}
              className="w-6 h-6 rounded-md"
            />
            <span className="text-[10px] text-slate-400">vs</span>
            {/* Opponent */}
            <BrawlImg
              src={getBrawlerPortraitUrl(g.opponentId)}
              fallbackSrc={getBrawlerPortraitFallback(g.opponentId)}
              alt={g.opponentName}
              className="w-6 h-6 rounded-md"
            />

            {/* Names */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-300 truncate">
                {g.brawlerName} vs {g.opponentName}
              </p>
            </div>

            {/* WRs */}
            <span className={`text-[10px] font-bold tabular-nums ${wrColor(g.yourWR)}`}>
              {g.yourWR.toFixed(0)}%
            </span>
            <span className="text-[10px] text-slate-600">/</span>
            <span className="text-[10px] font-bold text-[#FFC91B] tabular-nums">
              {g.proWR.toFixed(0)}%
            </span>

            {/* Gap */}
            <span className={`text-[10px] font-bold tabular-nums w-12 text-right ${
              g.gap > 3 ? 'text-green-400' : g.gap < -3 ? 'text-red-400' : 'text-slate-400'
            }`}>
              {g.gap > 0 ? '+' : ''}{g.gap.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **9.2** Commit:

```bash
git add src/components/analytics/MatchupGapTable.tsx
git commit -m "feat(ui): add MatchupGapTable component (premium)

Compact sortable table of user vs PRO matchup deviations.
Sort by gap, your WR, or PRO WR."
```

---

## Task 10: MetaProTab container + wire into analytics page

Creates the container component and adds it as the 7th tab.

### Steps

- [ ] **10.1** Create the MetaProTab container:

**File:** `src/components/analytics/MetaProTab.tsx`

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useProAnalysis } from '@/hooks/useProAnalysis'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import type { Profile } from '@/lib/supabase/types'
import { PremiumGate } from '@/components/premium/PremiumGate'
import { UpgradeCard } from '@/components/premium/UpgradeCard'
import { MapSelector } from '@/components/analytics/MapSelector'
import { TopBrawlersGrid } from '@/components/analytics/TopBrawlersGrid'
import { TrendingSection } from '@/components/analytics/TrendingSection'
import { CounterQuickView } from '@/components/analytics/CounterQuickView'
import { ProTrendChart } from '@/components/analytics/ProTrendChart'
import { ProTrioGrid } from '@/components/analytics/ProTrioGrid'
import { GapAnalysisCards } from '@/components/analytics/GapAnalysisCards'
import { MatchupGapTable } from '@/components/analytics/MatchupGapTable'

export function MetaProTab() {
  const t = useTranslations('metaPro')
  const { profile } = useAuth()
  const hasPremium = isPremium(profile as Profile | null)

  const [selectedMap, setSelectedMap] = useState<string | null>(null)
  const [selectedMode, setSelectedMode] = useState<string | null>(null)
  const [window, setWindow] = useState(14)

  const { data, loading, error } = useProAnalysis(selectedMap, selectedMode, window)

  const handleMapSelect = (map: string, mode: string) => {
    setSelectedMap(map)
    setSelectedMode(mode)
  }

  return (
    <div className="space-y-6">
      {/* Map Selector */}
      <MapSelector
        selectedMap={selectedMap}
        selectedMode={selectedMode}
        onSelect={handleMapSelect}
      />

      {/* Window selector */}
      {selectedMap && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-bold">{t('windowLabel')}:</span>
          {[7, 14, 30, 90].map(w => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={`px-3 py-1 text-xs font-['Lilita_One'] rounded-lg transition-all border ${
                window === w
                  ? 'bg-[#FFC91B]/20 text-[#FFC91B] border-[#FFC91B]/40'
                  : 'bg-[#0F172A] text-slate-400 border-[#1E293B] hover:text-white'
              }`}
            >
              {t(`window${w}d` as 'window7d' | 'window14d' | 'window30d' | 'window90d')}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="brawl-card-dark p-8 border-[#090E17] text-center">
          <div className="w-8 h-8 border-2 border-[#FFC91B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">{t('mapSelectorTitle')}...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="brawl-card-dark p-5 border-red-500/30 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Data loaded */}
      {data && !loading && (
        <>
          {/* === PUBLIC SECTION === */}
          <TopBrawlersGrid
            brawlers={data.topBrawlers}
            totalBattles={data.totalProBattles}
          />

          <TrendingSection
            rising={data.trending.rising}
            falling={data.trending.falling}
          />

          <CounterQuickView
            counters={data.counters}
            isPremium={hasPremium}
          />

          {/* === PREMIUM SECTION === */}
          <PremiumGate>
            <div className="space-y-6">
              {data.dailyTrend && data.dailyTrend.length > 0 && (
                <ProTrendChart
                  dailyTrend={data.dailyTrend}
                  topBrawlers={data.topBrawlers}
                />
              )}

              {data.proTrios && data.proTrios.length > 0 && selectedMap && (
                <ProTrioGrid
                  trios={data.proTrios}
                  mapName={selectedMap}
                />
              )}

              {data.personalGap && data.personalGap.length > 0 && (
                <GapAnalysisCards gaps={data.personalGap} />
              )}

              {data.matchupGaps && data.matchupGaps.length > 0 && (
                <MatchupGapTable gaps={data.matchupGaps} />
              )}

              {/* Empty state for gap analysis when no personal data */}
              {hasPremium && !data.personalGap && (
                <div className="brawl-card-dark p-5 border-[#090E17] text-center">
                  <p className="text-sm text-slate-500">{t('upgradeForGap')}</p>
                </div>
              )}
            </div>
          </PremiumGate>

          {/* Upgrade card for non-premium */}
          {!hasPremium && (
            <div id="upgrade-section">
              <UpgradeCard />
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **10.2** Wire MetaProTab into the analytics page. Modify the tab system:

**File:** `src/app/[locale]/profile/[tag]/analytics/page.tsx`

Add the import at the top with the other component imports (after line 31, the DraftSimulator import):

Find:
```typescript
import { DraftSimulator } from '@/components/draft/DraftSimulator'
```

Replace with:
```typescript
import { DraftSimulator } from '@/components/draft/DraftSimulator'
import { MetaProTab } from '@/components/analytics/MetaProTab'
```

- [ ] **10.3** Update TAB_IDS to include 'metaPro':

Find:
```typescript
const TAB_IDS = ['overview', 'performance', 'matchups', 'team', 'trends', 'draft'] as const
```

Replace with:
```typescript
const TAB_IDS = ['overview', 'performance', 'matchups', 'team', 'trends', 'draft', 'metaPro'] as const
```

- [ ] **10.4** Update TAB_ICONS to include metaPro:

Find:
```typescript
const TAB_ICONS: Record<TabId, string> = {
  overview: '📊', performance: '', matchups: '⚔️', team: '', trends: '📈', draft: '',
}
```

Replace with:
```typescript
const TAB_ICONS: Record<TabId, string> = {
  overview: '📊', performance: '', matchups: '⚔️', team: '', trends: '📈', draft: '', metaPro: '',
}
```

- [ ] **10.5** Update TAB_KEYS to include metaPro:

Find:
```typescript
const TAB_KEYS: Record<TabId, string> = {
  overview: 'tabOverview', performance: 'tabPerformance', matchups: 'tabMatchups',
  team: 'tabTeam', trends: 'tabTrends', draft: 'tabDraft',
}
```

Replace with:
```typescript
const TAB_KEYS: Record<TabId, string> = {
  overview: 'tabOverview', performance: 'tabPerformance', matchups: 'tabMatchups',
  team: 'tabTeam', trends: 'tabTrends', draft: 'tabDraft', metaPro: 'tabMetaPro',
}
```

- [ ] **10.6** Update TAB_IMAGE_ICONS to include metaPro:

Find:
```typescript
const TAB_IMAGE_ICONS: Partial<Record<TabId, string>> = {
  overview: '/assets/modes/record-3.png',
  performance: '/assets/modes/record-12.png',
  matchups: '/assets/modes/record-6.png',
  team: '/assets/modes/48000058.png',
  trends: '/assets/modes/record-8.png',
  draft: '/assets/modes/48000028.png',
}
```

Replace with:
```typescript
const TAB_IMAGE_ICONS: Partial<Record<TabId, string>> = {
  overview: '/assets/modes/record-3.png',
  performance: '/assets/modes/record-12.png',
  matchups: '/assets/modes/record-6.png',
  team: '/assets/modes/48000058.png',
  trends: '/assets/modes/record-8.png',
  draft: '/assets/modes/48000028.png',
  metaPro: '/assets/modes/record-3.png',
}
```

- [ ] **10.7** Add the tab content rendering. After the draft tab block, add the metaPro tab:

Find:
```typescript
      {activeTab === 'draft' && (
        <div className="space-y-6">
          <DraftSimulator />
        </div>
      )}
```

Replace with:
```typescript
      {activeTab === 'draft' && (
        <div className="space-y-6">
          <DraftSimulator />
        </div>
      )}

      {activeTab === 'metaPro' && (
        <div className="space-y-6">
          <MetaProTab />
        </div>
      )}
```

- [ ] **10.8** The `tabMetaPro` translation key is consumed via `ta(TAB_KEYS[id])` which uses the `advancedAnalytics` namespace. Add the key to `advancedAnalytics` in en.json. Find the `tabDraft` key and add after it:

**File:** `messages/en.json`

Find:
```json
    "tabDraft": "Draft"
```

Replace with:
```json
    "tabDraft": "Draft",
    "tabMetaPro": "Meta PRO"
```

NOTE: Repeat this for all 13 locale files. The translated values are specified in Task 12.

- [ ] **10.9** Verify compilation:

```bash
npx tsc --noEmit
```

- [ ] **10.10** Commit:

```bash
git add src/components/analytics/MetaProTab.tsx src/app/[locale]/profile/[tag]/analytics/page.tsx messages/en.json
git commit -m "feat(ui): add MetaProTab container + wire as 7th tab

MetaProTab orchestrates MapSelector, public sections (TopBrawlersGrid,
TrendingSection, CounterQuickView), and premium-gated sections
(ProTrendChart, ProTrioGrid, GapAnalysisCards, MatchupGapTable)."
```

---

## Task 11: Inline PRO badges in existing tabs

Add `ProBadge` to 5 existing analytics components. These badges consume data from the `useProAnalysis` hook, passed down as props.

### Steps

- [ ] **11.1** Update `OverviewStats` to accept and display PRO average WR:

**File:** `src/components/analytics/OverviewStats.tsx`

Add to the Props interface:

Find:
```typescript
interface Props {
  overview: AdvancedAnalytics['overview']
}
```

Replace with:
```typescript
interface Props {
  overview: AdvancedAnalytics['overview']
  proAvgWR?: number | null
}
```

Inside the component, after destructuring `overview`, add the ProBadge import and usage. Find the component function declaration:

Find:
```typescript
export function OverviewStats({ overview }: Props) {
```

Replace with:
```typescript
export function OverviewStats({ overview, proAvgWR }: Props) {
```

Then, inside the win rate display area, add the PRO comparison. The exact insertion point depends on the component's JSX structure. Add after the main win rate display: a small inline `ProBadge` if `proAvgWR` is provided.

Add this import at the top of the file:
```typescript
import { ProBadge } from '@/components/analytics/ProBadge'
```

In the JSX where `overallWinRate` is displayed, add below it:
```tsx
{proAvgWR != null && (
  <div className="mt-1">
    <ProBadge proValue={proAvgWR} userValue={overallWinRate} total={0} compact />
  </div>
)}
```

- [ ] **11.2** Update `BrawlerMapHeatmap` to accept PRO data for tooltips:

**File:** `src/components/analytics/BrawlerMapHeatmap.tsx`

Add to the Props interface:

Find:
```typescript
interface Props {
  data: BrawlerMapEntry[]
}
```

Replace with:
```typescript
interface Props {
  data: BrawlerMapEntry[]
  proData?: Map<string, { winRate: number; total: number }> | null
}
```

Add import:
```typescript
import { ProBadge } from '@/components/analytics/ProBadge'
```

Update the component signature to destructure `proData`:

Find:
```typescript
export function BrawlerMapHeatmap({ data }: Props) {
```

Replace with:
```typescript
export function BrawlerMapHeatmap({ data, proData }: Props) {
```

In each heatmap row/card where win rate is shown, add after the user's WR display:
```tsx
{proData && (() => {
  const proEntry = proData.get(`${entry.brawlerId}|${entry.map}`)
  return proEntry ? (
    <ProBadge proValue={proEntry.winRate} userValue={entry.winRate} total={proEntry.total} />
  ) : null
})()}
```

- [ ] **11.3** Update `MatchupMatrix` to accept PRO matchup data:

**File:** `src/components/analytics/MatchupMatrix.tsx`

Add to the Props interface:

Find:
```typescript
interface Props {
  data: MatchupEntry[]
}
```

Replace with:
```typescript
interface Props {
  data: MatchupEntry[]
  proMatchups?: Map<string, { winRate: number; total: number }> | null
}
```

Add import:
```typescript
import { ProBadge } from '@/components/analytics/ProBadge'
```

Update the component signature:

Find:
```typescript
export function MatchupMatrix({ data }: Props) {
```

Replace with:
```typescript
export function MatchupMatrix({ data, proMatchups }: Props) {
```

In each matchup cell, add the ProBadge:
```tsx
{proMatchups && (() => {
  const proEntry = proMatchups.get(`${entry.brawlerId}|${entry.opponentId}`)
  return proEntry ? (
    <ProBadge proValue={proEntry.winRate} userValue={entry.winRate} total={proEntry.total} compact />
  ) : null
})()}
```

- [ ] **11.4** Update `TeamSynergyView` to accept PRO trio data:

**File:** `src/components/analytics/TeamSynergyView.tsx`

Add to the Props interface:

Find:
```typescript
interface Props {
  trioSynergy: TrioSynergy[]
  teammateSynergy: TeammateSynergy[]
}
```

Replace with:
```typescript
interface Props {
  trioSynergy: TrioSynergy[]
  teammateSynergy: TeammateSynergy[]
  proTrios?: Map<string, { winRate: number; total: number }> | null
}
```

Add import:
```typescript
import { ProBadge } from '@/components/analytics/ProBadge'
```

Update the component signature:

Find:
```typescript
export function TeamSynergyView({ trioSynergy, teammateSynergy }: Props) {
```

Replace with:
```typescript
export function TeamSynergyView({ trioSynergy, teammateSynergy, proTrios }: Props) {
```

In each trio card, after the games/confidence row, add:
```tsx
{proTrios && (() => {
  const ids = trio.brawlers.map(b => b.id).sort((a, b) => a - b)
  const key = ids.join('|')
  const proEntry = proTrios.get(key)
  return proEntry ? (
    <ProBadge proValue={proEntry.winRate} total={proEntry.total} compact />
  ) : null
})()}
```

- [ ] **11.5** Update `TrendsChart` to accept PRO average WR for dashed line:

**File:** `src/components/analytics/TrendsChart.tsx`

Add to the Props interface:

Find:
```typescript
interface Props {
  dailyTrend: DailyPoint[]
}
```

Replace with:
```typescript
interface Props {
  dailyTrend: DailyPoint[]
  proAvgWR?: number | null
}
```

Update the component signature:

Find:
```typescript
export function TrendsChart({ dailyTrend }: Props) {
```

Replace with:
```typescript
export function TrendsChart({ dailyTrend, proAvgWR }: Props) {
```

In the win rate LineChart section, pass `proAvgWR` as an additional reference line. The `LineChart` already supports `referenceLine` prop. Since 50% is already used as the reference line, add a separate gold dashed line in the SVG after the chart. This requires adding it to the first LineChart usage.

NOTE: The existing `referenceLine` only supports one line. The implementing agent should add the PRO average as a second dashed line directly in the SVG, with color `#FFC91B`, after the 50% reference line, with a legend entry. This is a cosmetic addition — the pattern is identical to the existing reference line in `LineChart`.

- [ ] **11.6** Update the analytics page to pass PRO data to inline components. The implementing agent should add a `useProAnalysis` call in the analytics page that fetches data for the user's most-played map/mode, and passes relevant fields to OverviewStats, BrawlerMapHeatmap, etc. This is a wiring change in `src/app/[locale]/profile/[tag]/analytics/page.tsx`.

The pattern:
```tsx
// In AnalyticsPage, after analytics loads:
const proInlineMap = analytics?.brawlerMapMatrix?.[0]?.map ?? null
const proInlineMode = analytics?.brawlerMapMatrix?.[0]?.mode ?? null
const { data: proData } = useProAnalysis(proInlineMap, proInlineMode)
```

Then pass to components:
```tsx
<OverviewStats overview={analytics.overview} proAvgWR={proData?.topBrawlers?.[0]?.winRate ?? null} />
```

- [ ] **11.7** Verify compilation:

```bash
npx tsc --noEmit
```

- [ ] **11.8** Commit:

```bash
git add src/components/analytics/OverviewStats.tsx src/components/analytics/BrawlerMapHeatmap.tsx src/components/analytics/MatchupMatrix.tsx src/components/analytics/TeamSynergyView.tsx src/components/analytics/TrendsChart.tsx src/app/[locale]/profile/[tag]/analytics/page.tsx
git commit -m "feat(ui): add inline PRO badges to 5 existing analytics tabs

ProBadge in OverviewStats (PRO avg WR), BrawlerMapHeatmap (tooltip),
MatchupMatrix (cell badge), TeamSynergyView (trio badge),
TrendsChart (PRO avg dashed line)."
```

---

## Task 12: Translation keys for all 13 locales

Add the `metaPro` namespace to all 13 locale files.

### Steps

- [ ] **12.1** Add `metaPro` namespace to `messages/en.json`:

Add at the end of the JSON object (before the closing `}`):

```json
  "metaPro": {
    "tabMetaPro": "Meta PRO",
    "mapSelectorTitle": "Select Map",
    "liveMaps": "In Rotation",
    "historicalMaps": "Historical Maps",
    "historicalLocked": "Premium only",
    "topBrawlersTitle": "Top Brawlers (PRO)",
    "totalBattles": "{count} pro battles analyzed",
    "trendRising": "Rising",
    "trendFalling": "Falling",
    "trendStable": "Stable",
    "trendDelta": "{delta}% this week",
    "counterTitle": "Counter-Picks",
    "counterHint": "If enemy picks {name}, play:",
    "proTriosTitle": "Best Team Compositions (PRO)",
    "gapTitle": "Your Gap vs PROs",
    "gapAbove": "Above PRO",
    "gapOnPar": "On Par",
    "gapBelow": "Below PRO",
    "gapImprove": "Improvement opportunity",
    "matchupGapTitle": "Matchup Gaps",
    "matchupGapHint": "Matchups where you differ most from PROs",
    "proBadgeTooltip": "Based on {count} pro battles",
    "proWR": "PRO {wr}%",
    "yourWR": "You {wr}%",
    "windowLabel": "Time Window",
    "window7d": "7 days",
    "window14d": "14 days",
    "window30d": "30 days",
    "window90d": "90 days",
    "noDataForMap": "Not enough pro data for this map",
    "upgradeForGap": "Upgrade to PRO to see your gap analysis"
  }
```

- [ ] **12.2** Add `metaPro` namespace to `messages/es.json`:

```json
  "metaPro": {
    "tabMetaPro": "Meta PRO",
    "mapSelectorTitle": "Seleccionar Mapa",
    "liveMaps": "En Rotacion",
    "historicalMaps": "Mapas Historicos",
    "historicalLocked": "Solo premium",
    "topBrawlersTitle": "Mejores Brawlers (PRO)",
    "totalBattles": "{count} batallas pro analizadas",
    "trendRising": "En alza",
    "trendFalling": "En baja",
    "trendStable": "Estable",
    "trendDelta": "{delta}% esta semana",
    "counterTitle": "Contra-Picks",
    "counterHint": "Si el rival lleva {name}, juega:",
    "proTriosTitle": "Mejores Composiciones (PRO)",
    "gapTitle": "Tu Brecha vs PROs",
    "gapAbove": "Sobre PRO",
    "gapOnPar": "A la Par",
    "gapBelow": "Bajo PRO",
    "gapImprove": "Oportunidad de mejora",
    "matchupGapTitle": "Brechas de Matchup",
    "matchupGapHint": "Matchups donde mas difieren de los PROs",
    "proBadgeTooltip": "Basado en {count} batallas pro",
    "proWR": "PRO {wr}%",
    "yourWR": "Tu {wr}%",
    "windowLabel": "Ventana de Tiempo",
    "window7d": "7 dias",
    "window14d": "14 dias",
    "window30d": "30 dias",
    "window90d": "90 dias",
    "noDataForMap": "No hay suficientes datos pro para este mapa",
    "upgradeForGap": "Mejora a PRO para ver tu analisis de brechas"
  }
```

- [ ] **12.3** Add `metaPro` namespace to the remaining 11 locale files. For each file, use the English keys as values (the implementing agent should translate or use English as fallback). The files are:

- `messages/ar.json` — Arabic
- `messages/de.json` — German
- `messages/fr.json` — French
- `messages/it.json` — Italian
- `messages/ja.json` — Japanese
- `messages/ko.json` — Korean
- `messages/pl.json` — Polish
- `messages/pt.json` — Portuguese
- `messages/ru.json` — Russian
- `messages/tr.json` — Turkish
- `messages/zh.json` — Chinese

For each file, add the same `metaPro` namespace block with the English values. The implementing agent should translate the user-facing strings for each locale. The key structure must be identical across all 13 files.

Example for `messages/fr.json`:
```json
  "metaPro": {
    "tabMetaPro": "Meta PRO",
    "mapSelectorTitle": "Choisir la Carte",
    "liveMaps": "En Rotation",
    "historicalMaps": "Cartes Historiques",
    "historicalLocked": "Premium uniquement",
    "topBrawlersTitle": "Meilleurs Brawlers (PRO)",
    "totalBattles": "{count} combats pro analyses",
    "trendRising": "En hausse",
    "trendFalling": "En baisse",
    "trendStable": "Stable",
    "trendDelta": "{delta}% cette semaine",
    "counterTitle": "Contre-Picks",
    "counterHint": "Si l'ennemi choisit {name}, jouez:",
    "proTriosTitle": "Meilleures Compositions (PRO)",
    "gapTitle": "Votre Ecart vs PROs",
    "gapAbove": "Au-dessus",
    "gapOnPar": "A egalite",
    "gapBelow": "En dessous",
    "gapImprove": "Opportunite d'amelioration",
    "matchupGapTitle": "Ecarts de Matchup",
    "matchupGapHint": "Matchups ou vous differez le plus des PROs",
    "proBadgeTooltip": "Base sur {count} combats pro",
    "proWR": "PRO {wr}%",
    "yourWR": "Vous {wr}%",
    "windowLabel": "Fenetre de Temps",
    "window7d": "7 jours",
    "window14d": "14 jours",
    "window30d": "30 jours",
    "window90d": "90 jours",
    "noDataForMap": "Pas assez de donnees pro pour cette carte",
    "upgradeForGap": "Passez a PRO pour voir votre analyse d'ecart"
  }
```

- [ ] **12.4** Also add `tabMetaPro` key to the `advancedAnalytics` namespace in all 13 files (the tab system reads from `advancedAnalytics`, not `metaPro`):

For each locale file, find the `"tabDraft"` key inside `"advancedAnalytics"` and add `"tabMetaPro"` after it:

| Locale | Value |
|--------|-------|
| en | `"Meta PRO"` |
| es | `"Meta PRO"` |
| ar | `"Meta PRO"` |
| de | `"Meta PRO"` |
| fr | `"Meta PRO"` |
| it | `"Meta PRO"` |
| ja | `"Meta PRO"` |
| ko | `"Meta PRO"` |
| pl | `"Meta PRO"` |
| pt | `"Meta PRO"` |
| ru | `"Meta PRO"` |
| tr | `"Meta PRO"` |
| zh | `"Meta PRO"` |

(The brand name "Meta PRO" stays the same across all locales.)

- [ ] **12.5** Commit:

```bash
git add messages/
git commit -m "feat(i18n): add metaPro translation namespace to all 13 locales

30 translation keys for Meta PRO tab UI. Includes tabMetaPro
in advancedAnalytics namespace for tab system compatibility."
```

---

## Verification Checklist

After all 12 tasks are complete:

```bash
npx tsc --noEmit
npx vitest run
```

Then manually test:

| # | State | Verify |
|---|-------|--------|
| 1 | Free user, live map | TopBrawlersGrid (5), Trending, CounterQuickView (3). Premium sections blurred. |
| 2 | Free user, historical map | Lock icon, cannot select |
| 3 | Premium, live map | All sections visible, gap analysis populated |
| 4 | Premium, no data map | "Not enough pro data" empty state |
| 5 | Premium, inline badges | ProBadge visible in Overview, Performance, Matchups, Team, Trends tabs |
| 6 | Mobile | Dropdown shows "Meta PRO" tab, all components responsive |

### Files Created
| File | Responsibility |
|------|---------------|
| `src/components/analytics/ProBadge.tsx` | Reusable PRO comparison badge |
| `src/components/analytics/MapSelector.tsx` | Map/mode selector with premium gate |
| `src/components/analytics/TopBrawlersGrid.tsx` | Top brawlers grid with trends |
| `src/components/analytics/TrendingSection.tsx` | Rising/falling brawlers |
| `src/components/analytics/CounterQuickView.tsx` | Counter-pick cards |
| `src/components/analytics/ProTrendChart.tsx` | 30d trend chart (premium) |
| `src/components/analytics/ProTrioGrid.tsx` | PRO trio grid (premium) |
| `src/components/analytics/GapAnalysisCards.tsx` | User vs PRO gap cards (premium) |
| `src/components/analytics/MatchupGapTable.tsx` | Matchup deviation table (premium) |
| `src/components/analytics/MetaProTab.tsx` | Meta PRO tab container |

### Files Modified
| File | Change |
|------|--------|
| `src/app/[locale]/profile/[tag]/analytics/page.tsx` | Added 7th tab + MetaProTab import + inline PRO data wiring |
| `src/components/analytics/OverviewStats.tsx` | Added `proAvgWR` prop + ProBadge |
| `src/components/analytics/BrawlerMapHeatmap.tsx` | Added `proData` prop + ProBadge in tooltip |
| `src/components/analytics/MatchupMatrix.tsx` | Added `proMatchups` prop + ProBadge in cells |
| `src/components/analytics/TeamSynergyView.tsx` | Added `proTrios` prop + ProBadge on trio cards |
| `src/components/analytics/TrendsChart.tsx` | Added `proAvgWR` prop + gold dashed line |
| `messages/*.json` (13 files) | Added `metaPro` namespace + `tabMetaPro` in `advancedAnalytics` |
