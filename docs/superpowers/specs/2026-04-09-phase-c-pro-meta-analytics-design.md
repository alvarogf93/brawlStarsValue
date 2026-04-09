# Phase C: Pro Meta Analytics — Design Spec

> **Status**: Approved design, pending implementation plan
> **Dependencies**: Phase B monetization (subscribe page, premium gating)
> **Scope**: Inline PRO comparisons in all analytics tabs + dedicated Meta PRO tab + data infrastructure improvements

---

## 1. Goal

Give premium users actionable insight by crossing their personal battle data with professional meta data. Free users see enough PRO data to create conversion pressure. The system must handle data efficiently: aggregate PRO data (cook it, don't store raw), preserve user premium data (store everything).

**Success criteria**: A premium user opens the Meta PRO tab, selects their current map, and in 5 seconds knows:
- Which brawlers the pros dominate with here
- How their own performance compares
- Who to pick and who to avoid
- Which trio composition works best

---

## 2. Data Philosophy

### 2.1 PRO Data (meta_stats, meta_matchups, meta_trios)

**Principle**: Cook and aggregate. Never store raw battlelogs from pros.

What we store:
- **Aggregated counters** per brawler/map/mode/date: wins, losses, total
- **Aggregated matchups** per brawler-vs-brawler/mode/date: wins, losses, total
- **Aggregated trios** per 3-brawler-team/map/mode/date: wins, losses, total

What we DON'T store:
- Individual pro battle records
- Pro player identities (tags, names)
- Raw team compositions beyond the trio aggregate
- Trophy counts, durations, star player data from pros

**Retention**: Infinite. Never delete. Data is the asset. UI filters by time window.

**Estimated growth**: ~500 rows/day in meta_stats, ~2000 rows/day in meta_matchups, ~800 rows/day in meta_trios. At ~200 bytes/row average, this is ~0.7 MB/day or ~21 MB/month. Trivial for Supabase.

### 2.2 Premium User Data (battles table)

**Principle**: Store everything. Every battle, every detail. This is their data and they paid for deep analytics.

What we store (already implemented):
- Full battle record: player_tag, battle_time, event_id, mode, map, result, trophy_change, duration, is_star_player
- Full JSONB fields: my_brawler (id, name, power, trophies, gadgets, starPowers, hypercharges), teammates[], opponents[]

**Retention**: Current policy is 1-2 years for premium users. No change needed.

### 2.3 Data Quality Rules

For PRO aggregated data to be "cooked" properly:
1. **Source filtering**: Only top 100 global players (already enforced by cron)
2. **Mode filtering**: Only standard 3v3 draft modes via `isDraftMode()` (already enforced)
3. **Battle filtering**: Skip friendly, no-result, non-3v3 (already enforced)
4. **Deduplication**: Cursor-based per player tag (already enforced)
5. **Statistical validity**: Use Bayesian win rate (`bayesianWinRate()`) for all displayed rates — shrinks small samples toward 50%
6. **Minimum display threshold**: Don't show PRO data for brawler/map combos with < 20 total battles in the window (configurable constant)

---

## 3. Database Changes

### 3.1 Remove data cleanup from cron

**File**: `src/app/api/cron/meta-poll/route.ts` lines 172-173

Remove:
```typescript
await supabase.from('meta_stats').delete().lt('date', ...)
await supabase.from('meta_matchups').delete().lt('date', ...)
```

Data accumulates forever. UI filters by window.

### 3.2 New table: `meta_trios`

```sql
CREATE TABLE IF NOT EXISTS meta_trios (
  brawler1_id INT NOT NULL,  -- Sorted: b1 < b2 < b3
  brawler2_id INT NOT NULL,
  brawler3_id INT NOT NULL,
  map TEXT NOT NULL,
  mode TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'global',
  date DATE NOT NULL,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  PRIMARY KEY (brawler1_id, brawler2_id, brawler3_id, map, mode, source, date)
);

CREATE INDEX IF NOT EXISTS idx_meta_trios_lookup
  ON meta_trios(map, mode, source, date);

-- RLS: public read, service-only write
ALTER TABLE meta_trios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta_trios_select" ON meta_trios FOR SELECT USING (true);
CREATE POLICY "meta_trios_all_service" ON meta_trios FOR ALL USING (
  (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
);
```

### 3.3 Bulk upsert RPC for meta_trios

```sql
CREATE OR REPLACE FUNCTION bulk_upsert_meta_trios(rows JSONB)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r JSONB;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(rows)
  LOOP
    INSERT INTO meta_trios (brawler1_id, brawler2_id, brawler3_id, map, mode, source, date, wins, losses, total)
    VALUES (
      (r->>'brawler1_id')::int, (r->>'brawler2_id')::int, (r->>'brawler3_id')::int,
      r->>'map', r->>'mode', r->>'source', (r->>'date')::date,
      (r->>'wins')::int, (r->>'losses')::int, (r->>'total')::int
    )
    ON CONFLICT (brawler1_id, brawler2_id, brawler3_id, map, mode, source, date)
    DO UPDATE SET
      wins = meta_trios.wins + EXCLUDED.wins,
      losses = meta_trios.losses + EXCLUDED.losses,
      total = meta_trios.total + EXCLUDED.total;
  END LOOP;
END;
$$;
```

### 3.4 Constants

```typescript
// src/lib/draft/constants.ts — add:
export const PRO_MIN_BATTLES_DISPLAY = 20  // Min battles to show PRO data for a brawler/map combo
export const PRO_TREND_DAYS_SHORT = 7      // Short-term trend window
export const PRO_TREND_DAYS_MEDIUM = 14    // Medium-term trend window  
export const PRO_TREND_DAYS_LONG = 30      // Long-term trend window
```

---

## 4. Cron Job Changes

### 4.1 Add trio accumulation to `meta-poll`

**File**: `src/app/api/cron/meta-poll/route.ts`

After the existing `processBattleForMeta()` call (line 101-107), add trio extraction:

```typescript
// Extract trio composition (my team's 3 brawlers)
const myTeamIdx = battle.teams.findIndex(team => team.some(p => p.tag === tag))
if (myTeamIdx !== -1) {
  const teamBrawlerIds = battle.teams[myTeamIdx]
    .map(p => p.brawler.id)
    .sort((a, b) => a - b)  // Canonical order

  if (teamBrawlerIds.length === 3) {
    const trioKey = `${teamBrawlerIds[0]}|${teamBrawlerIds[1]}|${teamBrawlerIds[2]}|${mapName}|${mode}`
    const entry = acc.trios.get(trioKey) ?? { wins: 0, losses: 0, total: 0, ids: teamBrawlerIds, map: mapName, mode }
    entry.total++
    if (battle.result === 'victory') entry.wins++
    else entry.losses++
    acc.trios.set(trioKey, entry)
  }
}
```

### 4.2 Update MetaAccumulators type

**File**: `src/lib/draft/meta-accumulator.ts`

```typescript
export interface MetaAccumulators {
  stats: Map<string, StatAccumulator>
  matchups: Map<string, StatAccumulator>
  trios: Map<string, StatAccumulator & { ids: number[]; map: string; mode: string }>
}
```

### 4.3 Bulk upsert trios in cron

After the existing bulk upserts for stats and matchups, add:

```typescript
if (acc.trios.size > 0) {
  const trioRows = Array.from(acc.trios.entries()).map(([, val]) => ({
    brawler1_id: val.ids[0],
    brawler2_id: val.ids[1],
    brawler3_id: val.ids[2],
    map: val.map,
    mode: val.mode,
    source: 'global',
    date: today,
    wins: val.wins,
    losses: val.losses,
    total: val.total,
  }))
  await supabase.rpc('bulk_upsert_meta_trios', { rows: trioRows })
}
```

### 4.4 Remove data cleanup

Remove lines 172-173 from `meta-poll/route.ts`. Data persists forever.

---

## 5. New API Endpoint: `/api/meta/pro-analysis`

**File**: `src/app/api/meta/pro-analysis/route.ts`

### Request
```
GET /api/meta/pro-analysis?map=Hard+Rock+Mine&mode=gemGrab&window=14
```

Parameters:
- `map` (required): Map name
- `mode` (required): Game mode
- `window` (optional, default 14): Days to aggregate (7, 14, 30, 90)

### Response

```typescript
interface ProAnalysisResponse {
  // === PUBLIC (free users see this) ===
  
  topBrawlers: Array<{
    brawlerId: number
    name: string           // Resolved from brawler registry
    winRate: number         // Bayesian WR
    pickRate: number        // % of total battles this brawler was picked
    totalBattles: number
    trend7d: number | null  // WR change vs previous 7 days (e.g., +3.2)
    trend30d: number | null // WR change vs previous 30 days
  }>
  totalProBattles: number   // Total battles analyzed in window
  windowDays: number        // Requested window
  
  // Trending: top 3 risers and fallers
  trending: {
    rising: Array<{ brawlerId: number; name: string; delta7d: number }>
    falling: Array<{ brawlerId: number; name: string; delta7d: number }>
  }
  
  // Counter matrix (public: top 3 counters per brawler, premium: full)
  counters: Array<{
    brawlerId: number
    name: string
    bestCounters: Array<{ opponentId: number; name: string; winRate: number; total: number }>
    worstMatchups: Array<{ opponentId: number; name: string; winRate: number; total: number }>
  }>
  
  // === PREMIUM ONLY (null for free users) ===
  
  // Daily trend data for chart (30d)
  dailyTrend: Array<{
    date: string
    brawlers: Array<{ brawlerId: number; winRate: number; picks: number }>
  }> | null
  
  // Pro trios for this map
  proTrios: Array<{
    brawlers: Array<{ id: number; name: string }>
    winRate: number
    total: number
  }> | null
  
  // Gap analysis: user vs pro (requires auth + linked tag)
  personalGap: Array<{
    brawlerId: number
    name: string
    yourWR: number         // User's bayesian WR on this brawler/map
    proWR: number          // PRO bayesian WR
    gap: number            // yourWR - proWR (negative = below pro)
    yourTotal: number
    proTotal: number
    verdict: 'above' | 'below' | 'on-par'  // |gap| < 3 = on-par
  }> | null
  
  // User's matchup gaps vs pro matchups
  matchupGaps: Array<{
    brawlerId: number
    opponentId: number
    brawlerName: string
    opponentName: string
    yourWR: number
    proWR: number
    gap: number
  }> | null
}
```

### Auth tiers in this endpoint

| Field | Free | Premium (no tag) | Premium (with tag) |
|-------|------|-----------------|-------------------|
| topBrawlers | Top 5 | Top 10 | Top 10 |
| trending | Yes | Yes | Yes |
| counters | Top 3 per brawler | Full matrix | Full matrix |
| dailyTrend | null | Full 30d | Full 30d |
| proTrios | null | Full | Full |
| personalGap | null | null | Full |
| matchupGaps | null | null | Full |

### Processing logic

1. Query `meta_stats` for map+mode, aggregate by brawler over window
2. Query `meta_stats` for previous window (for trend calculation)
3. Query `meta_matchups` for mode, aggregate over window
4. Query `meta_trios` for map+mode, aggregate over window
5. If premium + has player_tag:
   - Query `battles` for user's battles on this map+mode
   - Aggregate user's brawler WRs
   - Cross with PRO data to compute gaps
   - Query user's matchup data from `computeAdvancedAnalytics` cache or re-compute from battles
6. Apply Bayesian smoothing to all win rates
7. Apply `PRO_MIN_BATTLES_DISPLAY` threshold — exclude brawlers with < 20 pro battles

---

## 6. Meta PRO Tab — UI Design

### 6.1 New tab in analytics page

Add "Meta PRO" as 7th tab: `['overview', 'performance', 'matchups', 'team', 'trends', 'draft', 'metaPro']`

Tab icon: 🏆 or a trophy mode icon
Tab label: `ta('tabMetaPro')` → "Meta PRO"

### 6.2 Component structure

```
MetaProTab
├── MapSelector (reuse from Draft, adapted)
│   ├── Live maps section (free users)
│   └── Historical maps section (🔒 premium)
│
├── ProOverview (public section)
│   ├── TopBrawlersGrid — top 5-10 brawlers, WR, pick rate, trend badges
│   ├── TrendingSection — rising/falling brawlers with delta
│   └── CounterQuickView — "If enemy picks X, play Y" cards
│
├── PremiumGate (blur for free users, wraps premium sections)
│   ├── ProTrendChart — 30d daily WR line chart per brawler (interactive)
│   ├── ProTrioGrid — top trio compositions for this map (with map bg)
│   ├── GapAnalysisCards — your brawlers vs PRO WR, sorted by gap
│   └── MatchupGapTable — your matchups where you deviate most from PROs
│
└── UpgradeCard (if not premium, at bottom)
```

### 6.3 Component details

#### TopBrawlersGrid
- Grid 2 cols mobile, 3-5 cols desktop
- Each card: brawler portrait + name + WR (bayesian) + pick count + trend badge
- Trend badge: ↑ green if WR rose >2% in 7d, ↓ red if fell >2%, — gray if stable
- Cards sorted by bayesian WR descending
- Map image as subtle background (like PlayNowDashboard)

#### TrendingSection
- Two columns: "Rising 📈" and "Falling 📉"
- Max 3 brawlers each
- Shows: portrait + name + delta (e.g., "+5.3% esta semana")
- Only brawlers with >2% change and >= PRO_MIN_BATTLES_DISPLAY

#### CounterQuickView
- Cards that answer: "Si el rival lleva X, juega Y"
- For each top 5 brawler: show best counter (highest WR against them)
- Free users: top 3 brawlers only
- Premium: all brawlers with expandable view

#### ProTrendChart (premium)
- Interactive line chart (30 days, daily data points)
- X axis: dates, Y axis: win rate %
- Multiple lines: top 5 brawlers (selectable via legend)
- Monthly period markers for balance change awareness
- Uses framer-motion for smooth line transitions (already installed)
- Component: reuse pattern from existing `TrendsChart` but with PRO data

#### ProTrioGrid (premium)
- Same grid layout as TeamSynergyView trio cards
- Map image background on each card
- 3 brawler portraits + WR + games
- If user played this trio: show "Tu WR: X%" badge on the card
- Sorted by bayesian WR descending
- Data from `meta_trios` table

#### GapAnalysisCards (premium)
- For each brawler the user has played on this map:
  - Show: portrait + name + "Tu: 48.2%" + "PRO: 62.1%" + gap badge
  - Gap badge colors: green (above PRO), gold (on par ±3%), red (below PRO)
  - Sorted by gap ascending (worst gaps first — these are improvement opportunities)
- Empty state if user has no battles on this map

#### MatchupGapTable (premium)
- Compact table: "Tu WR vs [oponente]" compared to "PRO WR vs [oponente]"
- Highlight matchups where user deviates most from PRO meta
- Example: "Tu pierdes 72% vs Colt. Los PROs ganan 58%. Practica este matchup."
- Sortable by gap, by opponent, by your WR

---

## 7. Inline PRO Comparisons in Existing Tabs

Small, non-intrusive additions to existing analytics components. Each uses a shared `ProBadge` component.

### 7.1 ProBadge Component

**File**: `src/components/analytics/ProBadge.tsx`

```typescript
interface ProBadgeProps {
  proValue: number    // PRO win rate
  userValue?: number  // User's win rate (optional — if provided, shows comparison)
  total: number       // PRO sample size
  compact?: boolean   // true = just "PRO 62%" text, false = full badge with tooltip
}
```

Renders:
- Compact mode: `PRO 62.1%` in gold text, small font
- Full mode: badge with PRO value + gap indicator (↑↓) + tooltip with sample size
- Color: gold (#FFC91B) for PRO value, green if user > PRO, red if user < PRO

### 7.2 Integration points

#### OverviewStats (`src/components/analytics/OverviewStats.tsx`)
- Next to the user's overall win rate display
- Add: `PRO avg: 54.2%` as small gold text
- Data source: average WR across all brawlers in meta_stats for modes the user plays
- Visible to: all users (public PRO data)

#### BrawlerMapHeatmap (`src/components/analytics/BrawlerMapHeatmap.tsx`)
- In each heatmap cell tooltip (on hover/tap)
- Add: "PRO: 67.3% (523 battles)" line below the user's data
- Data source: meta_stats for that exact brawler/map/mode combo
- Visible to: premium only

#### MatchupMatrix (`src/components/analytics/MatchupMatrix.tsx`)
- In each matchup cell
- Small corner badge showing PRO WR for that matchup
- Color-coded: green if user performs better than PRO, red if worse
- Data source: meta_matchups for that brawler/opponent/mode combo
- Visible to: premium only

#### TeamSynergyView (`src/components/analytics/TeamSynergyView.tsx`)
- On trio cards that match a PRO trio (same 3 brawlers)
- Add: small "PRO 67%" badge at bottom of card
- Data source: meta_trios for that trio/map/mode combo
- Visible to: premium only

#### TrendsChart (`src/components/analytics/TrendsChart.tsx`)
- Overlay a dashed line showing average PRO WR for comparison
- Legend entry: "PRO Meta Avg" in gold dashed line
- Data source: daily average from meta_stats for the user's most-played brawlers
- Visible to: premium only

---

## 8. Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ CRON (every 2-4h): /api/cron/meta-poll                         │
│                                                                 │
│ Top 100 global → fetch battlelogs → filter 3v3 draft           │
│     │                                                           │
│     ├─→ Accumulate stats (brawler/map/mode) → meta_stats       │
│     ├─→ Accumulate matchups (brawler vs brawler/mode) → meta_matchups │
│     └─→ Accumulate trios (3 brawlers/map/mode) → meta_trios [NEW] │
│                                                                 │
│ NO cleanup. Data persists forever.                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ API: GET /api/meta/pro-analysis?map=X&mode=Y&window=14         │
│                                                                 │
│ 1. Query meta_stats → topBrawlers + trends                     │
│ 2. Query meta_matchups → counter matrix                        │
│ 3. Query meta_trios → pro trio compositions [NEW]              │
│ 4. If premium + tag:                                            │
│    Query battles → personal WR per brawler/map                  │
│    Cross with PRO → gap analysis                               │
│ 5. Apply bayesian smoothing + min threshold                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT: Meta PRO Tab + Inline Badges                           │
│                                                                 │
│ MetaProTab:                                                     │
│   MapSelector → fetch /api/meta/pro-analysis                   │
│   Public: TopBrawlersGrid + Trending + CounterQuickView        │
│   Premium: TrendChart + ProTrioGrid + GapCards + MatchupGaps   │
│                                                                 │
│ Inline (existing tabs):                                         │
│   ProBadge component → shows PRO reference in tooltips/badges  │
│   Fetched alongside main analytics data (piggyback on existing │
│   useAdvancedAnalytics or separate lightweight hook)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Hook: useProAnalysis

**File**: `src/hooks/useProAnalysis.ts`

```typescript
export function useProAnalysis(map: string | null, mode: string | null, window?: number) {
  // Fetches /api/meta/pro-analysis when map+mode are set
  // Returns: { data: ProAnalysisResponse | null, loading, error }
  // Caches by map+mode+window key in state (no refetch if same params)
  // Aborts on unmount or param change
}
```

Used by:
- `MetaProTab` — primary consumer, passes map+mode from selector
- Inline badges — consume specific fields (topBrawlers, counters) when analytics page loads

---

## 10. Translation Keys

### New namespace `metaPro`

```json
{
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

---

## 11. File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/008_meta_trios.sql` | meta_trios table + RPC + RLS |
| Create | `src/app/api/meta/pro-analysis/route.ts` | Pro analysis API endpoint |
| Create | `src/hooks/useProAnalysis.ts` | Client hook for pro analysis data |
| Create | `src/components/analytics/MetaProTab.tsx` | Meta PRO tab container |
| Create | `src/components/analytics/TopBrawlersGrid.tsx` | Top brawlers grid with trends |
| Create | `src/components/analytics/TrendingSection.tsx` | Rising/falling brawlers |
| Create | `src/components/analytics/CounterQuickView.tsx` | Counter-pick cards |
| Create | `src/components/analytics/ProTrendChart.tsx` | 30d trend line chart (premium) |
| Create | `src/components/analytics/ProTrioGrid.tsx` | PRO trio compositions (premium) |
| Create | `src/components/analytics/GapAnalysisCards.tsx` | User vs PRO gap cards (premium) |
| Create | `src/components/analytics/MatchupGapTable.tsx` | Matchup deviation table (premium) |
| Create | `src/components/analytics/ProBadge.tsx` | Reusable PRO comparison badge |
| Modify | `src/app/api/cron/meta-poll/route.ts` | Add trio accumulation, remove cleanup |
| Modify | `src/lib/draft/meta-accumulator.ts` | Add trios to MetaAccumulators |
| Modify | `src/lib/draft/constants.ts` | Add PRO display constants |
| Modify | `src/app/[locale]/profile/[tag]/analytics/page.tsx` | Add Meta PRO tab |
| Modify | `src/components/analytics/OverviewStats.tsx` | Add inline PRO badge |
| Modify | `src/components/analytics/BrawlerMapHeatmap.tsx` | Add PRO WR in tooltips |
| Modify | `src/components/analytics/MatchupMatrix.tsx` | Add PRO matchup badge |
| Modify | `src/components/analytics/TeamSynergyView.tsx` | Add PRO trio badge |
| Modify | `src/components/analytics/TrendsChart.tsx` | Add PRO avg dashed line |
| Modify | `messages/*.json` (13 files) | Add metaPro namespace |

---

## 12. Testing Strategy

### Unit Tests (pure functions, no DB)

| Test | What it validates |
|------|-------------------|
| Trend calculation (7d delta) | Correct delta between two windows |
| Trend calculation (30d delta) | Correct delta for monthly trends |
| Gap analysis verdict | 'above' / 'on-par' / 'below' thresholds correct |
| Bayesian WR applied consistently | All displayed rates use bayesian smoothing |
| Trio canonicalization | IDs sorted for dedup (same as existing pattern) |
| PRO_MIN_BATTLES_DISPLAY threshold | Brawlers below threshold excluded |
| Free vs premium data filtering | Free users get limited data fields |

### Integration Tests (against test Supabase)

| Test | What it validates |
|------|-------------------|
| meta_trios bulk upsert | Atomic increment on conflict |
| pro-analysis endpoint with no auth | Returns topBrawlers + trending, no personalGap |
| pro-analysis endpoint with premium auth | Returns full response including gaps |
| pro-analysis endpoint with expired trial | Returns free-tier response |
| Cron trio accumulation | Trios correctly accumulated from battle data |

### Manual Test Matrix

| # | State | What to verify |
|---|-------|---------------|
| 1 | Free user, live map | Sees TopBrawlersGrid + Trending + Counter (top 3). Premium sections blurred. |
| 2 | Free user, historical map | Sees lock icon, cannot select |
| 3 | Premium, live map | Full view: all sections visible, gap analysis populated |
| 4 | Premium, historical map | Can select, full data shown |
| 5 | Premium, map with no data | "Not enough pro data" empty state |
| 6 | Premium, inline badges | PRO badges visible in Overview, Performance, Matchups, Team, Trends tabs |

---

## 13. Performance Considerations

1. **API caching**: `/api/meta/pro-analysis` should cache by map+mode+window for 30 minutes (data only changes every 2-4h via cron)
2. **Client caching**: `useProAnalysis` hook caches in state per map+mode combination
3. **Lazy loading**: Meta PRO tab only fetches data when selected (not on page load)
4. **Inline badges**: Fetch PRO data once on analytics page load, pass down to child components via context or props
5. **Chart rendering**: Use lazy import for chart library (`import('recharts')` or similar) to avoid initial bundle cost
6. **DB indexes**: `idx_meta_trios_lookup` on (map, mode, source, date) ensures fast queries

---

## 14. Security

1. **Free users**: Cannot access personalGap, matchupGaps, dailyTrend, proTrios via API (server-side gating)
2. **Premium check**: `isPremium(profile)` on server, not client — prevent bypassing
3. **Player tag isolation**: Gap analysis only queries user's own battles (WHERE player_tag = authenticated user's tag)
4. **Rate limiting**: Not needed — data is aggregated/cached, no user-triggered computation
5. **No PII exposure**: PRO data is anonymous aggregates, no player tags or names stored

---

## 15. What This Spec Does NOT Cover

- Logo rebrand (done in separate commit)
- Phase B subscribe page (separate branch `feat/phase-b-monetization`)
- Individual pro player profiles or rankings
- Ban phase tracking in draft
- Real-time websocket updates
- Brawler-specific detailed pages (e.g., "everything about Shelly")
- Map rotation predictions

---

## 16. Glossary

| Term | Definition |
|------|-----------|
| **Bayesian WR** | Win rate adjusted for sample size: `((wins + 30×0.5) / (total + 30)) × 100` |
| **Gap** | Difference between user's WR and PRO WR for same brawler/map. Negative = below PRO. |
| **Trend 7d** | WR change compared to previous 7-day period |
| **Trend 30d** | WR change compared to previous 30-day period (balance change cycles) |
| **PRO_MIN_BATTLES_DISPLAY** | Minimum 20 battles for PRO data to be shown (avoids noise) |
| **Window** | Time period for data aggregation (7, 14, 30, or 90 days) |
| **Cooked data** | Pre-aggregated statistics (not raw battle records) |
| **On-par** | User's WR within ±3 percentage points of PRO WR |
