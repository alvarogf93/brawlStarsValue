# Brawler Detail Page — Design Spec

**Date:** 2026-04-09
**Status:** Reviewed (design system audit pass)
**Route:** `/[locale]/profile/[tag]/brawlers/[brawlerId]`

---

## 1. Vision

A dedicated page per brawler that tells the story of that character in two layers:

1. **Capa pública (free):** Ficha del brawler con datos globales del meta — win rates, mejores mapas, counters, tríos. Atrae a todos los jugadores y genera SEO.
2. **Capa personal (premium):** Diagnóstico comparativo — tu rendimiento vs el meta/pros, mastery timeline, recomendaciones. Secciones visibles con blur + CTA para free users.

La página vive bajo `/brawlers/[brawlerId]` como sub-ruta hija de la lista de brawlers. Se accede clicando un brawler card en la grid existente.

---

## 2. Architecture

### 2.1 Route

```
src/app/[locale]/profile/[tag]/brawlers/[brawlerId]/page.tsx
```

- `brawlerId` = Supercell numeric ID (e.g., `16000000` for Shelly)
- **MUST stay inside `DashboardLayoutClient` layout** (header + sidebar + footer) — same layout as all profile pages. The route inherits the layout from `src/app/[locale]/profile/[tag]/layout.tsx` automatically. No custom layout, no full-screen breakout.
- Client component (`'use client'`) — consistent with all other profile pages (brawlers, analytics, battles, stats all use client components with hooks)

### 2.2 Navigation Changes

**Sidebar (`Sidebar.tsx`):**
- Change `isActive` logic from exact match (`pathname === href`) to prefix match for brawlers: `pathname === href || pathname.startsWith(href + '/')` so "Brawlers" stays highlighted on detail pages.

**Brawlers Grid (`brawlers/page.tsx`):**
- Each brawler card becomes a `<Link>` to `/brawlers/{brawlerId}`
- Add a subtle hover effect to signal clickability (scale + glow)

**Detail Page:**
- Back button at top: "← Volver a Brawlers" linking to `/brawlers`

### 2.3 Data Sources

| Data | Source | New? | Gated? |
|------|--------|------|--------|
| Brawler profile (power, rank, trophies, upgrades) | `usePlayerData` → `BrawlerStat` | No | No |
| Brawler registry (name, class, rarity, imageUrl) | `brawler-registry.ts` localStorage cache | No | No |
| Meta stats (global WR, pick rate per map/mode) | Supabase `meta_stats` table via new API | **Yes** | No |
| Meta matchups (global counters) | Supabase `meta_matchups` table via new API | **Yes** | No |
| Pro analysis (pro WR, trends, counters) | Existing `/api/meta/pro-analysis` filtered by brawler | Partial | No |
| Personal analytics (WR, maps, matchups, mastery) | Existing `useAdvancedAnalytics` filtered by brawlerId | No | **Premium** |
| Personal battles (calendar, recent games) | Existing `useBattlelog` filtered by brawlerId | No | **Premium** |

### 2.4 New API Endpoint

**`GET /api/meta/brawler-detail?brawlerId=X&window=14`**

Returns aggregated meta data for a single brawler across all modes/maps:

```typescript
interface BrawlerMetaResponse {
  brawlerId: number
  globalStats: {
    winRate: number       // Bayesian-adjusted
    pickRate: number      // % of total battles
    totalBattles: number
    trend7d: number       // WR delta vs 7 days ago
  }
  bestMaps: Array<{
    map: string
    mode: string
    eventId: number | null
    winRate: number
    totalBattles: number
  }>  // top 5 by Wilson score
  worstMaps: Array<{...}>  // bottom 5
  strongAgainst: Array<{
    opponentId: number
    opponentName: string
    winRate: number
    totalBattles: number
  }>  // top 5 countered opponents
  weakAgainst: Array<{...}>  // top 5 counters
  bestTeammates: Array<{
    teammateId: number
    teammateName: string
    winRate: number
    totalBattles: number
  }>  // top 5 by WR when played together
}
```

**Source:** Query `meta_stats` and `meta_matchups` Supabase tables. Key columns:
- `meta_stats`: `brawler_id`, `map`, `mode`, `source` ('global'|'users'), `date`, `wins`, `losses`, `total`
- `meta_matchups`: `brawler_id`, `opponent_id`, `mode`, `source`, `date`, `wins`, `losses`, `total`

Filter: `brawler_id = X`, `source = 'global'`, `date >= cutoffDate` (rolling window). Aggregate across dates/maps. Apply `bayesianWinRate()` from `src/lib/draft/scoring.ts`.

**Note:** `meta_stats` is per map+mode, so for "best maps" we group by map and rank. For global WR we sum across all maps. `meta_matchups` is per mode (not per map), so counters are mode-agnostic within the window.

**Note:** `bestTeammates` requires trio data. The `trios` accumulator exists in `meta-accumulator.ts` but there is NO `meta_trios` Supabase table yet — trios are only stored in `meta_stats` via the cron sync. Two options:
- **Option A (recommended):** Derive teammates from the player's own battles (filter by brawlerId, find most common teammates with highest WR). This works for both free meta view (from pro battles) and personal view.
- **Option B:** Create a `meta_trios` table. Out of scope for v1.

For v1, use Option A: query battles where `my_brawler.id = X`, extract teammate brawler IDs, aggregate by teammate → WR.

---

## 3. UI Sections

### 3.1 Hero Banner (Public)

Full-width banner with brawler's rarity color gradient.

**Content:**
- Brawler portrait (large, 120x120 mobile / 160x160 desktop) from `/assets/brawlers/{id}.png` with Brawlify CDN fallback
- Brawler name — `font-['Lilita_One']`, 2xl/3xl
- Class label (e.g., "Damage Dealer") — from brawler-registry `class` field
- Rarity badge with rarity color (using `RARITY_COLORS` — currently defined locally in `brawlers/page.tsx` and `BrawlerParade.tsx` with DIFFERENT values; extract to shared constant in `src/lib/constants.ts` before using in detail page)
- Back button: "← Brawlers"

**Player's stats row (if player owns this brawler):**
- Power level badge (P11, purple border)
- Rank badge (R35)
- Trophies + personal best
- Prestige icon (if applicable)
- Upgrades: star powers, gadgets, hypercharges icons (reuse existing card logic)

**If player doesn't own the brawler:**
- Show "No desbloqueado" badge
- Still show meta data below

**Rarity gradient backgrounds:**
- Use `RARITY_COLORS` map for gradient: `bg-gradient-to-r from-{rarityColor}/20 to-transparent`

### 3.2 Meta Intelligence (Public)

**Stats Overview Cards (2x2 grid on mobile, 4-col on desktop):**
- Win Rate global (with trend arrow ↑↓)
- Pick Rate global
- Total Pro Battles analyzed
- Trending indicator (Rising/Stable/Falling based on trend7d)

**Best Maps Section:**
- Title: "Mejores Mapas"
- Grid of top 5 maps: map thumbnail (`getMapImageUrl`), mode icon (`getGameModeImageUrl`), map name, WR%
- Color-coded WR (green > 55%, yellow 45-55%, red < 45%)

**Counters Section — two sub-cards:**
- "Fuerte contra" — top 5 opponents this brawler beats, with portrait + WR
- "Débil contra" — top 5 opponents that counter this brawler, with portrait + WR
- Each entry: brawler portrait (40x40), name, WR bar

**Best Teammates:**
- "Mejores compañeros"
- Top 5 teammates by WR when paired, brawler portrait + name + WR

### 3.3 Personal Analysis (Premium — Blurred for Free)

**Header:** "Tu rendimiento con {BrawlerName}"

**Comparison Cards (2-col grid):**
- "Tu Win Rate" vs "Meta Win Rate" — two large numbers with visual comparison (green if above, red if below)
- "Partidas jugadas" — total battles with this brawler
- "Comfort Score" — from existing analytics, 0-100

**Personal Map Heatmap:**
- Table/grid of maps the player has played with this brawler
- Columns: Map name, Mode icon, Games, Your WR, Meta WR, Difference
- Color-coded difference: green (you're above meta), red (below)
- Sorted by games played descending

**Personal Matchups:**
- Table of opponents faced with this brawler
- Columns: Opponent portrait, Name, Games, Your WR, Meta WR, Diff
- Sorted by games played descending
- Min 3 games to show (avoid noise)

**Mastery Timeline:**
- Line chart (framer-motion animated) of cumulative WR over time
- X-axis: dates, Y-axis: WR%
- Data from existing `brawlerMastery` in AdvancedAnalytics
- Shows progression: "Has mejorado 12% con este brawler en 30 días"

**Activity Calendar:**
- GitHub-style contribution grid showing days the player used this brawler
- Color intensity = number of games that day
- From battle timestamps filtered by brawlerId
- Compact: last 90 days

**Recommendations Engine:**
- 3-5 actionable tips generated from data comparison:
  - "Juega {Brawler} en {Map} — tu WR es {X}% por encima del meta"
  - "Evita {Brawler} contra {Opponent} — pierdes {X}% más que la media"
  - "Prueba con {Teammate} — el meta muestra {Y}% WR en equipo"
- Logic: compare personal map/matchup WR vs meta, flag top gaps

### 3.4 Free User Blur + CTA

Use existing `BlurredTeaser` component from `src/components/premium/BlurredTeaser.tsx` — NOT a new `PremiumBlur` component. The project already has this solved:
- Blur: `blur-sm pointer-events-none select-none opacity-60`
- Overlay: `absolute inset-0 flex flex-col items-center justify-center bg-[#121A2F]/60 backdrop-blur-[2px]`
- CTA: checks auth state, shows login or checkout button
- Props: `children` (content to blur) + `redirectTo?` (post-checkout redirect)

Wrap all of section 3.3 inside `<BlurredTeaser>` when `!isPremium(profile)`.
- First 2 stats of the comparison cards are visible OUTSIDE the blur (teaser)
- Rest is inside `<BlurredTeaser>`

---

## 4. Component Structure

```
src/components/brawler-detail/
├── HeroBanner.tsx          — Brawler hero with rarity gradient + player stats
├── MetaIntelligence.tsx    — Public meta cards, maps, counters, teammates
├── PersonalAnalysis.tsx    — Premium wrapper: comparison, maps, matchups
├── MasteryTimeline.tsx     — Line chart of WR progression
├── ActivityCalendar.tsx    — GitHub-style usage calendar
└── BrawlerRecommendations.tsx — Actionable tips from data gaps

**Reused from existing codebase (NOT new):**
- `BlurredTeaser` from `src/components/premium/BlurredTeaser.tsx` — premium blur overlay
- `Skeleton`, `SkeletonCard`, `SkeletonRow` from `src/components/ui/Skeleton.tsx` — loading states
- `BrawlImg` from `src/components/ui/BrawlImg.tsx` — image with fallback
- `InfoTooltip` from `src/components/ui/InfoTooltip.tsx` — help tooltips
```

**Page file:** `src/app/[locale]/profile/[tag]/brawlers/[brawlerId]/page.tsx`
- Client component (`'use client'`)
- Params: `const params = useParams<{ tag: string; brawlerId: string }>()` then `const brawlerId = parseInt(params.brawlerId, 10)` and `const tag = decodeURIComponent(params.tag)` — follows existing pattern from stats/page.tsx
- Hooks: `usePlayerData(tag)`, `useBrawlerMeta(brawlerId, window)`, conditionally `useAdvancedAnalytics(tag)` for premium
- Finds the specific `BrawlerStat` from `data.player.brawlers.find(b => b.id === brawlerId)`
- Resolves brawler name/class/rarity from `brawler-registry.ts` cache (fallback if not in player roster)
- Loading: return `<BrawlerDetailSkeleton />` — new skeleton component following `Skeleton`/`SkeletonCard`/`SkeletonRow` patterns from `src/components/ui/Skeleton.tsx`
- Error: `<div className="glass p-8 rounded-2xl text-center border-red-500/30">` — matches stats/page.tsx pattern
- Root wrapper: `<div className="animate-fade-in w-full pb-10 space-y-6">` — matches all profile pages

**New hook:** `src/hooks/useBrawlerMeta.ts`
- Fetches `/api/meta/brawler-detail?brawlerId=X&window=Y`
- Cache key: `brawlvalue:brawler-meta:${brawlerId}:${window}`
- TTL: 10 minutes (consistent with longer-lived meta data vs 2-5 min player data)
- Return shape: `{ data: BrawlerMetaResponse | null, isLoading: boolean, error: string | null }` — matches `usePlayerData` pattern
- AbortController cleanup on unmount — matches existing hooks

---

## 5. Modified Files

| File | Change |
|------|--------|
| `src/components/layout/Sidebar.tsx` | `isActive` → use `startsWith` for `/brawlers` sub-routes |
| `src/app/[locale]/profile/[tag]/brawlers/page.tsx` | Wrap each brawler card `<div>` in `<Link href={\`\${basePath}/brawlers/\${brawler.id}\`}>`, add hover effect |
| `src/lib/constants.ts` | Extract shared `RARITY_COLORS` (currently duplicated in brawlers/page.tsx and BrawlerParade.tsx with different values) |
| `src/i18n/messages/es.json` (+ 12 other locales) | Add `brawlerDetail` namespace with labels |

---

## 6. Translations

New namespace `brawlerDetail`:

```json
{
  "brawlerDetail": {
    "backToBrawlers": "← Brawlers",
    "notUnlocked": "No desbloqueado",
    "metaTitle": "Inteligencia Meta",
    "winRate": "Win Rate",
    "pickRate": "Pick Rate",
    "proBattles": "Batallas PRO",
    "trending": "Tendencia",
    "rising": "Subiendo",
    "falling": "Bajando",
    "stable": "Estable",
    "bestMaps": "Mejores Mapas",
    "worstMaps": "Peores Mapas",
    "strongAgainst": "Fuerte contra",
    "weakAgainst": "Débil contra",
    "bestTeammates": "Mejores Compañeros",
    "personalTitle": "Tu rendimiento con {brawler}",
    "yourWR": "Tu Win Rate",
    "metaWR": "Meta Win Rate",
    "gamesPlayed": "Partidas",
    "comfortScore": "Comfort Score",
    "mapPerformance": "Rendimiento por Mapa",
    "matchups": "Enfrentamientos",
    "mastery": "Progresión",
    "calendar": "Actividad",
    "recommendations": "Recomendaciones",
    "unlockPersonal": "Desbloquea tu análisis personal",
    "unlockCta": "Hazte PRO",
    "tipPlay": "Juega {brawler} en {map} — tu WR es {diff}% por encima del meta",
    "tipAvoid": "Evita {brawler} contra {opponent} — pierdes {diff}% más que la media",
    "tipTeam": "Prueba con {teammate} — el meta muestra {wr}% WR en equipo",
    "improved": "Has mejorado {diff}% en {days} días",
    "games": "partidas",
    "difference": "Diferencia"
  }
}
```

---

## 7. Auth & Premium Gating

**Premium detection:** Use existing `useAuth()` hook + `isPremium(profile)` from `src/lib/premium.ts`. Same pattern as analytics page.

**Behavior by tier:**
| Tier | Hero | Meta Intelligence | Personal Analysis |
|------|------|-------------------|-------------------|
| Free (no login) | Full | Full | Blurred + CTA |
| Free (logged in) | Full + own stats | Full | Blurred + CTA |
| Premium | Full + own stats | Full | Full |

**Key:** The page itself is NOT gated — everyone can access it. Only section 3.3 (Personal Analysis) has premium blur. This is different from the analytics page which redirects free users to `/subscribe`.

**No redirect.** Free users see valuable meta content. The blur on personal stats is the conversion mechanism.

---

## 8. Design System Compliance

All new components MUST use existing CSS classes and patterns. No new CSS classes or custom styles outside the established system.

**Card containers:**
- Hero banner: `.brawl-card` with rarity gradient overlay
- Meta sections: `.brawl-card-dark p-5 md:p-6 border-[#090E17]`
- Stat cards: `.brawl-card-dark` with inner content

**Typography:**
- Section titles: `font-['Lilita_One'] text-lg text-white flex items-center gap-2`
- Emoji/icon BEFORE title text, with `gap-2`
- Subtitles: `text-sm text-slate-400`
- Data values: `font-['Lilita_One'] text-2xl` or `text-3xl`

**Colors:**
- Positive/win: `text-green-400` or `text-emerald-400`
- Negative/loss: `text-red-400`
- Neutral: `text-slate-400`
- Gold/accent: `text-[#FFC91B]`
- Backgrounds: `bg-[#0F172A]` (dark), `bg-white/5` (glass)

**Spacing:**
- Between sections: `space-y-6` (root container)
- Grid gaps: `gap-3` (tight), `gap-4` (medium), `gap-6` (loose)
- Card padding: `p-5 md:p-6`

**Responsive breakpoints:**
- Mobile-first, scale up: `md:` for tablet, `xl:` for desktop
- Grid columns: `grid-cols-2 md:grid-cols-4` for stat cards

**Animations:**
- Page entry: `animate-fade-in` on root wrapper
- No custom animations — use existing Tailwind + framer-motion patterns

---

## 9. Testing Strategy

**Framework:** Vitest (NOT Jest). Import from `vitest`: `describe`, `it`, `expect`, `vi`, `beforeEach`.

**Test files:**
1. `src/__tests__/unit/lib/brawler-detail.test.ts` — Pure function tests for recommendation logic, data filtering, comparison calculations
2. `src/__tests__/integration/api/brawler-detail.test.ts` — API endpoint test: validates response shape, error handling, Supabase query construction

**Patterns to follow:**
- Mock Supabase: `vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))`
- Use fixtures from `src/__tests__/fixtures/` — extend `battle.fixture.ts` if needed
- Test edge cases: invalid brawlerId, 0 battles, <3 battles threshold
- No snapshot tests (project doesn't use them)

**What to test:**
- Recommendation generation logic (pure function, high value)
- Activity calendar date bucketing (pure function)
- API endpoint input validation and response shape
- Meta data aggregation + Bayesian WR calculation
- NOT testing React components directly (project pattern: test logic, not UI)

---

## 10. Performance

- **Meta API caching:** The `/api/meta/brawler-detail` endpoint queries aggregated tables, not raw battles. Should respond in <500ms. Cache in localStorage (10-min TTL).
- **Personal data:** Already computed by `useAdvancedAnalytics` — just filter client-side by `brawlerId`. No additional API call needed for premium data.
- **Images:** All brawler portraits are local (`/assets/brawlers/`). Map images from Brawlify CDN — already used elsewhere.
- **Bundle:** New components are leaf nodes — no impact on other page bundles. Dynamic import the chart component (MasteryTimeline) to reduce initial load.

---

## 11. Edge Cases

| Case | Behavior |
|------|----------|
| Player doesn't own the brawler | Show hero with "No desbloqueado", hide personal section entirely, show full meta |
| Brawler has 0 meta battles | Show "Datos insuficientes" placeholder in meta section |
| Player has <3 battles with brawler | Show personal section but with "low confidence" badges, hide recommendations |
| Invalid brawlerId in URL | Redirect to `/brawlers` with error toast |
| New brawler not in registry | Fetch from API fallback, show generic portrait |

---

## 12. Mobile Responsiveness

- **Hero banner:** Stack vertically — portrait on top, stats below
- **Meta cards:** 2x2 grid on mobile, 4-col on desktop
- **Maps/Counters:** Horizontal scroll cards on mobile, grid on desktop
- **Personal tables:** Horizontal scroll with sticky first column
- **Calendar:** Compact 90-day view with smaller cells
- **Chart:** Full width, touch-friendly tooltips

---

## 13. Out of Scope (YAGNI)

- **Global brawler page for SEO (`/[locale]/brawler/[name]`)** — public page WITHOUT profile layout, accessible without player tag. Shows only meta data. This is a v2 feature that would drive organic traffic. Different route, different layout, different data source. NOT this spec.
- Skin showcase gallery
- Build/loadout recommendations
- Video replays
- Social sharing of brawler stats
- Comparison between two brawlers
- `meta_trios` Supabase table (use battle-derived teammate data for v1)
