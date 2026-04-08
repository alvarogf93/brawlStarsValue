# Counter-Pick Advisor & Meta Infrastructure — Design Spec

## Goal

Redesign the Counter-Pick Advisor into a full competitive draft simulator with real-time recommendations, powered by our own meta data infrastructure. Additionally, improve analytics reliability across the app with visual confidence indicators.

## Architecture Overview

Three interconnected deliverables:

1. **Meta Data Infrastructure** — cron polling + aggregation tables for global win rates
2. **Public Picks Page** — free page showing best brawlers per active map
3. **Premium Draft Tool** — full 1-2-2-1 draft simulator with personalized recommendations
4. **Confidence Indicators** — visual trust signals across all existing analytics

---

## 1. Meta Data Infrastructure

### 1.1 Data Sources

| Source | What it provides | How we access it |
|--------|-----------------|------------------|
| **Supercell API** (via our proxy) | Player battlelogs, rankings, brawler list (IDs + names) | `fetchPlayer()`, `fetchBattlelog()`, `fetchRankings()` — already in `src/lib/api.ts` |
| **BrawlAPI** (brawlapi.com) | Brawler class/role, rarity, image URLs, active events | New: `fetchBrawlerRegistry()` — `GET https://api.brawlapi.com/v1/brawlers` |
| **Our battles table** | Premium users' personal battle history | Existing Supabase `battles` table |

### 1.2 New Database Tables

```sql
-- Win rate counters per brawler/map/mode (anonymous, aggregated)
CREATE TABLE meta_stats (
  brawler_id INT NOT NULL,
  map TEXT NOT NULL,
  mode TEXT NOT NULL,
  source TEXT NOT NULL,          -- 'global' | 'users'
  date DATE NOT NULL,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  PRIMARY KEY (brawler_id, map, mode, source, date)
);
CREATE INDEX idx_meta_stats_lookup ON meta_stats(map, mode, source, date);

-- Matchup counters: brawler vs brawler at MODE level (not map)
CREATE TABLE meta_matchups (
  brawler_id INT NOT NULL,
  opponent_id INT NOT NULL,
  mode TEXT NOT NULL,
  source TEXT NOT NULL,          -- 'global' | 'users'
  date DATE NOT NULL,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  PRIMARY KEY (brawler_id, opponent_id, mode, source, date)
);
CREATE INDEX idx_meta_matchups_lookup ON meta_matchups(mode, source, date);

-- Dedup cursors for polling (one row per polled player)
CREATE TABLE meta_poll_cursors (
  player_tag TEXT PRIMARY KEY,
  last_battle_time TIMESTAMPTZ NOT NULL
);
```

**RLS Policies:**
- `meta_stats`: SELECT for anon/authenticated; INSERT/UPDATE/DELETE for service_role only
- `meta_matchups`: same as meta_stats
- `meta_poll_cursors`: ALL operations service_role only

**Storage estimate:** ~35-40MB total. Well within Supabase free tier (500MB).

### 1.3 Cron: Meta Polling (`/api/cron/meta-poll`)

**Frequency:** Every 2 hours (configurable).

**Flow:**
1. Verify `CRON_SECRET` header → 401 if missing
2. Fetch top 200 global player rankings via `fetchRankings('global')`
3. For each player (throttled at 5 req/s):
   a. Read `meta_poll_cursors` for `last_battle_time`
   b. Fetch battlelog via `fetchBattlelog(tag)`
   c. Handle 403/404 gracefully (skip player, log warning)
   d. Filter battles:
      - `battle_time > last_battle_time` (new only)
      - `mode IN DRAFT_MODES` (3v3 competitive only)
      - `battle.type !== 'friendly'`
      - `battle.result IN ('victory', 'defeat')` (skip draws)
      - `battle.teams.length === 2` AND each team has 3 players
   e. **CRITICAL**: Find polled player by tag in teams (NOT assume teams[0]):
      ```typescript
      const myTeam = battle.teams.findIndex(t => t.some(p => p.tag === playerTag))
      if (myTeam === -1) continue // skip if player not found
      const opponents = battle.teams[1 - myTeam]
      ```
   f. Accumulate in memory Maps:
      - `metaKey(brawlerId, map, mode) → { wins: +1 or +0, losses: +1 or +0 }`
      - `matchupKey(brawlerId, opponentId, mode) → { wins, losses }` (3 entries per battle, one per opponent)
   g. Update cursor to latest `battle_time`
4. Bulk UPSERT all accumulated data into `meta_stats` (source='global', date=UTC today)
5. Bulk UPSERT all accumulated data into `meta_matchups` (source='global', date=UTC today)
6. Cleanup: `DELETE FROM meta_stats WHERE date < CURRENT_DATE - 30`; same for meta_matchups
7. Return `{ processed, skipped, errors }`

**Batch UPSERT pattern:**
```sql
INSERT INTO meta_stats (brawler_id, map, mode, source, date, wins, losses, total)
VALUES ($1, $2, ...), ($3, $4, ...), ...
ON CONFLICT (brawler_id, map, mode, source, date) 
DO UPDATE SET 
  wins = meta_stats.wins + EXCLUDED.wins,
  losses = meta_stats.losses + EXCLUDED.losses,
  total = meta_stats.total + EXCLUDED.total;
```

2-3 batch queries total instead of thousands of individual writes.

### 1.4 User Battles → meta_stats (source='users')

Extend the existing `/api/cron/sync` route. After inserting battles for a premium user, also aggregate into meta_stats/meta_matchups with `source='users'`. Same filtering rules. This grows our "Comunidad BrawlVision" data automatically.

### 1.5 Bayesian Average for Sparse Data

All win rate displays from meta data use Bayesian shrinkage:

```typescript
function bayesianWinRate(wins: number, total: number, prior = 0.5, strength = 30): number {
  return (wins + strength * prior) / (total + strength)
}
// 3 wins, 0 losses → 54.5% (not 100%)
// 100 wins, 50 losses → 63.9% (close to raw 66.7%)
```

Applied in both meta_stats queries and meta_matchups queries.

### 1.6 Brawler Registry

**New endpoint cached server-side (24h):** Fetch from BrawlAPI `GET https://api.brawlapi.com/v1/brawlers`

Returns per brawler:
- `id`: 16000000+ (matches Supercell IDs — **must verify at setup**)
- `name`: English name (UPPERCASE)
- `class`: { id, name } — may be "Unknown" for new brawlers
- `rarity`: { id, name, color }
- `imageUrl`, `imageUrl2`: Brawlify CDN URLs

**Fallback if BrawlAPI is down:** Serve from 24h cache. If cache also expired, fall back to brawler IDs from user's own profile data (no class info, local image assets).

**ID Validation script:** Before first deploy, run a one-time check that BrawlAPI brawler IDs match Supercell API brawler IDs for all common brawlers.

### 1.7 Valid 3v3 Modes (Allowlist)

```typescript
const DRAFT_MODES = [
  'gemGrab', 'heist', 'bounty', 'brawlBall', 
  'hotZone', 'knockout', 'wipeout', 'brawlHockey'
] as const
```

Only these modes appear in the draft selector and are processed by the cron.

---

## 2. Public Picks Page (`/[locale]/picks`)

### 2.1 Route & Rendering

- **Path:** `/[locale]/picks`
- **Access:** Free, no login required
- **Rendering:** Server component with ISR `revalidate = 1800` (30 min)
- **SEO:** Dynamic title/description per locale. Appears in sitemap.

### 2.2 Data Flow

1. Server fetches active events from `/api/events`
2. For each 3v3 event, queries `meta_stats` for that map+mode (last 14 days, source='global')
3. Applies Bayesian average
4. Returns top 5 brawlers per map, sorted by adjusted win rate

### 2.3 UI Layout

Each active 3v3 map gets a card:

```
┌──────────────────────────────────────────────┐
│ [Map Image]  Gem Grab — Hard Rock Mine       │
│              ⏱ 3h 42m remaining              │
│                                              │
│ 🥇 Brawler A  ████████████░░  62.3%         │
│ 🥈 Brawler B  ███████████░░░  59.1%         │
│ 🥉 Brawler C  ██████████░░░░  56.8%         │
│    Brawler D  █████████░░░░░  54.2%         │
│    Brawler E  █████████░░░░░  53.7%         │
│                                              │
│ [Expandir ▼]                                 │
├──────────────────────────────────────────────┤
│ 🔓 Picks personalizados → Hazte PRO         │
└──────────────────────────────────────────────┘
```

- Map image: `getMapImageUrl(eventId)` from Brawlify CDN
- Mode icon: `getGameModeImageUrl(mode)` 
- Brawler portraits: `getBrawlerPortraitUrl(id)` with CDN fallback
- Win rate bars color-coded: green ≥60%, yellow ≥50%, red <50%
- If < 100 total battles for a map: show "Datos limitados ⚠️" badge
- Expand shows top 10 with pick rate added

### 2.4 CTA for Premium

At the bottom of each card: banner linking to analytics subscription page.
If user is already premium: "Abrir Draft Tool →" links to their analytics page.

### 2.5 Empty State (Day 1)

Before enough data accumulates: "Estamos recopilando datos del meta global. Las recomendaciones aparecerán pronto." with a progress indicator (X batallas procesadas).

---

## 3. Premium Draft Tool (Analytics Tab)

### 3.1 Location

Rename analytics tab "Tools" (🛡️) to **"Draft" (⚔️)**. Contains:
- **3A: Map Recommendations** (triple column)
- **3B: Draft Simulator** (1-2-2-1)

### 3.2 Map Recommendations (Triple Column)

For each active 3v3 map, three columns of top 5 brawlers:

| Top Global 🏆 | Comunidad BrawlVision 🌍 | Personal ⭐ |
|---|---|---|
| source='global' | source='users' | User's battles table |
| Always available | "Próximamente" until data exists | "Juega partidas aquí para ver tus stats" |

- Brawlers the user **doesn't own**: dimmed with lock icon
- Brawlers the user **owns**: show power level badge (e.g., "PWR 11")
- Win rates with confidence indicator (see Section 4)

### 3.3 Draft Simulator — State Machine

```
States:
  IDLE → SELECT_MODE → SELECT_MAP → SELECT_STARTER → DRAFTING → COMPLETE

DRAFTING sub-states (Blue starts):
  Turn 1: BLUE picks 1  → slots [B1]
  Turn 2: RED picks 2   → slots [R1, R2]
  Turn 3: BLUE picks 2  → slots [B2, B3]
  Turn 4: RED picks 1   → slots [R3]

DRAFTING sub-states (Red starts):
  Turn 1: RED picks 1   → slots [R1]
  Turn 2: BLUE picks 2  → slots [B1, B2]
  Turn 3: RED picks 2   → slots [R2, R3]
  Turn 4: BLUE picks 1  → slots [B3]
```

Implemented as a **pure reducer** (`useReducer`) for testability.

**Actions:**
- `SELECT_MODE(mode)` → transitions to SELECT_MAP
- `SELECT_MAP(map)` → loads data, transitions to SELECT_STARTER
- `SELECT_STARTER('blue' | 'red')` → transitions to DRAFTING
- `PICK_BRAWLER(brawlerId)` → fills current slot, advances turn, recalculates recommendations
- `UNDO()` → empties current slot + all subsequent slots, goes back one step
- `RESET()` → returns to IDLE

### 3.4 Draft UI Layout

**Desktop (≥768px):**
```
┌──────────┐  ┌─────────────────────────┐  ┌──────────┐
│ 🔵 BLUE  │  │  [🔍 Search brawler...] │  │ 🔴 RED   │
│          │  │  [Tank|DPS|Sup|All]     │  │          │
│ [B1] ●   │  │  ┌──┬──┬──┬──┬──┬──┐   │  │ [R1]     │
│ [B2]     │  │  │  │  │  │  │  │  │   │  │ [R2]     │
│ [B3]     │  │  │  │  │  │  │  │  │   │  │ [R3]     │
│          │  │  └──┴──┴──┴──┴──┴──┘   │  │          │
│ [Ban 1]  │  │  (scrollable grid)      │  │ [Ban 1]  │
│ [Ban 2]  │  │                         │  │ [Ban 2]  │
│ (prox.)  │  │                         │  │ (prox.)  │
└──────────┘  └─────────────────────────┘  └──────────┘
┌──────────────────────────────────────────────────────┐
│ 📊 RECOMENDACIONES  (turno azul) / INFO (turno rojo) │
│ 🥇 Brawler X — 68% 🏆 · 71% ⭐                     │
│ 🥈 Brawler Y — 64% 🏆                               │
│ 🥉 Brawler Z — 62% 🏆 · 58% ⭐                     │
│ [Ver más ▼]                                          │
└──────────────────────────────────────────────────────┘
```

**Mobile (<768px):**
```
┌────────────────────────────────┐
│ 🔵 [B1●] [B2] [B3]   [R1] [R2] [R3] 🔴 │  ← sticky top
├────────────────────────────────┤
│ [🔍 Search...]                │
│ [Tank] [DPS] [Support] [All]  │
│ ┌──┬──┬──┬──┬──┬──┬──┬──┐    │
│ │  │  │  │  │  │  │  │  │    │  ← scrollable
│ ├──┼──┼──┼──┼──┼──┼──┼──┤    │
│ │  │  │  │  │  │  │  │  │    │
│ └──┴──┴──┴──┴──┴──┴──┴──┘    │
├────────────────────────────────┤
│ 📊 TOP 3 RECS (sticky bottom) │  ← sticky bottom
└────────────────────────────────┘
```

### 3.5 Brawler Grid

- All brawlers from BrawlAPI registry
- Each cell: 44×44px minimum (touch target), portrait image, name below (tiny)
- **Search**: filters grid in real-time by English name
- **Class filter**: tabs for Tank, Damage Dealer, Assassin, Support, Controller, Marksman, "Others/New" (for Unknown class). Default: "All"
- **Already picked**: crossed out / darkened, not clickable
- **Not owned** (if logged in): dimmed with small lock icon. Clickable but shows warning "No tienes este brawler"
- **Low power** (if logged in): visible badge "PWR 3" in orange if power < 7
- Lazy loading for images. Explicit width/height to prevent CLS.

### 3.6 Data Loading

When user selects map+mode, **one fetch**:

```
GET /api/draft/data?map=Hard%20Rock%20Mine&mode=gemGrab

Response: {
  meta: [{ brawlerId, wins, losses, total }],         // ~100 rows, source='global', last 14 days
  matchups: [{ brawlerId, opponentId, wins, losses }], // ~2000 rows, source='global', by mode
  usersData: [{ brawlerId, wins, losses, total }],     // source='users' (Comunidad BrawlVision)
  personal?: [{ brawlerId, wins, losses, total }],     // Premium only: user's own battles on this map
  userBrawlers?: [{ id, power }]                        // If authenticated: owned brawlers
}
```

~150KB total. **All recommendation recalculation is client-side** after this.

**Auth handling in endpoint:**
- No auth: returns meta + matchups only
- Auth (any): adds usersData + userBrawlers  
- Auth + premium: adds personal

### 3.7 Recommendation Algorithm (Client-Side)

For each candidate brawler B (not picked, optionally filtered by ownership):

```typescript
function score(B, map, mode, blueTeam, redTeam, data) {
  const meta = bayesianWR(data.meta[B])           // win rate on this map
  const counter = avgMatchupWR(B, redTeam, data)   // avg WR vs known enemies
  const personal = data.personal?.[B]              // user's own WR (premium)

  // Weights shift based on context
  let wMeta = 0.5, wCounter = 0.0, wPersonal = 0.0
  
  if (redTeam.length > 0) {
    wMeta = 0.25; wCounter = 0.5
  }
  if (personal && personal.total >= 3) {
    wPersonal = 0.2
    wMeta -= 0.1; wCounter -= 0.1
  }
  
  // Normalize weights to sum to 1
  const sum = wMeta + wCounter + wPersonal
  return (wMeta/sum * meta) + (wCounter/sum * counter) + (wPersonal/sum * personal?.wr ?? 0)
}
```

- `bayesianWR`: Bayesian average with α=30 towards 50%
- `avgMatchupWR`: average of matchup WRs vs each known enemy. Unknown matchups are skipped.
- Recalculates on every pick (instant — ~400 operations, microseconds)

### 3.8 Post-Draft Summary

When all 6 picks complete:
- Side-by-side team display (3 portraits vs 3 portraits)
- Estimated win probability for Blue team (aggregate of all matchup scores)
- Notable matchup callouts ("Shelly domina contra Colt en este modo: 68%")
- "Nuevo Draft" button → RESET
- "Compartir" button → future feature placeholder

### 3.9 Step Selectors UI

**Mode Selector (Step 1):**
Grid of mode icons (from `getGameModeImageUrl()`) with mode name below. Only DRAFT_MODES shown. Click selects, highlighted with gold border + glow.

**Map Selector (Step 2):**
Once mode selected, show active maps for that mode. Each as a card: map thumbnail + name. If only 1 map, auto-select.

**Starter Selector (Step 3):**
Simple toggle: two buttons "🔵 Azul primero" / "🔴 Rojo primero". Default: blue.

**Ban Slots (Future):**
2 greyed-out slots per team with ban icon and "Próximamente" text. Layout reserved.

---

## 4. Confidence Indicators (All Analytics)

### 4.1 Visual System

Add a consistent confidence indicator wherever win rates are displayed:

| Confidence | Games | Visual Treatment |
|------------|-------|-----------------|
| **High** 🟢 | ≥10 | Normal display, green dot |
| **Medium** 🟡 | 3-9 | Slightly muted text, yellow dot, tooltip "Dato con muestra limitada" |
| **Low** 🔴 | 1-2 | Very muted text (opacity 0.5), red dot, tooltip "Dato insuficiente — juega más partidas" |

### 4.2 Shared Component

```typescript
// src/components/ui/ConfidenceBadge.tsx
function ConfidenceBadge({ total }: { total: number }) {
  const conf = getConfidence(total) // from analytics/types.ts
  // Returns colored dot + tooltip
}
```

### 4.3 Components to Update

Add `ConfidenceBadge` to:
- MatchupMatrix (already has dots — standardize)
- BrawlerMapHeatmap
- OverviewStats (per-brawler win rates)
- CounterPickAdvisor (replaced, but new version will include it)
- PlayNowDashboard
- TeamSynergyView
- Any component showing win rate from personal data

---

## 5. Error States & Edge Cases

| Scenario | Behavior |
|----------|----------|
| BrawlAPI down + no cache | "No se pueden cargar los brawlers. Inténtalo más tarde." |
| meta_stats empty for a map | "Aún no tenemos datos para este mapa. Las recomendaciones aparecerán pronto." |
| < 100 battles in meta_stats for map | Show data with "⚠️ Datos limitados" badge |
| User has no battles on map (personal) | Personal column: "Juega partidas aquí para ver tus stats" |
| source='users' empty (Comunidad) | Column: "Próximamente — recopilando datos de la comunidad" |
| `/api/draft/data` fails | "Error cargando datos. Puedes usar el draft como tracker sin recomendaciones." |
| Proxy/Supercell down (cron) | Cron fails silently, retries next execution. No user impact. |
| User navigates away mid-draft | State lost. Drafts are quick (~2 min), not worth persisting. |
| Map rotation changes mid-draft | No impact — data already loaded as snapshot. |
| Brawler has "Unknown" class from BrawlAPI | Appears under "Otros" class filter tab. |
| Recommended brawler user doesn't own | Shown with lock icon + warning on selection. |

---

## 6. New Files

| File | Purpose |
|------|---------|
| `src/app/api/cron/meta-poll/route.ts` | Cron: poll top players, aggregate meta |
| `src/app/api/draft/data/route.ts` | Endpoint: draft page data (meta + matchups + personal) |
| `src/app/api/meta/route.ts` | Endpoint: public meta data for picks page |
| `src/app/[locale]/picks/page.tsx` | Public picks page (SSR) |
| `src/components/draft/DraftSimulator.tsx` | Main draft orchestrator component |
| `src/components/draft/BrawlerGrid.tsx` | Brawler selection grid with search + class filter |
| `src/components/draft/TeamSlots.tsx` | Blue/Red team slot display |
| `src/components/draft/RecommendationPanel.tsx` | Top 3 + expandable recommendations |
| `src/components/draft/ModeSelector.tsx` | Game mode icon grid |
| `src/components/draft/MapSelector.tsx` | Map selection cards |
| `src/components/draft/DraftSummary.tsx` | Post-draft result screen |
| `src/components/picks/MapCard.tsx` | Public page: map recommendation card |
| `src/components/ui/ConfidenceBadge.tsx` | Reusable confidence indicator |
| `src/lib/draft/scoring.ts` | Recommendation algorithm (client-side) |
| `src/lib/draft/types.ts` | Types for draft feature |
| `src/lib/draft/state.ts` | Draft state machine (useReducer) |
| `src/lib/draft/constants.ts` | DRAFT_MODES, scoring weights |
| `src/lib/brawler-registry.ts` | BrawlAPI fetch + cache logic |

## 7. Modified Files

| File | Change |
|------|--------|
| `src/app/api/cron/sync/route.ts` | Add meta_stats/meta_matchups aggregation for premium user battles |
| `src/app/[locale]/profile/[tag]/analytics/page.tsx` | Rename tab, add draft content |
| `src/lib/api.ts` | Add `fetchRankings('global')` helper if not already exported |
| `src/app/sitemap.ts` | Add `/picks` route |
| `src/app/robots.ts` | Allow `/picks` |
| `messages/*.json` (×13) | Translations for draft UI, picks page, confidence labels |
| Multiple analytics components | Add ConfidenceBadge where win rates are shown |

## 8. Database Migrations

1. Create `meta_stats` table + index + RLS
2. Create `meta_matchups` table + index + RLS
3. Create `meta_poll_cursors` table + RLS
4. Battles retention: premium users keep full history (1-2 years minimum — they pay for it). Only meta_stats/meta_matchups/meta_poll_cursors have aggressive cleanup (30 days for rolling window). Monitor storage usage in Supabase and adjust if approaching limits.

## 9. Pre-Launch Checklist

- [ ] BrawlAPI brawler ID validation vs Supercell API IDs
- [ ] Run meta-poll cron manually 5-6 times to seed initial data (~25,000 battles)
- [ ] Verify meta_stats has > 100 battles for at least 5 active maps before enabling public page
- [ ] Test draft state machine with both "blue first" and "red first" variants
- [ ] Test mobile layout at 375px width
- [ ] Verify ISR caching on public page
- [ ] Translations complete for all 13 locales

## 10. Known Limitations (Documented, Not Bugs)

1. **Brawler names in English only** in the search grid. Visual portraits compensate. Multilingual search is a future improvement.
2. **Synergy data ("how well do brawlers work together")** shows "Próximamente" until we accumulate enough team composition data.
3. **Bans** are visually reserved but not functional yet.
4. **Star Power / Gadget influence** not tracked in meta (aggregated at brawler level).
5. **Double-counting** from polling: if two polled players are in the same battle, it's counted from both perspectives. At 200/millions players, impact is < 0.1% and proportional (doesn't skew ratios).
6. **New brawler releases**: appear in grid within 24h (BrawlAPI cache refresh) but have no meta data initially. Shown with "Nuevo — sin datos aún" indicator.

## 11. Testing Requirements

| Test | Type | What it validates |
|------|------|-------------------|
| Bayesian average with small samples | Unit | `bayesianWR(3, 3) ≈ 54.5%`, not 100% |
| Pick order 1-2-2-1 (both variants) | Unit | Correct slot sequence for blue/red start |
| Undo cascades correctly | Unit | Undo pick 2 also clears pick 3+ |
| Cron battle filtering | Unit | Excludes friendly, showdown, draws, non-3v3 |
| Cron player identification in teams | Unit | Finds player by tag, not by team index |
| Bulk UPSERT accumulation | Integration | Two battles of same brawler/map = +2 wins |
| Draft reducer full cycle | Unit | IDLE → ... → COMPLETE with all transitions |
| `/api/draft/data` auth levels | Integration | Anon gets meta only, premium gets all |
| Scoring algorithm ranking | Unit | Known inputs → expected top 3 order |
| BrawlAPI ID validation | Setup | Cross-check IDs match Supercell API |
