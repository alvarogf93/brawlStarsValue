# Meta UX Remediation Implementation Plan (Sprint C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every meta metric the user sees honest about its confidence, explain every empty state contextually, and remove one real redundancy between `TopBrawlersGrid` and `CounterQuickView` by inlining counters into the primary card view.

**Architecture:** Zero new production TS/TSX files. Zero table structure changes. One migration that adds a non-destructive index (`012_meta_stats_mode_index.sql`) to make the new Tier 2 mode-fallback query use a leading-column match instead of an index skip-scan. Cascade logic (~15 lines) inlined directly into `/api/meta/pro-analysis/route.ts` and `/api/meta/route.ts`. `ConfidenceBadge` (already in 6 components) is added to 4 more call sites. `CounterQuickView` is deleted and its data is rendered inline in each `TopBrawlersGrid` card.

**Tech Stack:** Next.js 16 App Router (Node runtime), TypeScript strict, `@supabase/supabase-js` via `createServerClient` in API routes, React 19, `next-intl` v4 (13 locales), `@testing-library/react` + `vitest` for component tests (pattern from `src/__tests__/unit/components/ConfidenceBadge.test.tsx`), Tailwind CSS v4, `ConfidenceBadge` component (already uses `RELIABLE_GAMES=10` / `CONFIDENT_GAMES=3` thresholds).

**Design spec:** `docs/superpowers/specs/2026-04-13-meta-ux-remediation-design.md` (v3, commit `dabb7d1`). This plan is a direct translation of that spec — if you find a contradiction, the spec wins and you should flag it before changing anything.

---

## Scope Check

Single coherent sprint. No decomposition needed. 16 tasks across 9 phases (A–I). Every task produces working, testable software that builds on the previous merges and keeps `main` green.

---

## File Structure

**Create (2 files):**
- `supabase/migrations/012_meta_stats_mode_index.sql` — one-line `CREATE INDEX CONCURRENTLY` on `(mode, source, date)`
- `scripts/add-meta-ux-translations.js` — one-shot Node script that batch-updates all 13 locale JSON files

**Create (tests — 4 files):**
- `src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx`
- `src/__tests__/unit/components/brawler-detail/MetaIntelligence.test.tsx`
- `src/__tests__/unit/components/picks/MapCard.test.tsx`
- `src/__tests__/integration/api/meta/pro-analysis-cascade.test.ts`

**Modify (8 TS/TSX files):**

| File | Reason |
|---|---|
| `src/lib/draft/pro-analysis.ts` | Add `topBrawlersSource` to `ProAnalysisResponse` |
| `src/app/api/meta/pro-analysis/route.ts` | Tier 2 mode-fallback + set `topBrawlersSource` on response |
| `src/app/api/meta/route.ts` | Tier 2 per-mode batch fallback + add `Cache-Control` header + source flag per map |
| `src/components/analytics/TopBrawlersGrid.tsx` | Per-card `totalBattles` + `ConfidenceBadge` + mode-fallback banner + inline counters section |
| `src/components/analytics/MetaProTab.tsx` | Remove `CounterQuickView` import/usage, pass `counters` to `TopBrawlersGrid` |
| `src/components/picks/MapCard.tsx` | Promoted sample-size text + mode-fallback banner + contextual empty state |
| `src/components/brawler-detail/MetaIntelligence.tsx` | Per-row `totalBattles` + `ConfidenceBadge` on all 3 lists + contextual empty states |
| `src/components/analytics/MatchupMatrix.tsx` | Title clarity update (one-line change: `matchupsTitle` → `matchupsTitleExplicit`) |

**Modify (13 locale files via batch script):**
`messages/{ar,de,en,es,fr,it,ja,ko,pl,pt,ru,tr,zh}.json` — add 11 new keys under `metaPro`, `brawlerDetail`, `picks`, and `advancedAnalytics` namespaces; delete the 2 obsolete `metaPro.counterTitle` and `metaPro.counterHint` keys.

**Delete (1 file):**
- `src/components/analytics/CounterQuickView.tsx`

**Untouched (explicitly):**
- `src/hooks/useProAnalysis.ts` — passes the response through transparently via its module-level cache
- `src/lib/brawler-detail/types.ts` — `MatchupStat.totalBattles` already exists
- `src/components/ui/ConfidenceBadge.tsx` — consumed as-is, no modifications
- `src/lib/analytics/types.ts` — `Confidence`, `RELIABLE_GAMES`, `CONFIDENT_GAMES` stay as-is
- `src/lib/draft/scoring.ts` — `bayesianWinRate` stays untouched
- Any meta-poll cron file (`src/app/api/cron/meta-poll/*`, `src/lib/draft/meta-accumulator.ts`)

**Reference constants you will need:**
- `PRO_MIN_BATTLES_DISPLAY` lives in `src/lib/draft/constants.ts` and is the threshold below which a brawler is not shown in the top-brawlers list.
- `META_ROLLING_DAYS` also lives there — default 14, used as the event-rotation window in `/api/meta/route.ts`.
- `RELIABLE_GAMES = 10` and `CONFIDENT_GAMES = 3` live in `src/lib/analytics/types.ts` and drive `ConfidenceBadge`.
- `ConfidenceBadge` takes a single prop `total: number` and renders a 2×2px dot with a hover tooltip. Low-confidence wrappers automatically get `opacity-50`. When `total === 0` it returns `null`.

---

## Task 1 — Migration 012: mode-only lookup index

**Files:**
- Create: `supabase/migrations/012_meta_stats_mode_index.sql`

**Why first:** The cascade in Task 3 and Task 4 issues a `WHERE source=... AND mode IN (...) AND date >= ...` query against `meta_stats`. The existing index `idx_meta_stats_lookup ON meta_stats(map, mode, source, date)` starts with `map`, so dropping the map filter forces Postgres into a less efficient skip-scan. Adding a leading-column index on `(mode, source, date)` makes the cascade's Tier 2 path use a real index match. This is the only SQL change in Sprint C and it must land first so the cascade tasks never benchmark against a missing index.

- [ ] **Step 1.1 — Create the migration file**

Create `supabase/migrations/012_meta_stats_mode_index.sql` with exactly this content:

```sql
-- ═══════════════════════════════════════════════════════════════
-- Sprint C — Meta UX Remediation
-- Index for the Tier 2 mode-only fallback query.
-- ═══════════════════════════════════════════════════════════════
--
-- /api/meta/pro-analysis and /api/meta (event rotation) issue a
-- Tier 1 query that filters meta_stats by (map, mode, source, date).
-- When Tier 1 returns no brawlers above the PRO_MIN_BATTLES_DISPLAY
-- threshold (sparse Tier D maps like heist::Pit Stop), the code
-- falls back to Tier 2: the same query WITHOUT the map filter.
--
-- Existing index:
--   idx_meta_stats_lookup ON meta_stats(map, mode, source, date)
--   Leads with `map`, so Tier 2 triggers a skip-scan.
--
-- New index:
--   idx_meta_stats_mode_lookup ON meta_stats(mode, source, date)
--   Leading-column match for Tier 2.
--
-- CREATE INDEX CONCURRENTLY does not lock the table while building,
-- so it is safe to apply on production during any deploy window.
-- Reversible with DROP INDEX.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meta_stats_mode_lookup
  ON meta_stats(mode, source, date);
```

- [ ] **Step 1.2 — Verify the file parses as SQL**

Run a dry syntax check by reading the file back:

```bash
cat supabase/migrations/012_meta_stats_mode_index.sql
```

Expected: the file content prints cleanly with no shell errors. (The repo has no local SQL linter, so this step is visual validation only.)

- [ ] **Step 1.3 — Commit**

```bash
git add supabase/migrations/012_meta_stats_mode_index.sql
git commit -m "feat(meta): add mode-only index for Tier 2 fallback query"
```

- [ ] **Step 1.4 — Surface for manual application**

Add a note to the PR description (or to the user directly) that this migration must be applied manually via the Supabase Dashboard SQL Editor after merge, following the same flow as migrations 010 and 011. The `CREATE INDEX CONCURRENTLY` runs in a few seconds on a table with a few thousand rows.

There is no test for this task — index existence is verified at runtime by the cascade integration test in Task 3.

---

## Task 2 — Extend `ProAnalysisResponse` with `topBrawlersSource`

**Files:**
- Modify: `src/lib/draft/pro-analysis.ts`

**Why now:** Task 3 will populate this field in the API route; Task 6 will read it in the UI. Landing the type change first means the intermediate commits (after Task 3 but before Task 6) are still type-clean.

- [ ] **Step 2.1 — Add the new field to the interface**

Edit `src/lib/draft/pro-analysis.ts`. Find the `ProAnalysisResponse` interface (lines 5-28 approximately) and add the new field inside the "PUBLIC" section:

```ts
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

  // === PREMIUM ONLY (null for free users) ===

  dailyTrend: DailyTrendEntry[] | null

  proTrios: ProTrioEntry[] | null

  personalGap: GapEntry[] | null

  matchupGaps: MatchupGapEntry[] | null
}
```

- [ ] **Step 2.2 — Verify typecheck still clean**

Run:

```bash
npx tsc --noEmit
```

Expected: FAIL with one or more errors in `src/app/api/meta/pro-analysis/route.ts` because the response literal there no longer matches the interface (missing the new required field). This is the signal that the type change has propagated. We will fix it in Task 3.

If `tsc` passes, the field was not actually added correctly — re-open the file and re-verify.

- [ ] **Step 2.3 — Commit (with expected build break)**

Because Task 3 immediately follows and fixes the typecheck gap, this commit is allowed to land with a temporary compile error on the API route file. The branch workflow runs Task 2 and Task 3 in the same subagent dispatch.

```bash
git add src/lib/draft/pro-analysis.ts
git commit -m "feat(meta): add topBrawlersSource field to ProAnalysisResponse"
```

---

## Task 3 — Tier 2 mode-fallback in `/api/meta/pro-analysis/route.ts`

**Files:**
- Modify: `src/app/api/meta/pro-analysis/route.ts`
- Create: `src/__tests__/integration/api/meta/pro-analysis-cascade.test.ts`

**Why:** This is the core of Problem A — when `heist::Pit Stop` has 2 battles, the Tier 1 query returns `allBrawlers.length === 0` after the `PRO_MIN_BATTLES_DISPLAY` filter, and the current code serves that empty list to the client. Tier 2 re-runs the aggregation without the map filter and sets `topBrawlersSource: 'mode-fallback'` so the UI can explain the substitution.

- [ ] **Step 3.1 — Write the failing integration test**

Create `src/__tests__/integration/api/meta/pro-analysis-cascade.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Supabase mock ─────────────────────────────────────────────
// Each query's response is queued in `queueByTable` keyed by the
// table name. The `from()` mock returns a chainable builder that
// resolves to the next response for that table.

type QueuedResponse = { data: unknown; error?: unknown }
const queueByTable: Record<string, QueuedResponse[]> = {}

function enqueue(table: string, response: QueuedResponse) {
  if (!queueByTable[table]) queueByTable[table] = []
  queueByTable[table].push(response)
}

function makeBuilder(response: QueuedResponse) {
  const methods = ['select', 'eq', 'gte', 'lte', 'in', 'order', 'limit', 'maybeSingle']
  const builder: Record<string, unknown> = {}
  for (const m of methods) builder[m] = () => builder
  // thenable — `await builder` resolves to response
  builder.then = (resolve: (v: QueuedResponse) => unknown) => resolve(response)
  return builder
}

const fromMock = vi.fn((table: string) => {
  const queue = queueByTable[table]
  if (!queue || queue.length === 0) {
    throw new Error(`No queued response for table "${table}"`)
  }
  return makeBuilder(queue.shift()!)
})

const authGetUserMock = vi.fn(async () => ({ data: { user: null } }))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    from: fromMock,
    auth: { getUser: authGetUserMock },
  }),
}))

vi.mock('@/lib/draft/brawler-names', () => ({
  loadBrawlerNames: vi.fn(async () => new Map<number, string>([
    [1, 'CROW'],
    [2, 'PIPER'],
    [3, 'BULL'],
  ])),
  getBrawlerName: (names: Map<number, string>, id: number) =>
    names.get(id) ?? `#${id}`,
}))

// Import AFTER mocks
import { GET } from '@/app/api/meta/pro-analysis/route'

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/meta/pro-analysis')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url, { method: 'GET' })
}

beforeEach(() => {
  for (const k of Object.keys(queueByTable)) delete queueByTable[k]
  fromMock.mockClear()
  authGetUserMock.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/meta/pro-analysis — cascade behaviour', () => {
  it('returns topBrawlersSource="map-mode" when the map has data', async () => {
    // Tier 1: current window stats with real data
    enqueue('meta_stats', {
      data: [
        { brawler_id: 1, wins: 80, losses: 20, total: 100, date: '2026-04-13' },
        { brawler_id: 2, wins: 60, losses: 40, total: 100, date: '2026-04-13' },
      ],
    })
    // 7d trend stats
    enqueue('meta_stats', { data: [] })
    // 30d trend stats
    enqueue('meta_stats', { data: [] })
    // matchups
    enqueue('meta_matchups', { data: [] })

    const req = makeRequest({ map: 'Sidetrack', mode: 'brawlBall' })
    const res = await GET(req as unknown as Parameters<typeof GET>[0])
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.topBrawlersSource).toBe('map-mode')
    expect(body.topBrawlers.length).toBeGreaterThan(0)
  })

  it('falls back to topBrawlersSource="mode-fallback" when map is sparse', async () => {
    // Tier 1 query sequence (see route.ts): current, 7d, 30d, matchups
    enqueue('meta_stats', { data: [] })                  // Tier 1 current window (empty → triggers fallback)
    enqueue('meta_stats', { data: [] })                  // Tier 1 7d trend
    enqueue('meta_stats', { data: [] })                  // Tier 1 30d trend
    enqueue('meta_matchups', { data: [] })               // matchups (still queried even if map is sparse)
    // Tier 2 runs 3 queries in Promise.all: current, 7d, 30d (all mode-only)
    enqueue('meta_stats', {
      data: [
        { brawler_id: 1, wins: 600, losses: 400, total: 1000, date: '2026-04-13' },
        { brawler_id: 2, wins: 540, losses: 460, total: 1000, date: '2026-04-13' },
        { brawler_id: 3, wins: 520, losses: 480, total: 1000, date: '2026-04-13' },
      ],
    })                                                    // Tier 2 current window
    enqueue('meta_stats', { data: [] })                  // Tier 2 7d trend (empty is fine)
    enqueue('meta_stats', { data: [] })                  // Tier 2 30d trend

    const req = makeRequest({ map: 'Pit Stop', mode: 'heist' })
    const res = await GET(req as unknown as Parameters<typeof GET>[0])
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.topBrawlersSource).toBe('mode-fallback')
    expect(body.topBrawlers.length).toBeGreaterThan(0)
    expect(body.topBrawlers[0].name).toBe('CROW')
  })

  it('returns topBrawlersSource="map-mode" with empty topBrawlers when both tiers are empty', async () => {
    // Tier 1: all empty
    enqueue('meta_stats', { data: [] })                  // Tier 1 current
    enqueue('meta_stats', { data: [] })                  // Tier 1 7d
    enqueue('meta_stats', { data: [] })                  // Tier 1 30d
    enqueue('meta_matchups', { data: [] })               // matchups
    // Tier 2: also empty (genuinely no data for this mode either)
    enqueue('meta_stats', { data: [] })                  // Tier 2 current (still issued, empty result)
    enqueue('meta_stats', { data: [] })                  // Tier 2 7d
    enqueue('meta_stats', { data: [] })                  // Tier 2 30d

    const req = makeRequest({ map: 'NewMap', mode: 'brandNewMode' })
    const res = await GET(req as unknown as Parameters<typeof GET>[0])
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.topBrawlersSource).toBe('map-mode')
    expect(body.topBrawlers).toEqual([])
  })

  it('returns 400 when map or mode is missing', async () => {
    const req = makeRequest({ map: 'Sidetrack' })
    const res = await GET(req as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 3.2 — Run the test — expect failure**

Run:

```bash
npx vitest run src/__tests__/integration/api/meta/pro-analysis-cascade.test.ts
```

Expected: FAIL with TypeScript errors on `topBrawlersSource` (because the route doesn't set it yet) AND assertion failures on the fallback test (because there is no cascade). Either flavour of fail is acceptable — we're about to make the test pass.

- [ ] **Step 3.3 — Refactor the aggregation + trend computation into a helper that accepts trend maps**

**Correctness note:** the existing `stats7d` and `stats30d` queries also filter by `map`. On the Tier 2 fallback path, if we reuse those map-filtered trend maps, every brawler's `trend7d` and `trend30d` becomes `null`. To keep the UI honest (no silent trend disappearance on fallback), Tier 2 must also re-query the 7d and 30d windows without the map filter and rebuild the trend maps for the mode-only case.

Open `src/app/api/meta/pro-analysis/route.ts`. You need to replace two blocks:

1. The block from line 120 (`// --- Aggregate stats by brawler ---`) through line 196 (`allBrawlers.sort(...)`)
2. Leave the 7d/30d trend map computation blocks (lines 137-159) AS-IS for now — they produce `agg7dCurrent`, `agg7dPrev`, `agg30dCurrent`, `agg30dPrev` which will be used for the Tier 1 call.

Replace the block in (1) with the following refactored version. The helper takes the trend maps as arguments so it can be called with different maps for Tier 1 vs Tier 2.

```ts
  // ── Aggregation helper: raw stats + trend maps → top brawlers ──
  // Used by both Tier 1 (map+mode filter) and Tier 2 (mode-only
  // fallback when the map is empty). Takes trend maps as arguments
  // so Tier 2 can pass mode-level trends instead of map-level ones.
  type AggStat = { wins: number; losses: number; total: number }
  type StatRow = { brawler_id: number; wins: number; losses: number; total: number; date: string }

  function buildTrendMaps(
    rows: StatRow[] | null | undefined,
    windowStart: string,
  ): { current: Map<number, AggStat>; prev: Map<number, AggStat> } {
    const current = new Map<number, AggStat>()
    const prev = new Map<number, AggStat>()
    for (const row of rows ?? []) {
      const target = row.date >= windowStart ? current : prev
      const existing = target.get(row.brawler_id) ?? { wins: 0, losses: 0, total: 0 }
      existing.wins += row.wins
      existing.losses += row.losses
      existing.total += row.total
      target.set(row.brawler_id, existing)
    }
    return { current, prev }
  }

  function aggregateAllBrawlers(
    rows: StatRow[],
    trend7d: { current: Map<number, AggStat>; prev: Map<number, AggStat> },
    trend30d: { current: Map<number, AggStat>; prev: Map<number, AggStat> },
  ): { allBrawlers: TopBrawlerEntry[]; totalBattles: number } {
    const agg = new Map<number, AggStat>()
    let total = 0
    for (const row of rows) {
      const id = row.brawler_id
      const existing = agg.get(id) ?? { wins: 0, losses: 0, total: 0 }
      existing.wins += row.wins
      existing.losses += row.losses
      existing.total += row.total
      agg.set(id, existing)
      total += row.total
    }

    const result: TopBrawlerEntry[] = []
    for (const [id, stat] of agg) {
      if (stat.total < PRO_MIN_BATTLES_DISPLAY) continue

      const winRate = bayesianWinRate(stat.wins, stat.total)
      const pickRate = computePickRate(stat.total, total)

      // 7d trend
      const cur7 = trend7d.current.get(id)
      const prev7 = trend7d.prev.get(id)
      const trend7dDelta = computeTrendDelta(
        cur7 && cur7.total >= 5 ? bayesianWinRate(cur7.wins, cur7.total) : winRate,
        prev7 && prev7.total >= 5 ? bayesianWinRate(prev7.wins, prev7.total) : null,
      )

      // 30d trend
      const cur30 = trend30d.current.get(id)
      const prev30 = trend30d.prev.get(id)
      const trend30dDelta = computeTrendDelta(
        cur30 && cur30.total >= 10 ? bayesianWinRate(cur30.wins, cur30.total) : winRate,
        prev30 && prev30.total >= 10 ? bayesianWinRate(prev30.wins, prev30.total) : null,
      )

      result.push({
        brawlerId: id,
        name: getBrawlerName(brawlerNames, id),
        winRate: Number(winRate.toFixed(2)),
        pickRate: Number(pickRate.toFixed(2)),
        totalBattles: stat.total,
        trend7d: trend7dDelta,
        trend30d: trend30dDelta,
      })
    }
    result.sort((a, b) => b.winRate - a.winRate)
    return { allBrawlers: result, totalBattles: total }
  }

  // ── Replace the previous inline 7d/30d trend blocks with helper calls ──
  // These are the SAME as the previous lines 137-159 but expressed as
  // buildTrendMaps calls. Tier 1 uses these (map-filtered stats7d/stats30d).
  const tier1Trend7d = buildTrendMaps(stats7d as StatRow[] | null | undefined, trend7dStart)
  const tier1Trend30d = buildTrendMaps(stats30d as StatRow[] | null | undefined, trend30dStart)

  // ── Tier 1: map+mode aggregation + trends ─────────────
  const tier1 = aggregateAllBrawlers(
    (statsRows ?? []) as StatRow[],
    tier1Trend7d,
    tier1Trend30d,
  )

  let allBrawlers = tier1.allBrawlers
  let totalProBattles = tier1.totalBattles
  let topBrawlersSource: 'map-mode' | 'mode-fallback' = 'map-mode'

  // ── Tier 2: mode-only fallback when map has no displayable brawlers ──
  // Spec §7.2 — re-query meta_stats WITHOUT the map filter so the user
  // sees mode-level aggregation instead of an empty list. Also re-query
  // 7d and 30d trends without the map filter so trends stay meaningful.
  if (allBrawlers.length === 0) {
    // Issue the 3 fallback queries in parallel (current + 7d + 30d)
    const [modeStatsRowsRes, modeStats7dRes, modeStats30dRes] = await Promise.all([
      supabase
        .from('meta_stats')
        .select('brawler_id, wins, losses, total, date')
        .eq('mode', mode)
        .eq('source', 'global')
        .gte('date', windowStart)
        .lte('date', todayStr),
      supabase
        .from('meta_stats')
        .select('brawler_id, wins, losses, total, date')
        .eq('mode', mode)
        .eq('source', 'global')
        .gte('date', prev7dStart)
        .lte('date', todayStr),
      supabase
        .from('meta_stats')
        .select('brawler_id, wins, losses, total, date')
        .eq('mode', mode)
        .eq('source', 'global')
        .gte('date', prev30dStart)
        .lte('date', todayStr),
    ])

    const modeStatsRows = modeStatsRowsRes.data
    if (modeStatsRows && modeStatsRows.length > 0) {
      const tier2Trend7d = buildTrendMaps(
        modeStats7dRes.data as StatRow[] | null | undefined,
        trend7dStart,
      )
      const tier2Trend30d = buildTrendMaps(
        modeStats30dRes.data as StatRow[] | null | undefined,
        trend30dStart,
      )
      const tier2 = aggregateAllBrawlers(
        modeStatsRows as StatRow[],
        tier2Trend7d,
        tier2Trend30d,
      )
      if (tier2.allBrawlers.length > 0) {
        allBrawlers = tier2.allBrawlers
        totalProBattles = tier2.totalBattles
        topBrawlersSource = 'mode-fallback'
      }
    }
  }
```

**Also delete the old inline trend computation blocks** at lines 137-159 (`// --- Compute 7d trends ---` and `// --- Compute 30d trends ---` with their `for` loops that built `agg7dCurrent`/`agg7dPrev`/`agg30dCurrent`/`agg30dPrev` locally). They are replaced by the `buildTrendMaps` helper calls above. If you leave them in, TypeScript will complain about unused variables, and the Tier 1 aggregation will ignore them anyway.

The `totalUniqueBattles = Math.round(totalProBattles / 6)` line currently sits at line 134-135 — update that line to use `let totalProBattles` from the Tier 1/2 flow (it's already `let` after the refactor) and compute `totalUniqueBattles` AFTER the Tier 2 block:

```ts
  // Each battle has 6 players, so divide by 6 for unique battles.
  // Computed AFTER Tier 2 fallback so the count reflects whichever
  // tier actually populated allBrawlers.
  const totalUniqueBattles = Math.round(totalProBattles / 6)
```

Place that line immediately after the Tier 2 block closes. The `trending` block that reads `allBrawlers` (around line 198 in the old file) continues to work unchanged — it just reads whatever `allBrawlers` was populated with.

- [ ] **Step 3.4 — Add `topBrawlersSource` to the response object**

Find the `const response: ProAnalysisResponse = {` literal near the end of the file (around line 430) and add the new field. It should already contain `topBrawlers`, `totalProBattles`, `windowDays`, `trending`, `counters`, `dailyTrend`, `proTrios`, `personalGap`, `matchupGaps`. Add:

```ts
  const response: ProAnalysisResponse = {
    topBrawlers: allBrawlers,
    totalProBattles: totalUniqueBattles,
    windowDays: window,
    topBrawlersSource,  // ← NEW
    trending: { rising, falling },
    counters,
    dailyTrend,
    proTrios,
    personalGap,
    matchupGaps,
  }
```

- [ ] **Step 3.5 — Run the test — expect PASS**

```bash
npx vitest run src/__tests__/integration/api/meta/pro-analysis-cascade.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 3.6 — Run the full test suite to detect regressions**

```bash
npx vitest run
```

Expected: the existing suite (~522 tests) passes. If anything unrelated fails, the cascade refactor broke a contract we didn't know about — stop and inspect.

- [ ] **Step 3.7 — Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. This closes the temporary build break from Task 2.

- [ ] **Step 3.8 — Commit**

```bash
git add src/app/api/meta/pro-analysis/route.ts src/__tests__/integration/api/meta/pro-analysis-cascade.test.ts
git commit -m "feat(meta): Tier 2 mode fallback in /api/meta/pro-analysis"
```

---

## Task 4 — Tier 2 batch fallback + Cache-Control in `/api/meta/route.ts`

**Files:**
- Modify: `src/app/api/meta/route.ts`

**Why:** This is the event-rotation feed powering `MapCard` on `/picks`. Multiple maps are queried in a single batch, so the cascade design is different: aggregate Tier 1, detect which modes have sparse maps, run ONE batch Tier 2 query for those modes, and merge. Also addresses the pre-existing gap that this endpoint has no `Cache-Control` header — adding one brings it in line with `/api/meta/pro-analysis`.

- [ ] **Step 4.1 — Read the current file**

Open `src/app/api/meta/route.ts` and locate these key regions:
- Lines 26-36: the Tier 1 query
- Lines 38-52: the `metaMap` aggregation per `(map, mode)`
- Lines 54-85: the event-to-response mapping + final return

- [ ] **Step 4.2 — Replace the current return block with the cascade-aware version**

Replace everything from line 38 (`// 3. Aggregate by brawler per map+mode`) to the current final `return NextResponse.json({ events: result })` (line 87) with:

```ts
    // 3. Aggregate by brawler per map+mode (Tier 1)
    type AggStat = { wins: number; losses: number; total: number }
    const metaMap = new Map<string, Map<number, AggStat>>()
    for (const row of rawStats ?? []) {
      const key = `${row.map}|${row.mode}`
      if (!metaMap.has(key)) metaMap.set(key, new Map())
      const brawlerMap = metaMap.get(key)!
      const existing = brawlerMap.get(row.brawler_id)
      if (existing) {
        existing.wins += row.wins
        existing.losses += row.losses
        existing.total += row.total
      } else {
        brawlerMap.set(row.brawler_id, { wins: row.wins, losses: row.losses, total: row.total })
      }
    }

    // 4. Detect sparse maps and collect their modes for Tier 2 fallback
    // A map is "sparse" if the sum of all its brawler totals is below
    // the display threshold. We collect the distinct modes that have
    // at least one sparse map so we can issue ONE batch Tier 2 query.
    const SPARSE_THRESHOLD = 30  // minimum total battles across all brawlers on a map
    const sparseModes = new Set<string>()
    for (const event of draftEvents) {
      const key = `${event.event.map}|${event.event.mode}`
      const brawlers = metaMap.get(key)
      const total = brawlers
        ? Array.from(brawlers.values()).reduce((s, b) => s + b.total, 0)
        : 0
      if (total < SPARSE_THRESHOLD) {
        sparseModes.add(event.event.mode)
      }
    }

    // 5. Tier 2 batch fallback query (one round-trip, not one per sparse map)
    const modeFallback = new Map<string, Map<number, AggStat>>()
    if (sparseModes.size > 0) {
      const { data: modeStats } = await supabase
        .from('meta_stats')
        .select('brawler_id, mode, wins, losses, total')
        .eq('source', 'global')
        .gte('date', cutoffDate)
        .in('mode', Array.from(sparseModes))

      for (const row of modeStats ?? []) {
        if (!modeFallback.has(row.mode)) modeFallback.set(row.mode, new Map())
        const brawlerMap = modeFallback.get(row.mode)!
        const existing = brawlerMap.get(row.brawler_id)
        if (existing) {
          existing.wins += row.wins
          existing.losses += row.losses
          existing.total += row.total
        } else {
          brawlerMap.set(row.brawler_id, { wins: row.wins, losses: row.losses, total: row.total })
        }
      }
    }

    // 6. Build response: event + top brawlers, with source flag per map
    const result = draftEvents.map(event => {
      const key = `${event.event.map}|${event.event.mode}`
      let brawlers = metaMap.get(key)
      let totalBattles = brawlers
        ? Array.from(brawlers.values()).reduce((sum, s) => sum + s.total, 0)
        : 0
      let source: 'map-mode' | 'mode-fallback' = 'map-mode'

      // Fallback if this specific map is sparse
      if (totalBattles < SPARSE_THRESHOLD) {
        const fallback = modeFallback.get(event.event.mode)
        if (fallback && fallback.size > 0) {
          brawlers = fallback
          totalBattles = Array.from(fallback.values()).reduce((sum, s) => sum + s.total, 0)
          source = 'mode-fallback'
        }
      }

      let topBrawlers: { brawlerId: number; winRate: number; pickCount: number }[] = []
      if (brawlers && brawlers.size > 0) {
        topBrawlers = Array.from(brawlers.entries())
          .map(([brawlerId, stats]) => ({
            brawlerId,
            winRate: Math.round(bayesianWinRate(stats.wins, stats.total) * 10) / 10,
            pickCount: stats.total,
          }))
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 10)
      }

      return {
        mode: event.event.mode,
        map: event.event.map,
        eventId: event.event.id,
        startTime: event.startTime,
        endTime: event.endTime,
        totalBattles,
        topBrawlers,
        source,
      }
    })

    // 7. Return with Cache-Control matching /api/meta/pro-analysis
    // Pre-existing gap: this endpoint previously had no cache headers,
    // so every request hit the DB. Spec §7.5.
    return NextResponse.json(
      { events: result },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
        },
      },
    )
```

- [ ] **Step 4.3 — Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. The only consumer of this endpoint (`src/app/[locale]/picks/page.tsx` → `fetchMetaEvents()` → `PicksContent` → `MapCard`) will receive `source` as an unused extra field for now. It becomes used in Task 12.

- [ ] **Step 4.4 — Run the existing test suite**

```bash
npx vitest run
```

Expected: the existing suite still passes. There are no dedicated tests for `/api/meta/route.ts` in the repo today; the cascade behaviour is covered by the manual smoke test in Task 15.

- [ ] **Step 4.5 — Commit**

```bash
git add src/app/api/meta/route.ts
git commit -m "feat(meta): Tier 2 batch fallback + Cache-Control on /api/meta"
```

---

## Task 5 — TopBrawlersGrid: per-card sample size + ConfidenceBadge

**Files:**
- Modify: `src/components/analytics/TopBrawlersGrid.tsx`
- Create: `src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx`

**Why:** The data type `TopBrawlerEntry` already carries `totalBattles: number` per brawler (verified in `src/lib/draft/pro-analysis.ts` line 35). The current component renders win-rate, pick-rate, and trend but hides sample size behind a corner-text `text-[10px]` element. This task surfaces that field inside each brawler card and adds a `ConfidenceBadge` for quick confidence read.

- [ ] **Step 5.1 — Write the failing test**

Create `src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      topBrawlersTitle: 'Top Brawlers',
      totalBattles: `${params?.count ?? '?'} battles`,
      noDataForMap: 'No data for map',
      sampleSize: `${params?.count ?? '?'} batallas`,
      confidenceHigh: 'High confidence',
      confidenceMedium: 'Medium confidence',
      confidenceLow: 'Low confidence',
    }
    return map[key] ?? key
  },
}))

vi.mock('@/components/ui/BrawlImg', () => ({
  BrawlImg: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

import { TopBrawlersGrid } from '@/components/analytics/TopBrawlersGrid'
import type { TopBrawlerEntry } from '@/lib/draft/pro-analysis'

const MOCK_BRAWLERS: TopBrawlerEntry[] = [
  { brawlerId: 1, name: 'CROW', winRate: 62.4, pickRate: 8.2, totalBattles: 142, trend7d: 2.3, trend30d: 1.1 },
  { brawlerId: 2, name: 'BULL', winRate: 58.1, pickRate: 7.5, totalBattles: 98, trend7d: null, trend30d: null },
  { brawlerId: 3, name: 'PIPER', winRate: 56.8, pickRate: 6.9, totalBattles: 8, trend7d: -1.1, trend30d: null },
]

describe('TopBrawlersGrid — Task 5 (sample size + confidence)', () => {
  it('renders per-card totalBattles for each brawler', () => {
    render(<TopBrawlersGrid brawlers={MOCK_BRAWLERS} totalBattles={3000} />)
    expect(screen.getByText(/142 batallas/)).toBeTruthy()
    expect(screen.getByText(/98 batallas/)).toBeTruthy()
    expect(screen.getByText(/8 batallas/)).toBeTruthy()
  })

  it('renders a high-confidence dot for brawlers with ≥10 games', () => {
    const { container } = render(
      <TopBrawlersGrid brawlers={[MOCK_BRAWLERS[0]]} totalBattles={3000} />,
    )
    // ConfidenceBadge renders a data-confidence attribute with the level
    expect(container.querySelector('[data-confidence="high"]')).toBeTruthy()
  })

  it('renders a low-confidence dot for brawlers with <3 games', () => {
    const sparse: TopBrawlerEntry = {
      brawlerId: 99, name: 'TEST', winRate: 70, pickRate: 1, totalBattles: 2, trend7d: null, trend30d: null,
    }
    const { container } = render(
      <TopBrawlersGrid brawlers={[sparse]} totalBattles={10} />,
    )
    expect(container.querySelector('[data-confidence="low"]')).toBeTruthy()
  })

  it('renders the empty state when no brawlers', () => {
    render(<TopBrawlersGrid brawlers={[]} totalBattles={0} />)
    expect(screen.getByText('No data for map')).toBeTruthy()
  })
})
```

- [ ] **Step 5.2 — Run the test — expect failure**

```bash
npx vitest run src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx
```

Expected: FAIL because the sample-size text is not in the current component.

- [ ] **Step 5.3 — Modify `TopBrawlersGrid.tsx` to render per-card sample size + ConfidenceBadge**

Open `src/components/analytics/TopBrawlersGrid.tsx`. Add the `ConfidenceBadge` import at the top (line 5, between the existing `BrawlImg` and `TopBrawlerEntry` imports):

```tsx
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
```

Then find the per-brawler card rendering block (lines 58-91 in the current file) and modify the rendering inside the `{brawlers.map((b, i) => ...}` loop to add the sample size line and badge. Replace the existing card content with:

```tsx
        {brawlers.map((b, i) => (
          <div
            key={b.brawlerId}
            className="brawl-row rounded-xl p-3 flex flex-col items-center gap-2 relative"
          >
            {i < 3 && (
              <span className="absolute top-1.5 left-2 text-sm">
                {i === 0 ? '\uD83E\uDD47' : i === 1 ? '\uD83E\uDD48' : '\uD83E\uDD49'}
              </span>
            )}

            <div className="absolute top-1.5 right-2">
              <ConfidenceBadge total={b.totalBattles} />
            </div>

            <BrawlImg
              src={getBrawlerPortraitUrl(b.brawlerId)}
              fallbackSrc={getBrawlerPortraitFallback(b.brawlerId)}
              alt={b.name}
              className="w-12 h-12 rounded-lg ring-2 ring-[#090E17]"
            />

            <p className="font-['Lilita_One'] text-xs text-white truncate max-w-full">
              {b.name}
            </p>

            <p className={`font-['Lilita_One'] text-lg tabular-nums ${wrColor(b.winRate)}`}>
              {b.winRate.toFixed(1)}%
            </p>

            <p className="text-[10px] text-slate-400 tabular-nums">
              {t('sampleSize', { count: b.totalBattles })}
            </p>

            <p className="text-[10px] text-slate-500 tabular-nums">
              {b.pickRate.toFixed(1)}% picks
            </p>

            <TrendBadge delta={b.trend7d} />
          </div>
        ))}
```

Note the two additions: the `<ConfidenceBadge total={b.totalBattles} />` absolutely positioned in the top-right corner of the card, and a new `<p>` element showing `{t('sampleSize', { count: b.totalBattles })}` between the win rate and pick rate lines.

The `t('sampleSize', ...)` key doesn't exist yet in `messages/*.json` — it will be added in Task 14. For now the component compiles because `useTranslations` returns the key verbatim when it's missing (next-intl default behaviour), and the test mocks this.

- [ ] **Step 5.4 — Run the test — expect PASS**

```bash
npx vitest run src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5.5 — Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5.6 — Commit**

```bash
git add src/components/analytics/TopBrawlersGrid.tsx src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx
git commit -m "feat(top-brawlers): per-card sample size + ConfidenceBadge"
```

---

## Task 6 — TopBrawlersGrid: mode-fallback banner

**Files:**
- Modify: `src/components/analytics/TopBrawlersGrid.tsx`
- Modify: `src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx`

**Why:** Task 3 added the `topBrawlersSource` field to the API response. Task 6 reads it and displays a yellow inline banner explaining the fallback when the value is `'mode-fallback'`. This is what makes the Tier 2 cascade user-visible.

- [ ] **Step 6.1 — Add a failing test for the banner**

Append the following `describe` block at the bottom of `src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx` (inside the existing file, before the final closing brace):

```tsx
describe('TopBrawlersGrid — Task 6 (mode-fallback banner)', () => {
  it('does NOT render the fallback banner when source is "map-mode"', () => {
    render(
      <TopBrawlersGrid
        brawlers={MOCK_BRAWLERS}
        totalBattles={3000}
        source="map-mode"
      />,
    )
    expect(screen.queryByText(/mode-fallback|datos agregados|fallback/i)).toBeNull()
  })

  it('renders the fallback banner when source is "mode-fallback"', () => {
    render(
      <TopBrawlersGrid
        brawlers={MOCK_BRAWLERS}
        totalBattles={3000}
        source="mode-fallback"
      />,
    )
    // The i18n mock returns the key verbatim when missing, so assert on the key name
    expect(screen.getByText(/modeFallbackBanner|datos agregados/i)).toBeTruthy()
  })

  it('defaults to "map-mode" behaviour when source prop is omitted (backwards compat)', () => {
    render(<TopBrawlersGrid brawlers={MOCK_BRAWLERS} totalBattles={3000} />)
    expect(screen.queryByText(/modeFallbackBanner/i)).toBeNull()
  })
})
```

Also, extend the existing i18n mock at the top of the same file to include the new `modeFallbackBanner` key so it renders as recognisable text:

```tsx
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      topBrawlersTitle: 'Top Brawlers',
      totalBattles: `${params?.count ?? '?'} battles`,
      noDataForMap: 'No data for map',
      sampleSize: `${params?.count ?? '?'} batallas`,
      confidenceHigh: 'High confidence',
      confidenceMedium: 'Medium confidence',
      confidenceLow: 'Low confidence',
      modeFallbackBanner: 'Mostrando datos agregados del modo',
    }
    return map[key] ?? key
  },
}))
```

- [ ] **Step 6.2 — Run — expect failure**

```bash
npx vitest run src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx
```

Expected: 2 new tests fail — the banner is not rendered today.

- [ ] **Step 6.3 — Add the `source` prop and banner rendering**

Edit `src/components/analytics/TopBrawlersGrid.tsx`. Update the `Props` interface at the top:

```tsx
interface Props {
  brawlers: TopBrawlerEntry[]
  totalBattles: number
  /**
   * Which aggregation tier produced `brawlers`.
   * Optional for backwards compatibility — defaults to 'map-mode'.
   * When 'mode-fallback', a yellow inline banner explains the substitution.
   * Added in Sprint C — spec §7.2.
   */
  source?: 'map-mode' | 'mode-fallback'
}
```

Update the function signature to destructure the new prop with a default:

```tsx
export function TopBrawlersGrid({ brawlers, totalBattles, source = 'map-mode' }: Props) {
```

Then, inside the return block (after the `<div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">` opening tag but BEFORE the existing `<div className="flex items-center justify-between mb-4">` header), add the banner:

```tsx
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      {source === 'mode-fallback' && (
        <div className="mb-3 px-3 py-2 bg-amber-400/10 border border-amber-400/30 rounded-lg">
          <p className="text-[11px] text-amber-300">
            <span className="mr-1">⚠️</span>
            {t('modeFallbackBanner')}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        {/* ...existing header content... */}
      </div>
```

- [ ] **Step 6.4 — Run — expect PASS**

```bash
npx vitest run src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx
```

Expected: 7 tests pass (4 from Task 5 + 3 new).

- [ ] **Step 6.5 — Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean. A new TS error in `MetaProTab.tsx` is NOT expected because `source` is optional; the current `<TopBrawlersGrid brawlers={...} totalBattles={...} />` call still type-checks.

- [ ] **Step 6.6 — Commit**

```bash
git add src/components/analytics/TopBrawlersGrid.tsx src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx
git commit -m "feat(top-brawlers): mode-fallback banner"
```

---

## Task 7 — TopBrawlersGrid: inline counters section

**Files:**
- Modify: `src/components/analytics/TopBrawlersGrid.tsx`
- Modify: `src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx`

**Why:** This is Track 5 of the spec — the killer feature. The API already computes `CounterEntry[]` with each top brawler's counters (verified in `src/app/api/meta/pro-analysis/route.ts` lines 222-253). Inlining the counters below each brawler's win rate removes one layer of UI navigation (no more scrolling to a separate `CounterQuickView` section) and gives the user an immediate "pick A to beat B" intent.

**Important:** this task does NOT delete `CounterQuickView.tsx` yet — Task 9 does that after `MetaProTab` has been updated to pass the new prop. This task only makes `TopBrawlersGrid` capable of rendering inline counters; the caller still controls whether to pass them.

- [ ] **Step 7.1 — Add failing test for inline counters**

Append this `describe` block to `src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx`:

```tsx
describe('TopBrawlersGrid — Task 7 (inline counters)', () => {
  const MOCK_COUNTERS = [
    {
      brawlerId: 1,  // CROW (first in MOCK_BRAWLERS)
      name: 'CROW',
      bestCounters: [
        { opponentId: 10, name: 'DYNAMIKE', winRate: 58, total: 120 },
        { opponentId: 11, name: 'PIPER', winRate: 56, total: 110 },
        { opponentId: 12, name: 'COLT', winRate: 54, total: 95 },
      ],
      worstMatchups: [],
    },
    {
      brawlerId: 2,  // BULL
      name: 'BULL',
      bestCounters: [
        { opponentId: 13, name: 'LEON', winRate: 61, total: 80 },
      ],
      worstMatchups: [],
    },
    // Note: no entry for brawlerId 3 (PIPER) — component should handle gracefully
  ]

  it('renders inline counter names for brawlers that have counter data', () => {
    render(
      <TopBrawlersGrid
        brawlers={MOCK_BRAWLERS}
        totalBattles={3000}
        counters={MOCK_COUNTERS}
      />,
    )
    // CROW's counters
    expect(screen.getByText(/DYNAMIKE/)).toBeTruthy()
    expect(screen.getByText(/PIPER/)).toBeTruthy()  // as a counter to CROW, not just as a row
    expect(screen.getByText(/COLT/)).toBeTruthy()
    // BULL's counter
    expect(screen.getByText(/LEON/)).toBeTruthy()
  })

  it('does not crash when counters array is missing', () => {
    expect(() => {
      render(<TopBrawlersGrid brawlers={MOCK_BRAWLERS} totalBattles={3000} />)
    }).not.toThrow()
  })

  it('does not crash when a brawler has no corresponding counter entry', () => {
    render(
      <TopBrawlersGrid
        brawlers={MOCK_BRAWLERS}
        totalBattles={3000}
        counters={MOCK_COUNTERS}
      />,
    )
    // PIPER is brawler 3 in MOCK_BRAWLERS but not in MOCK_COUNTERS — should render without error
    expect(screen.getAllByText(/PIPER/).length).toBeGreaterThan(0)  // at least the card itself
  })

  it('shows ConfidenceBadge on each counter entry', () => {
    const { container } = render(
      <TopBrawlersGrid
        brawlers={[MOCK_BRAWLERS[0]]}
        totalBattles={3000}
        counters={[MOCK_COUNTERS[0]]}
      />,
    )
    // 1 badge for the brawler card + 3 for the counters = 4 total
    const badges = container.querySelectorAll('[data-confidence]')
    expect(badges.length).toBeGreaterThanOrEqual(4)
  })
})
```

- [ ] **Step 7.2 — Run — expect failure**

```bash
npx vitest run src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx
```

Expected: 4 new failures — the component doesn't accept the `counters` prop.

- [ ] **Step 7.3 — Accept the `counters` prop and render inline counters**

Edit `src/components/analytics/TopBrawlersGrid.tsx`. First, extend the imports at the top:

```tsx
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
import type { TopBrawlerEntry, CounterEntry } from '@/lib/draft/pro-analysis'
```

Update the `Props` interface to add the new optional prop:

```tsx
interface Props {
  brawlers: TopBrawlerEntry[]
  totalBattles: number
  source?: 'map-mode' | 'mode-fallback'
  /**
   * Optional array of counter entries keyed by brawlerId. When provided,
   * each brawler card renders its 3 best counters inline. Free users see
   * the 3 the API sends; premium users receive more and can tap "Ver más"
   * (rendered in a later iteration — Sprint C ships the 3-slot version).
   *
   * Added in Sprint C — spec §5.1 Track 5.
   */
  counters?: CounterEntry[]
}
```

Update the function signature:

```tsx
export function TopBrawlersGrid({
  brawlers,
  totalBattles,
  source = 'map-mode',
  counters,
}: Props) {
  const t = useTranslations('metaPro')

  // Build an O(1) lookup: brawlerId → CounterEntry
  const counterByBrawlerId = useMemo(() => {
    const map = new Map<number, CounterEntry>()
    if (counters) {
      for (const c of counters) map.set(c.brawlerId, c)
    }
    return map
  }, [counters])
```

Inside the `{brawlers.map((b, i) => (...)` loop, AFTER the existing `<TrendBadge delta={b.trend7d} />` element but BEFORE the closing `</div>` of the card, add the inline counters block:

```tsx
            <TrendBadge delta={b.trend7d} />

            {(() => {
              const entry = counterByBrawlerId.get(b.brawlerId)
              if (!entry || entry.bestCounters.length === 0) return null
              const visibleCounters = entry.bestCounters.slice(0, 3)
              return (
                <div className="w-full mt-1 pt-2 border-t border-white/5">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1 text-center">
                    {t('countersLabel')}
                  </p>
                  <div className="flex flex-col gap-1">
                    {visibleCounters.map((c) => (
                      <div
                        key={c.opponentId}
                        className="flex items-center gap-1.5 bg-[#0D1321] rounded-md px-1.5 py-1"
                      >
                        <BrawlImg
                          src={getBrawlerPortraitUrl(c.opponentId)}
                          fallbackSrc={getBrawlerPortraitFallback(c.opponentId)}
                          alt={c.name}
                          className="w-4 h-4 rounded-sm flex-shrink-0"
                        />
                        <span className="font-['Lilita_One'] text-[10px] text-white truncate flex-1">
                          {c.name}
                        </span>
                        <ConfidenceBadge total={c.total} />
                        <span className={`text-[9px] font-bold tabular-nums ${wrColor(c.winRate)}`}>
                          {Math.round(c.winRate)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
```

- [ ] **Step 7.4 — Run — expect PASS**

```bash
npx vitest run src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx
```

Expected: 11 tests pass (4 from Task 5 + 3 from Task 6 + 4 from Task 7).

- [ ] **Step 7.5 — Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 7.6 — Commit**

```bash
git add src/components/analytics/TopBrawlersGrid.tsx src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx
git commit -m "feat(top-brawlers): inline counters section with ConfidenceBadge"
```

---

## Task 8 — MetaProTab: pass `counters` and `topBrawlersSource` to TopBrawlersGrid

**Files:**
- Modify: `src/components/analytics/MetaProTab.tsx`

**Why:** Task 7 added optional `counters` and `source` props to `TopBrawlersGrid`, but `MetaProTab` (the caller) hasn't been updated yet. This task wires them up. It is a two-line change plus removing one import. `CounterQuickView` is still rendered in this task — Task 9 deletes it after the inline version is confirmed working.

- [ ] **Step 8.1 — Wire up the new props**

Edit `src/components/analytics/MetaProTab.tsx`. Find the line that renders `<TopBrawlersGrid brawlers={data.topBrawlers} totalBattles={data.totalProBattles} />` (line 78) and change it to:

```tsx
          <TopBrawlersGrid
            brawlers={data.topBrawlers}
            totalBattles={data.totalProBattles}
            source={data.topBrawlersSource}
            counters={data.counters}
          />
```

Do NOT remove the `<CounterQuickView counters={data.counters} isPremium={hasPremium} />` line yet — Task 9 handles that.

- [ ] **Step 8.2 — Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean. `data.topBrawlersSource` exists on `ProAnalysisResponse` because of Task 2, and `data.counters` has always existed.

- [ ] **Step 8.3 — Smoke-run the existing test suite**

```bash
npx vitest run
```

Expected: all existing tests pass. No regressions.

- [ ] **Step 8.4 — Commit**

```bash
git add src/components/analytics/MetaProTab.tsx
git commit -m "feat(meta-pro-tab): pass counters and source to TopBrawlersGrid"
```

---

## Task 9 — Delete `CounterQuickView` + clean up obsolete i18n usage in component code

**Files:**
- Delete: `src/components/analytics/CounterQuickView.tsx`
- Modify: `src/components/analytics/MetaProTab.tsx`

**Why:** The inline counters in `TopBrawlersGrid` (Task 7) render the same information as `CounterQuickView` but with better context. Keeping both creates the framing-duplication UX issue flagged in the spec §2.3. Deleting `CounterQuickView` removes one component from the tree, one layer of data indirection, and ~80 LOC from the client bundle.

The obsolete i18n keys (`metaPro.counterTitle`, `metaPro.counterHint`) are deleted as part of the i18n batch in Task 14 — this task only removes the TypeScript references to them so no code still reads them.

- [ ] **Step 9.1 — Delete the component file**

```bash
rm src/components/analytics/CounterQuickView.tsx
```

- [ ] **Step 9.2 — Remove the import and the usage from MetaProTab**

Edit `src/components/analytics/MetaProTab.tsx`:

1. Delete line 14: `import { CounterQuickView } from '@/components/analytics/CounterQuickView'`
2. Delete line 80 (now line 78 or 79 after Task 8's 5-line expansion): `<CounterQuickView counters={data.counters} isPremium={hasPremium} />`

The `TrendingSection` line above it and the `<PremiumGate>` block below it must remain unchanged.

- [ ] **Step 9.3 — Verify no other file imports `CounterQuickView`**

Run:

```bash
npx grep -r "CounterQuickView" src/ || true
```

Expected: no matches. If there are any, those files also need to be cleaned up.

- [ ] **Step 9.4 — Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean. If TypeScript complains about an unused import somewhere, track it down and remove it.

- [ ] **Step 9.5 — Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass. `CounterQuickView` had no dedicated test file (verified — no `CounterQuickView.test.tsx` exists).

- [ ] **Step 9.6 — Commit**

```bash
git add src/components/analytics/CounterQuickView.tsx src/components/analytics/MetaProTab.tsx
git commit -m "refactor(meta-pro-tab): delete CounterQuickView (inlined in TopBrawlersGrid)"
```

Note: `git add` on a deleted file stages the deletion. Alternatively use `git rm`:

```bash
git rm src/components/analytics/CounterQuickView.tsx
git add src/components/analytics/MetaProTab.tsx
git commit -m "refactor(meta-pro-tab): delete CounterQuickView (inlined in TopBrawlersGrid)"
```

---

## Task 10 — MetaIntelligence: per-row totalBattles + ConfidenceBadge

**Files:**
- Modify: `src/components/brawler-detail/MetaIntelligence.tsx`
- Create: `src/__tests__/unit/components/brawler-detail/MetaIntelligence.test.tsx`

**Why:** The public brawler page shows strong/weak matchups, best maps, and best teammates without any sample-size indicator. Each of these data types already carries `totalBattles` on the underlying type (`MatchupStat.totalBattles`, `MapStat.totalBattles`, `TeammateStat.totalBattles` — verified in `src/lib/brawler-detail/types.ts`). This task renders that field next to the win rate and adds a `ConfidenceBadge` on each row. Zero data changes, pure UI surface.

- [ ] **Step 10.1 — Write failing tests**

Create `src/__tests__/unit/components/brawler-detail/MetaIntelligence.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      winRate: 'Win Rate',
      pickRate: 'Pick Rate',
      totalBattles: 'Total Battles',
      trending: 'Trending',
      bestMaps: 'Best Maps',
      strongAgainst: 'Strong Against',
      weakAgainst: 'Weak Against',
      bestTeammates: 'Best Teammates',
      insufficientData: 'Datos insuficientes',
      rising: 'Rising',
      falling: 'Falling',
      stable: 'Stable',
      sampleSize: `${params?.count ?? '?'} batallas`,
      confidenceHigh: 'High',
      confidenceMedium: 'Medium',
      confidenceLow: 'Low',
    }
    return map[key] ?? key
  },
}))

vi.mock('@/components/ui/BrawlImg', () => ({
  BrawlImg: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

vi.mock('@/hooks/useMapImages', () => ({
  useMapImages: () => ({}),
}))

vi.mock('@/lib/brawler-name', () => ({
  resolveBrawlerName: (id: number) => `Brawler${id}`,
}))

vi.mock('@/lib/brawler-registry', () => ({
  getCachedRegistry: () => null,
  setCachedRegistry: () => {},
}))

import { MetaIntelligence } from '@/components/brawler-detail/MetaIntelligence'
import type { BrawlerMetaResponse } from '@/lib/brawler-detail/types'

const MOCK_DATA: BrawlerMetaResponse = {
  brawlerId: 1,
  globalStats: {
    winRate: 58,
    pickRate: 8.2,
    totalBattles: 1500,
    trend7d: 2.1,
  },
  bestMaps: [
    { map: 'Sidetrack', mode: 'brawlBall', eventId: null, winRate: 65, totalBattles: 342 },
    { map: 'Nutmeg', mode: 'brawlBall', eventId: null, winRate: 62, totalBattles: 298 },
  ],
  worstMaps: [],
  strongAgainst: [
    { opponentId: 10, opponentName: 'Bull', winRate: 68, totalBattles: 156 },
    { opponentId: 11, opponentName: 'Shelly', winRate: 64, totalBattles: 120 },
  ],
  weakAgainst: [
    { opponentId: 20, opponentName: 'Crow', winRate: 38, totalBattles: 89 },
  ],
  bestTeammates: [
    { teammateId: 30, teammateName: 'Poco', winRate: 62, totalBattles: 54 },
  ],
}

describe('MetaIntelligence — Task 10 (sample size + confidence)', () => {
  it('renders per-row total battles in strongAgainst', () => {
    render(<MetaIntelligence data={MOCK_DATA} />)
    expect(screen.getByText(/156 batallas/)).toBeTruthy()
    expect(screen.getByText(/120 batallas/)).toBeTruthy()
  })

  it('renders per-row total battles in weakAgainst', () => {
    render(<MetaIntelligence data={MOCK_DATA} />)
    expect(screen.getByText(/89 batallas/)).toBeTruthy()
  })

  it('renders per-row total battles in bestTeammates', () => {
    render(<MetaIntelligence data={MOCK_DATA} />)
    expect(screen.getByText(/54 batallas/)).toBeTruthy()
  })

  it('renders per-card total battles in bestMaps', () => {
    render(<MetaIntelligence data={MOCK_DATA} />)
    expect(screen.getByText(/342 batallas/)).toBeTruthy()
    expect(screen.getByText(/298 batallas/)).toBeTruthy()
  })

  it('renders ConfidenceBadge data-confidence attributes on rows', () => {
    const { container } = render(<MetaIntelligence data={MOCK_DATA} />)
    const badges = container.querySelectorAll('[data-confidence]')
    // 2 strongAgainst + 1 weakAgainst + 1 bestTeammates + 2 bestMaps = 6
    expect(badges.length).toBeGreaterThanOrEqual(6)
  })
})
```

- [ ] **Step 10.2 — Run — expect failure**

```bash
npx vitest run src/__tests__/unit/components/brawler-detail/MetaIntelligence.test.tsx
```

Expected: 5 test failures — nothing shows `totalBattles` or `ConfidenceBadge` in the current component.

- [ ] **Step 10.3 — Modify `MetaIntelligence.tsx`**

Open `src/components/brawler-detail/MetaIntelligence.tsx`. Add the `ConfidenceBadge` import at the top:

```tsx
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
```

Find the `MatchupList` component (lines 84-130 in the existing file) and modify its row rendering to include sample size and a badge. Replace the inner row rendering block (the `entries.slice(0, 5).map(entry => {...})` body) with:

```tsx
        {entries.slice(0, 5).map(entry => {
          const name = resolveBrawlerName(entry.opponentId, playerNames)
          return (
            <div
              key={entry.opponentId}
              className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5"
            >
              <BrawlImg
                src={getBrawlerPortraitUrl(entry.opponentId)}
                fallbackSrc={getBrawlerPortraitFallback(entry.opponentId)}
                alt={name}
                fallbackText={name}
                className="w-10 h-10 rounded-lg"
              />
              <span className="font-['Lilita_One'] text-sm text-white truncate flex-1">
                {name}
              </span>
              <ConfidenceBadge total={entry.totalBattles} />
              <span className={`font-['Lilita_One'] text-sm tabular-nums ${wrColor(entry.winRate)}`}>
                {entry.winRate.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-500 tabular-nums">
                {t('sampleSize', { count: entry.totalBattles })}
              </span>
            </div>
          )
        })}
```

Note: `MatchupList` already receives `t` from `useTranslations('brawlerDetail')` at line 85, so `t('sampleSize', ...)` will look up in that namespace.

Find the `bestMaps` rendering block (lines 182-224) and update each map card to show `totalBattles` and a `ConfidenceBadge`. Replace the inner map card rendering with:

```tsx
            {bestMaps.slice(0, 6).map(map => {
              const modeIconUrl = getGameModeImageUrl(map.mode)
              const mapImageUrl = mapImages[map.map]
              return (
                <div
                  key={`${map.map}-${map.mode}`}
                  className="relative rounded-xl overflow-hidden border-2 border-[#1E293B] group"
                >
                  {mapImageUrl ? (
                    <img
                      src={mapImageUrl}
                      alt={map.map}
                      className="w-full h-24 object-cover opacity-40 group-hover:opacity-60 transition-opacity"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-24 bg-[#1E293B]" />
                  )}

                  <div className="absolute top-1.5 right-1.5">
                    <ConfidenceBadge total={map.totalBattles} />
                  </div>

                  <div className="absolute inset-0 flex flex-col justify-end p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      {modeIconUrl && (
                        <img src={modeIconUrl} alt={map.mode} className="w-4 h-4" width={16} height={16} />
                      )}
                      <span className="font-['Lilita_One'] text-xs text-white truncate">
                        {map.map}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`font-['Lilita_One'] text-lg ${wrColor(map.winRate)}`}>
                        {map.winRate.toFixed(1)}%
                      </span>
                      <span className="text-[9px] text-slate-300 tabular-nums">
                        {t('sampleSize', { count: map.totalBattles })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
```

Find the `bestTeammates` rendering block (lines 240-258) and update each row to show `totalBattles` and a `ConfidenceBadge`:

```tsx
            {bestTeammates.slice(0, 5).map(tm => {
              const name = resolveBrawlerName(tm.teammateId, playerBrawlerNames)
              return (
                <div key={tm.teammateId} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5">
                  <BrawlImg
                    src={getBrawlerPortraitUrl(tm.teammateId)}
                    fallbackSrc={getBrawlerPortraitFallback(tm.teammateId)}
                    alt={name}
                    fallbackText={name}
                    className="w-10 h-10 rounded-lg"
                  />
                  {name && <span className="font-['Lilita_One'] text-sm text-white truncate flex-1">{name}</span>}
                  <ConfidenceBadge total={tm.totalBattles} />
                  <span className={`font-['Lilita_One'] text-sm tabular-nums ${wrColor(tm.winRate)}`}>
                    {tm.winRate.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-500 tabular-nums">
                    {t('sampleSize', { count: tm.totalBattles })}
                  </span>
                </div>
              )
            })}
```

- [ ] **Step 10.4 — Run — expect PASS**

```bash
npx vitest run src/__tests__/unit/components/brawler-detail/MetaIntelligence.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 10.5 — Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 10.6 — Commit**

```bash
git add src/components/brawler-detail/MetaIntelligence.tsx src/__tests__/unit/components/brawler-detail/MetaIntelligence.test.tsx
git commit -m "feat(brawler-detail): per-row sample size + ConfidenceBadge on MetaIntelligence"
```

---

## Task 11 — MetaIntelligence: contextual empty states per section

**Files:**
- Modify: `src/components/brawler-detail/MetaIntelligence.tsx`
- Modify: `src/__tests__/unit/components/brawler-detail/MetaIntelligence.test.tsx`

**Why:** Track 1 of the spec (§3). Today every section that is empty renders the same generic `t('insufficientData')` → "Datos insuficientes". The new copy explains exactly which section is empty and why, using parameters the component already has (brawler name, window). The new i18n keys go in Task 14's batch; this task updates the component code to reference them.

- [ ] **Step 11.1 — Add failing tests for the contextual empty states**

Append this `describe` block to `src/__tests__/unit/components/brawler-detail/MetaIntelligence.test.tsx`:

```tsx
describe('MetaIntelligence — Task 11 (contextual empty states)', () => {
  const EMPTY_DATA: BrawlerMetaResponse = {
    brawlerId: 99,
    globalStats: { winRate: 50, pickRate: 0.5, totalBattles: 12, trend7d: 0 },
    bestMaps: [],
    worstMaps: [],
    strongAgainst: [],
    weakAgainst: [],
    bestTeammates: [],
  }

  it('uses contextual key for empty strongAgainst', () => {
    render(<MetaIntelligence data={EMPTY_DATA} />)
    // Mock returns the key verbatim when missing; the component must reference
    // the new key name, not the old generic "insufficientData".
    expect(screen.queryAllByText(/matchupsEmptyContextual|No hay matchups/i).length).toBeGreaterThan(0)
  })

  it('uses contextual key for empty bestMaps', () => {
    render(<MetaIntelligence data={EMPTY_DATA} />)
    expect(screen.queryAllByText(/bestMapsEmptyContextual|No hay datos de mapas/i).length).toBeGreaterThan(0)
  })

  it('still renders the globalStats grid even when everything else is empty', () => {
    render(<MetaIntelligence data={EMPTY_DATA} />)
    // Win rate and pick rate labels still visible (from the globalStats grid)
    expect(screen.getByText('Win Rate')).toBeTruthy()
    expect(screen.getByText('Pick Rate')).toBeTruthy()
  })
})
```

Also extend the mock translations dictionary at the top of the file to include the new keys:

```tsx
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      winRate: 'Win Rate',
      pickRate: 'Pick Rate',
      totalBattles: 'Total Battles',
      trending: 'Trending',
      bestMaps: 'Best Maps',
      strongAgainst: 'Strong Against',
      weakAgainst: 'Weak Against',
      bestTeammates: 'Best Teammates',
      insufficientData: 'Datos insuficientes',
      matchupsEmptyContextual: 'No hay matchups registrados',
      bestMapsEmptyContextual: 'No hay datos de mapas',
      bestTeammatesEmptyContextual: 'No hay teammates registrados',
      rising: 'Rising',
      falling: 'Falling',
      stable: 'Stable',
      sampleSize: `${params?.count ?? '?'} batallas`,
      confidenceHigh: 'High',
      confidenceMedium: 'Medium',
      confidenceLow: 'Low',
    }
    return map[key] ?? key
  },
}))
```

- [ ] **Step 11.2 — Run — expect failure**

```bash
npx vitest run src/__tests__/unit/components/brawler-detail/MetaIntelligence.test.tsx
```

Expected: 2 new tests fail (one passes — the globalStats grid check, since nothing changed for it).

- [ ] **Step 11.3 — Update `MetaIntelligence.tsx` empty-state strings**

Open `src/components/brawler-detail/MetaIntelligence.tsx`. Find the empty branch of `MatchupList` (around line 87 now — the `if (entries.length === 0)` branch). Change the empty text to the new contextual key:

```tsx
  if (entries.length === 0) {
    return (
      <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
          {title}
        </h3>
        <p className="text-sm text-slate-500">{t('matchupsEmptyContextual')}</p>
      </div>
    )
  }
```

Find the `bestMaps` empty branch (around line 182) and change its empty text:

```tsx
        {bestMaps.length === 0 ? (
          <p className="text-sm text-slate-500">{t('bestMapsEmptyContextual')}</p>
        ) : (
```

The `bestTeammates` block is different: it's wrapped in `{bestTeammates.length > 0 && (...)` which means the section silently disappears when empty. That's actually a valid UX pattern (no dedicated empty state needed because the absence of the section is self-explanatory when the rest of the page has data). **Do NOT add an empty state here** — the current behaviour of silently omitting the section is correct. If we added an empty state, it would clutter the page for the vast majority of brawlers who simply don't have trio-level data.

If you want to explicitly document this decision, add a one-line comment above the conditional:

```tsx
      {/* bestTeammates intentionally omitted when empty — the section
          disappears silently because the globalStats grid already
          conveys enough context about this brawler's activity level. */}
      {bestTeammates.length > 0 && (
```

- [ ] **Step 11.4 — Run — expect PASS**

```bash
npx vitest run src/__tests__/unit/components/brawler-detail/MetaIntelligence.test.tsx
```

Expected: all 8 tests pass (5 from Task 10 + 3 from Task 11).

- [ ] **Step 11.5 — Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 11.6 — Commit**

```bash
git add src/components/brawler-detail/MetaIntelligence.tsx src/__tests__/unit/components/brawler-detail/MetaIntelligence.test.tsx
git commit -m "feat(brawler-detail): contextual empty states per section"
```

---

## Task 12 — MapCard: promoted sample size + mode-fallback banner + contextual empty

**Files:**
- Modify: `src/components/picks/MapCard.tsx`
- Create: `src/__tests__/unit/components/picks/MapCard.test.tsx`

**Why:** `MapCard` is the `/picks` page card. Task 4 added the `source` field to the `/api/meta` response. Task 12 surfaces it visually (mode-fallback banner) and promotes the existing `totalBattles` from a tiny `text-[9px]` corner to a readable permanent label. The component already has `isLimited` (from `totalBattles < 100`) and uses `ConfidenceBadge` per row, so this task is a refinement of existing patterns rather than a new pattern.

- [ ] **Step 12.1 — Write failing tests**

Create `src/__tests__/unit/components/picks/MapCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      ended: 'Finalizado',
      limitedData: 'Datos limitados',
      noData: 'Sin datos aún',
      noDataContextual: 'Mapa nuevo — recolectando datos',
      modeFallbackBanner: 'Mostrando top del modo',
      showMore: 'Ver más',
      showLess: 'Ver menos',
      sampleSize: `${params?.count ?? '?'} batallas`,
    }
    return map[key] ?? key
  },
}))

vi.mock('@/components/ui/BrawlImg', () => ({
  BrawlImg: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

vi.mock('@/components/ui/ConfidenceBadge', () => ({
  ConfidenceBadge: ({ total }: { total: number }) => (
    <span data-confidence={total >= 10 ? 'high' : total >= 3 ? 'medium' : 'low'} />
  ),
}))

vi.mock('@/lib/utils', async () => ({
  getBrawlerPortraitUrl: (id: number) => `/p/${id}`,
  getBrawlerPortraitFallback: (id: number) => `/f/${id}`,
  getMapImageUrl: (id: number) => `/m/${id}`,
  getGameModeImageUrl: (mode: string) => `/g/${mode}`,
  wrColor: () => 'text-green-400',
  barGradient: () => 'from-green-400 to-green-600',
}))

import { MapCard } from '@/components/picks/MapCard'

const MOCK_TOP: Array<{ brawlerId: number; winRate: number; pickCount: number }> = [
  { brawlerId: 1, winRate: 62, pickCount: 142 },
  { brawlerId: 2, winRate: 58, pickCount: 98 },
  { brawlerId: 3, winRate: 56, pickCount: 75 },
]

function endTime(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 3600_000).toISOString()
}

describe('MapCard — Task 12', () => {
  it('renders the promoted sample size text', () => {
    render(
      <MapCard
        mode="brawlBall"
        map="Sidetrack"
        eventId={1}
        endTime={endTime(2)}
        totalBattles={1250}
        topBrawlers={MOCK_TOP}
      />,
    )
    expect(screen.getByText(/1250 batallas/)).toBeTruthy()
  })

  it('renders "limited data" amber warning when totalBattles < 100', () => {
    render(
      <MapCard
        mode="brawlBall"
        map="SparseMap"
        eventId={2}
        endTime={endTime(1)}
        totalBattles={12}
        topBrawlers={MOCK_TOP}
      />,
    )
    expect(screen.getByText('Datos limitados')).toBeTruthy()
  })

  it('renders the mode-fallback banner when source is "mode-fallback"', () => {
    render(
      <MapCard
        mode="heist"
        map="Pit Stop"
        eventId={3}
        endTime={endTime(1)}
        totalBattles={5}
        topBrawlers={MOCK_TOP}
        source="mode-fallback"
      />,
    )
    expect(screen.getByText(/Mostrando top del modo|modeFallbackBanner/i)).toBeTruthy()
  })

  it('renders contextual noData when topBrawlers is empty', () => {
    render(
      <MapCard
        mode="new"
        map="New Map"
        eventId={4}
        endTime={endTime(1)}
        totalBattles={0}
        topBrawlers={[]}
      />,
    )
    expect(screen.getByText(/noDataContextual|Mapa nuevo/i)).toBeTruthy()
  })

  it('omits the fallback banner when source is "map-mode" or missing', () => {
    const { container: c1 } = render(
      <MapCard mode="a" map="A" eventId={1} endTime={endTime(1)} totalBattles={500} topBrawlers={MOCK_TOP} source="map-mode" />,
    )
    expect(c1.textContent).not.toMatch(/modeFallbackBanner|Mostrando top del modo/)

    const { container: c2 } = render(
      <MapCard mode="a" map="A" eventId={1} endTime={endTime(1)} totalBattles={500} topBrawlers={MOCK_TOP} />,
    )
    expect(c2.textContent).not.toMatch(/modeFallbackBanner|Mostrando top del modo/)
  })
})
```

- [ ] **Step 12.2 — Run — expect failure**

```bash
npx vitest run src/__tests__/unit/components/picks/MapCard.test.tsx
```

Expected: failures in the sample-size prominence check, mode-fallback banner, and contextual empty state tests.

- [ ] **Step 12.3 — Modify `MapCard.tsx`**

Edit `src/components/picks/MapCard.tsx`. First, extend the `Props` interface to add the optional `source` prop:

```tsx
interface Props {
  mode: string
  map: string
  eventId: number
  endTime: string
  totalBattles: number
  topBrawlers: TopBrawler[]
  /**
   * Which aggregation tier produced `topBrawlers`. Optional for
   * backwards compat — defaults to 'map-mode'. Mode-fallback renders
   * an amber banner explaining the substitution. Added in Sprint C.
   */
  source?: 'map-mode' | 'mode-fallback'
}
```

Update the destructure:

```tsx
export function MapCard({ mode, map, eventId, endTime, totalBattles, topBrawlers, source = 'map-mode' }: Props) {
```

Replace the map name + limited warning block (lines 90-95 currently) with a richer header that shows the promoted sample size and the fallback banner:

```tsx
        {/* Map name */}
        <div className="absolute bottom-2 left-3 right-3">
          <p className="font-['Lilita_One'] text-lg text-white text-stroke-brawl leading-tight">{map}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-slate-300 tabular-nums">
              {t('sampleSize', { count: totalBattles })}
            </span>
            {isLimited && (
              <span className="text-[9px] text-amber-400/80">{t('limitedData')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Mode-fallback banner (Sprint C) */}
      {source === 'mode-fallback' && (
        <div className="px-3 py-1.5 bg-amber-400/10 border-t border-amber-400/20">
          <p className="text-[10px] text-amber-300">
            <span className="mr-1">⚠️</span>
            {t('modeFallbackBanner')}
          </p>
        </div>
      )}
```

Replace the `noData` generic text (line 101) with the contextual key:

```tsx
        {visible.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-4">{t('noDataContextual')}</p>
        ) : (
```

- [ ] **Step 12.4 — Run — expect PASS**

```bash
npx vitest run src/__tests__/unit/components/picks/MapCard.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 12.5 — Also update the consumer that builds `MapCard` props**

`MapCard` is rendered from `src/components/picks/PicksContent.tsx`. It receives props from the `/api/meta` response via `fetchMetaEvents()`. The API now returns `source` per map (from Task 4). Pass it through.

Open `src/components/picks/PicksContent.tsx` and find the `<MapCard ... />` usage. Add the `source` prop:

```tsx
<MapCard
  key={`${event.mode}-${event.map}`}
  mode={event.mode}
  map={event.map}
  eventId={event.eventId}
  endTime={event.endTime}
  totalBattles={event.totalBattles}
  topBrawlers={event.topBrawlers}
  source={event.source}
/>
```

If the type of `event` doesn't already include `source`, extend its type definition. Run `grep -n "fetchMetaEvents" src/lib/api*` to find the type — it is likely in `src/lib/api/meta.ts` or similar. Add `source?: 'map-mode' | 'mode-fallback'` to the event type so TypeScript is satisfied.

- [ ] **Step 12.6 — Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean. If `fetchMetaEvents` has a strictly-typed return, you will need to update that type to include the optional `source` field.

- [ ] **Step 12.7 — Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 12.8 — Commit**

```bash
git add src/components/picks/MapCard.tsx src/__tests__/unit/components/picks/MapCard.test.tsx src/components/picks/PicksContent.tsx
git commit -m "feat(picks): promoted sample size + mode-fallback banner in MapCard"
```

If `fetchMetaEvents`'s type file was also modified, include it in the `git add`.

---

## Task 13 — MatchupMatrix: clarity title change

**Files:**
- Modify: `src/components/analytics/MatchupMatrix.tsx`

**Why:** Spec Track 4 (§3). `MatchupMatrix` shows "your WR vs opponent" but its title is just `t('matchupsTitle')` → "MATCHUPS". That framing is ambiguous when sitting near other matchup-themed sections. A more explicit title removes the confusion: "TUS MATCHUPS — Cómo rindes tú contra cada oponente". The new i18n key goes in Task 14's batch; this task only swaps the component code to reference the new key.

- [ ] **Step 13.1 — Update the component**

Edit `src/components/analytics/MatchupMatrix.tsx`. Find both occurrences of `t('matchupsTitle')` — they are at line 58 (empty state) and line 74 (happy path header). Change both to `t('matchupsTitleExplicit')`:

```tsx
        <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
          <span className="text-xl">⚔️</span> {t('matchupsTitleExplicit')}
        </h3>
```

and

```tsx
        <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
          <span className="text-xl">⚔️</span> {t('matchupsTitleExplicit')}
          <InfoTooltip className="ml-1.5" text={t('tipMatchups')} />
        </h3>
```

Leave `t('matchupsTitle')` in NO occurrences. The `tipMatchups` tooltip key stays as-is.

The `t('matchupsEmpty')` and `t('matchupsEmptyHint')` keys also stay — they are the empty state copy, not the title.

- [ ] **Step 13.2 — Verify no other file references `matchupsTitle`**

```bash
grep -rn "matchupsTitle\b" src/
```

Expected: only occurrences inside `MatchupMatrix.tsx` are replaced. If there are other components using the same key, they should also migrate — but based on a previous audit, `MatchupMatrix` is the only consumer.

- [ ] **Step 13.3 — Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean. The new key `matchupsTitleExplicit` will be added to `messages/*.json` in Task 14 — until then, `useTranslations` returns the key verbatim.

- [ ] **Step 13.4 — Commit**

```bash
git add src/components/analytics/MatchupMatrix.tsx
git commit -m "feat(matchups): explicit title framing to disambiguate from counter views"
```

---

## Task 14 — i18n batch: add new keys, delete obsolete keys, 13 locales

**Files:**
- Create: `scripts/add-meta-ux-translations.js`
- Modify: `messages/{ar,de,en,es,fr,it,ja,ko,pl,pt,ru,tr,zh}.json` (13 files)

**Why:** All the previous tasks referenced new i18n keys that don't exist yet. Today `useTranslations` silently returns the key name as the rendered text when a key is missing (next-intl default), which works in development but looks broken in production ("topBrawlers.sampleSize" instead of "142 batallas"). Task 14 populates all 13 locales in one commit so no locale has partial coverage.

Keys to ADD (11 new, across 4 namespaces):

**`metaPro.*`:**
- `sampleSize` — "{count} batallas"
- `modeFallbackBanner` — "Mostrando datos agregados del modo — este mapa tiene datos escasos."
- `countersLabel` — "Counters"

**`brawlerDetail.*`:**
- `sampleSize` — "{count} batallas"
- `matchupsEmptyContextual` — "No hay matchups registrados para este brawler en los últimos 90 días. Esto suele ocurrir con brawlers recién lanzados o poco jugados."
- `bestMapsEmptyContextual` — "No hay datos de mapas para este brawler todavía. Vuelve a revisar en 24-48h."
- `bestTeammatesEmptyContextual` — "No hay teammates registrados todavía." (reserved — current component design silently omits the section when empty, so this key is defined but unused today. Defined for future use.)

**`picks.*`:**
- `sampleSize` — "{count} batallas"
- `noDataContextual` — "Mapa nuevo o rotación reciente — recolectando datos."
- `modeFallbackBanner` — "Mostrando top brawlers del modo general — este mapa tiene datos escasos."

**`advancedAnalytics.*`:**
- `matchupsTitleExplicit` — "TUS MATCHUPS — Cómo rindes TÚ contra cada oponente"

Keys to DELETE (2, both in `metaPro`):
- `metaPro.counterTitle`
- `metaPro.counterHint`

- [ ] **Step 14.1 — Create the batch translation script**

Create `scripts/add-meta-ux-translations.js` with exactly this content:

```js
#!/usr/bin/env node
// Sprint C — meta UX remediation i18n batch
// Adds 11 new keys across 4 namespaces to all 13 locales.
// Deletes 2 obsolete metaPro keys. Runs idempotently: existing new
// keys are overwritten with the freshest translations; obsolete keys
// are removed silently if present, left alone if already absent.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: {
    metaPro: {
      sampleSize: '{count} batallas',
      modeFallbackBanner: 'Mostrando datos agregados del modo — este mapa tiene datos escasos.',
      countersLabel: 'Counters',
    },
    brawlerDetail: {
      sampleSize: '{count} batallas',
      matchupsEmptyContextual: 'No hay matchups registrados para este brawler en los últimos 90 días. Esto suele ocurrir con brawlers recién lanzados o poco jugados.',
      bestMapsEmptyContextual: 'No hay datos de mapas para este brawler todavía. Vuelve a revisar en 24-48h.',
      bestTeammatesEmptyContextual: 'No hay teammates registrados todavía.',
    },
    picks: {
      sampleSize: '{count} batallas',
      noDataContextual: 'Mapa nuevo o rotación reciente — recolectando datos.',
      modeFallbackBanner: 'Mostrando top brawlers del modo general — este mapa tiene datos escasos.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'TUS MATCHUPS — Cómo rindes TÚ contra cada oponente',
    },
  },
  en: {
    metaPro: {
      sampleSize: '{count} battles',
      modeFallbackBanner: 'Showing mode-aggregate data — this map has too few battles.',
      countersLabel: 'Counters',
    },
    brawlerDetail: {
      sampleSize: '{count} battles',
      matchupsEmptyContextual: 'No matchups recorded for this brawler in the last 90 days. This usually happens with newly-released or rarely-played brawlers.',
      bestMapsEmptyContextual: 'No map data for this brawler yet. Check back in 24-48h.',
      bestTeammatesEmptyContextual: 'No teammates recorded yet.',
    },
    picks: {
      sampleSize: '{count} battles',
      noDataContextual: 'New map or recent rotation — collecting data.',
      modeFallbackBanner: 'Showing mode-aggregate top brawlers — this map has too few battles.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'YOUR MATCHUPS — How YOU perform against each opponent',
    },
  },
  fr: {
    metaPro: {
      sampleSize: '{count} batailles',
      modeFallbackBanner: 'Affichage des données agrégées du mode — cette carte a peu de données.',
      countersLabel: 'Contre-picks',
    },
    brawlerDetail: {
      sampleSize: '{count} batailles',
      matchupsEmptyContextual: "Aucun matchup enregistré pour ce brawler au cours des 90 derniers jours. Cela arrive pour les brawlers récents ou peu joués.",
      bestMapsEmptyContextual: 'Pas encore de données de cartes pour ce brawler. Revenez dans 24-48h.',
      bestTeammatesEmptyContextual: 'Aucun coéquipier enregistré pour le moment.',
    },
    picks: {
      sampleSize: '{count} batailles',
      noDataContextual: 'Nouvelle carte ou rotation récente — collecte des données en cours.',
      modeFallbackBanner: 'Affichage des top brawlers du mode général — cette carte a peu de données.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'TES MATCHUPS — Comment TU performes contre chaque adversaire',
    },
  },
  pt: {
    metaPro: {
      sampleSize: '{count} batalhas',
      modeFallbackBanner: 'Mostrando dados agregados do modo — este mapa tem poucos dados.',
      countersLabel: 'Counters',
    },
    brawlerDetail: {
      sampleSize: '{count} batalhas',
      matchupsEmptyContextual: 'Nenhum matchup registrado para este brawler nos últimos 90 dias. Isso costuma acontecer com brawlers recém-lançados ou pouco jogados.',
      bestMapsEmptyContextual: 'Ainda não há dados de mapas para este brawler. Volte em 24-48h.',
      bestTeammatesEmptyContextual: 'Nenhum aliado registrado ainda.',
    },
    picks: {
      sampleSize: '{count} batalhas',
      noDataContextual: 'Mapa novo ou rotação recente — coletando dados.',
      modeFallbackBanner: 'Mostrando top brawlers do modo geral — este mapa tem poucos dados.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'SEUS MATCHUPS — Como VOCÊ se sai contra cada oponente',
    },
  },
  de: {
    metaPro: {
      sampleSize: '{count} Kämpfe',
      modeFallbackBanner: 'Modus-Aggregat wird angezeigt — diese Karte hat zu wenig Daten.',
      countersLabel: 'Konter',
    },
    brawlerDetail: {
      sampleSize: '{count} Kämpfe',
      matchupsEmptyContextual: 'Keine Matchups für diesen Brawler in den letzten 90 Tagen. Das passiert oft bei neuen oder selten gespielten Brawlern.',
      bestMapsEmptyContextual: 'Noch keine Kartendaten für diesen Brawler. Schau in 24-48h wieder vorbei.',
      bestTeammatesEmptyContextual: 'Noch keine Teammates erfasst.',
    },
    picks: {
      sampleSize: '{count} Kämpfe',
      noDataContextual: 'Neue Karte oder kürzliche Rotation — Daten werden gesammelt.',
      modeFallbackBanner: 'Top-Brawler aus dem allgemeinen Modus — diese Karte hat zu wenig Daten.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'DEINE MATCHUPS — Wie DU gegen jeden Gegner abschneidest',
    },
  },
  it: {
    metaPro: {
      sampleSize: '{count} battaglie',
      modeFallbackBanner: 'Mostro dati aggregati della modalità — questa mappa ha pochi dati.',
      countersLabel: 'Counter',
    },
    brawlerDetail: {
      sampleSize: '{count} battaglie',
      matchupsEmptyContextual: 'Nessun matchup registrato per questo brawler negli ultimi 90 giorni. Succede spesso con brawler appena usciti o poco giocati.',
      bestMapsEmptyContextual: 'Nessun dato di mappe per questo brawler. Ricontrolla tra 24-48h.',
      bestTeammatesEmptyContextual: 'Nessun compagno registrato ancora.',
    },
    picks: {
      sampleSize: '{count} battaglie',
      noDataContextual: 'Mappa nuova o rotazione recente — raccolta dati in corso.',
      modeFallbackBanner: 'Mostro i top brawler della modalità generale — questa mappa ha pochi dati.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'I TUOI MATCHUP — Come TU vai contro ogni avversario',
    },
  },
  ru: {
    metaPro: {
      sampleSize: '{count} боёв',
      modeFallbackBanner: 'Показаны агрегированные данные режима — на этой карте мало данных.',
      countersLabel: 'Контры',
    },
    brawlerDetail: {
      sampleSize: '{count} боёв',
      matchupsEmptyContextual: 'Нет зарегистрированных матчапов для этого бойца за последние 90 дней. Обычно это бывает с новыми или редко играемыми бойцами.',
      bestMapsEmptyContextual: 'Пока нет данных о картах для этого бойца. Вернитесь через 24-48ч.',
      bestTeammatesEmptyContextual: 'Пока нет зарегистрированных союзников.',
    },
    picks: {
      sampleSize: '{count} боёв',
      noDataContextual: 'Новая карта или недавняя ротация — собираем данные.',
      modeFallbackBanner: 'Показаны лучшие бойцы режима в целом — на этой карте мало данных.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'ТВОИ МАТЧАПЫ — Как ТЫ играешь против каждого противника',
    },
  },
  tr: {
    metaPro: {
      sampleSize: '{count} savaş',
      modeFallbackBanner: 'Mod geneli veriler gösteriliyor — bu haritada yeterli veri yok.',
      countersLabel: 'Karşı seçimler',
    },
    brawlerDetail: {
      sampleSize: '{count} savaş',
      matchupsEmptyContextual: 'Bu brawler için son 90 gün içinde kayıtlı eşleşme yok. Genellikle yeni çıkan veya az oynanan brawlerlarda olur.',
      bestMapsEmptyContextual: 'Bu brawler için henüz harita verisi yok. 24-48 saat sonra tekrar kontrol et.',
      bestTeammatesEmptyContextual: 'Henüz kayıtlı takım arkadaşı yok.',
    },
    picks: {
      sampleSize: '{count} savaş',
      noDataContextual: 'Yeni harita veya yakın zamanda gelen rotasyon — veri toplanıyor.',
      modeFallbackBanner: 'Genel mod için en iyi brawlerlar gösteriliyor — bu haritada yeterli veri yok.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'SENİN EŞLEŞMELERİN — SEN her rakibe karşı nasıl gidiyorsun',
    },
  },
  pl: {
    metaPro: {
      sampleSize: '{count} bitew',
      modeFallbackBanner: 'Pokazuję dane zbiorcze trybu — ta mapa ma zbyt mało danych.',
      countersLabel: 'Kontry',
    },
    brawlerDetail: {
      sampleSize: '{count} bitew',
      matchupsEmptyContextual: 'Brak zarejestrowanych pojedynków dla tego brawlera w ciągu ostatnich 90 dni. Zwykle dotyczy nowych lub rzadko granych brawlerów.',
      bestMapsEmptyContextual: 'Brak danych o mapach dla tego brawlera. Wróć za 24-48 godzin.',
      bestTeammatesEmptyContextual: 'Brak zarejestrowanych sojuszników.',
    },
    picks: {
      sampleSize: '{count} bitew',
      noDataContextual: 'Nowa mapa lub niedawna rotacja — zbieram dane.',
      modeFallbackBanner: 'Pokazuję najlepszych brawlerów trybu ogólnego — ta mapa ma zbyt mało danych.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'TWOJE POJEDYNKI — Jak TY radzisz sobie przeciwko każdemu',
    },
  },
  ar: {
    metaPro: {
      sampleSize: '{count} معركة',
      modeFallbackBanner: 'عرض البيانات المجمعة للوضع — هذه الخريطة لديها بيانات قليلة.',
      countersLabel: 'مضادات',
    },
    brawlerDetail: {
      sampleSize: '{count} معركة',
      matchupsEmptyContextual: 'لا توجد مواجهات مسجلة لهذا المقاتل في آخر 90 يوماً. يحدث هذا عادةً مع المقاتلين الجدد أو غير الشائعين.',
      bestMapsEmptyContextual: 'لا توجد بيانات خرائط لهذا المقاتل حتى الآن. تحقق خلال 24-48 ساعة.',
      bestTeammatesEmptyContextual: 'لا توجد شراكات مسجلة بعد.',
    },
    picks: {
      sampleSize: '{count} معركة',
      noDataContextual: 'خريطة جديدة أو تناوب حديث — جمع البيانات جارٍ.',
      modeFallbackBanner: 'عرض أفضل المقاتلين للوضع العام — هذه الخريطة لديها بيانات قليلة.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'مواجهاتك — كيف تؤدي أنت ضد كل خصم',
    },
  },
  ko: {
    metaPro: {
      sampleSize: '{count}전',
      modeFallbackBanner: '모드 전체 데이터를 표시 중 — 이 맵에는 데이터가 부족합니다.',
      countersLabel: '카운터',
    },
    brawlerDetail: {
      sampleSize: '{count}전',
      matchupsEmptyContextual: '최근 90일 동안 이 브롤러에 대한 매치업 기록이 없습니다. 신규 출시 또는 사용률이 낮은 브롤러에서 자주 발생합니다.',
      bestMapsEmptyContextual: '이 브롤러의 맵 데이터가 아직 없습니다. 24-48시간 후에 다시 확인하세요.',
      bestTeammatesEmptyContextual: '아직 등록된 팀원이 없습니다.',
    },
    picks: {
      sampleSize: '{count}전',
      noDataContextual: '새 맵이거나 최근 로테이션 — 데이터 수집 중.',
      modeFallbackBanner: '전체 모드의 탑 브롤러 표시 중 — 이 맵에는 데이터가 부족합니다.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: '내 매치업 — 각 상대에 대해 내가 얼마나 잘 싸우는지',
    },
  },
  ja: {
    metaPro: {
      sampleSize: '{count}戦',
      modeFallbackBanner: 'モード全体のデータを表示中 — このマップはデータが不足しています。',
      countersLabel: 'カウンター',
    },
    brawlerDetail: {
      sampleSize: '{count}戦',
      matchupsEmptyContextual: 'このブロウラーの過去90日間のマッチアップ記録がありません。新規リリースや利用率の低いブロウラーでよく起こります。',
      bestMapsEmptyContextual: 'このブロウラーのマップデータはまだありません。24〜48時間後に再度確認してください。',
      bestTeammatesEmptyContextual: '味方の記録はまだありません。',
    },
    picks: {
      sampleSize: '{count}戦',
      noDataContextual: '新しいマップまたは最近のローテーション — データ収集中。',
      modeFallbackBanner: 'モード全体のトップブロウラーを表示中 — このマップはデータが不足しています。',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'あなたのマッチアップ — 各相手にどう戦うか',
    },
  },
  zh: {
    metaPro: {
      sampleSize: '{count}场对战',
      modeFallbackBanner: '显示模式汇总数据 — 此地图数据较少。',
      countersLabel: '克制',
    },
    brawlerDetail: {
      sampleSize: '{count}场对战',
      matchupsEmptyContextual: '过去90天没有此英雄的对战记录。通常发生在新上线或很少使用的英雄身上。',
      bestMapsEmptyContextual: '此英雄暂无地图数据。请24-48小时后再来查看。',
      bestTeammatesEmptyContextual: '暂无队友记录。',
    },
    picks: {
      sampleSize: '{count}场对战',
      noDataContextual: '新地图或近期轮换 — 正在收集数据。',
      modeFallbackBanner: '显示综合模式的顶级英雄 — 此地图数据较少。',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: '你的对位 — 你对每个对手的表现',
    },
  },
}

// Keys to DELETE (obsolete after CounterQuickView removal).
const DELETIONS = [
  { namespace: 'metaPro', key: 'counterTitle' },
  { namespace: 'metaPro', key: 'counterHint' },
]

function updateLocale(locale) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)
  const additions = TRANSLATIONS[locale]

  if (!additions) {
    console.error(`✗ No translations defined for locale "${locale}"`)
    return { added: 0, deleted: 0 }
  }

  let addedCount = 0
  let deletedCount = 0

  // Merge new keys
  for (const [namespace, keys] of Object.entries(additions)) {
    if (!data[namespace]) data[namespace] = {}
    for (const [key, value] of Object.entries(keys)) {
      data[namespace][key] = value
      addedCount++
    }
  }

  // Remove obsolete keys
  for (const { namespace, key } of DELETIONS) {
    if (data[namespace] && key in data[namespace]) {
      delete data[namespace][key]
      deletedCount++
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  return { added: addedCount, deleted: deletedCount }
}

console.log('Sprint C — meta UX remediation i18n batch\n')
let total = { added: 0, deleted: 0 }
for (const locale of LOCALES) {
  const result = updateLocale(locale)
  console.log(`  ${locale.padEnd(3)}  +${result.added} new keys  -${result.deleted} deletions`)
  total.added += result.added
  total.deleted += result.deleted
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated`)
console.log(`  Total: +${total.added} key-additions, -${total.deleted} key-deletions`)
```

- [ ] **Step 14.2 — Run the script**

```bash
node scripts/add-meta-ux-translations.js
```

Expected output:

```
Sprint C — meta UX remediation i18n batch

  ar   +11 new keys  -2 deletions
  de   +11 new keys  -2 deletions
  en   +11 new keys  -2 deletions
  es   +11 new keys  -2 deletions
  fr   +11 new keys  -2 deletions
  it   +11 new keys  -2 deletions
  ja   +11 new keys  -2 deletions
  ko   +11 new keys  -2 deletions
  pl   +11 new keys  -2 deletions
  pt   +11 new keys  -2 deletions
  ru   +11 new keys  -2 deletions
  tr   +11 new keys  -2 deletions
  zh   +11 new keys  -2 deletions

✓ 13/13 locales updated
  Total: +143 key-additions, -26 key-deletions
```

- [ ] **Step 14.3 — Sanity-check every locale parses as valid JSON**

```bash
node -e "['ar','de','en','es','fr','it','ja','ko','pl','pt','ru','tr','zh'].forEach(l => { try { JSON.parse(require('fs').readFileSync('messages/' + l + '.json', 'utf-8')); console.log('  ' + l + ' ✓') } catch (e) { console.error('  ' + l + ' ✗', e.message); process.exit(1) } })"
```

Expected: 13 green checks.

- [ ] **Step 14.4 — Spot-check that the new keys landed correctly**

```bash
node -e "const es = require('./messages/es.json'); console.log('metaPro.sampleSize:', es.metaPro.sampleSize); console.log('metaPro.counterTitle:', es.metaPro.counterTitle); console.log('picks.noDataContextual:', es.picks.noDataContextual); console.log('advancedAnalytics.matchupsTitleExplicit:', es.advancedAnalytics.matchupsTitleExplicit);"
```

Expected output:

```
metaPro.sampleSize: {count} batallas
metaPro.counterTitle: undefined
picks.noDataContextual: Mapa nuevo o rotación reciente — recolectando datos.
advancedAnalytics.matchupsTitleExplicit: TUS MATCHUPS — Cómo rindes TÚ contra cada oponente
```

`metaPro.counterTitle` should be `undefined` — that is the signal that the deletion worked.

- [ ] **Step 14.5 — Typecheck + full test suite**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: both clean. Tests now exercise the real keys instead of the mock fallbacks, and their assertions on display text should continue to pass because the tests match on substrings.

- [ ] **Step 14.6 — Commit**

```bash
git add scripts/add-meta-ux-translations.js messages/
git commit -m "feat(i18n): Sprint C meta UX keys (+11 new, -2 obsolete) × 13 locales"
```

---

## Task 15 — Manual smoke test + smoke-checklist doc

**Files:**
- Create: `docs/superpowers/specs/SMOKE-TEST-SPRINT-C.md`

**Why:** The spec's definition-of-done requires a smoke-test document that future deploys can re-run. This task creates that document AND runs it once against a local dev server to validate the sprint end-to-end before closing.

- [ ] **Step 15.1 — Create the smoke test doc**

Create `docs/superpowers/specs/SMOKE-TEST-SPRINT-C.md`:

```markdown
# Smoke Test — Sprint C Meta UX Remediation

Run this checklist once after any deploy that touches `/api/meta/pro-analysis`, `/api/meta`, `TopBrawlersGrid`, `MetaIntelligence`, `MapCard`, `MatchupMatrix`, `MetaProTab`, or any locale file. Takes ~5 minutes.

## Prerequisites

- Migration `012_meta_stats_mode_index.sql` has been applied to production via the Supabase Dashboard SQL Editor
- Deploy is live
- A premium dev account is available for the tier-specific checks

## Public surface (anonymous user)

- [ ] `/picks` — each MapCard shows the promoted sample size in its bottom-left corner (e.g. "1,250 batallas")
- [ ] `/picks` — on a map with <100 battles, the amber "Datos limitados" indicator is visible
- [ ] `/picks` — on a map with effectively zero battles, either (a) the contextual empty state renders "Mapa nuevo o rotación reciente — recolectando datos." or (b) the mode-fallback banner renders and the card shows mode-level data
- [ ] `/brawler/16000001` (Shelly public page) — `MetaIntelligence` shows per-row `(N) batallas` on strong/weak matchups and on the teammates list
- [ ] `/brawler/16000001` — `MetaIntelligence` shows per-card `(N) batallas` overlay on the best-maps grid
- [ ] `/brawler/16000001` — `ConfidenceBadge` dots are visible on every row with sample size ≥ 1
- [ ] `/brawler/16000059` or a rare brawler — empty sections show the new contextual copy ("No hay matchups registrados...", "No hay datos de mapas...") instead of "Datos insuficientes"

## Premium Meta Pro tab (authenticated premium user)

- [ ] `/profile/{tag}/analytics` → Meta Pro tab with a Tier A map selected (e.g. Sidetrack + brawlBall)
    - [ ] `TopBrawlersGrid` shows inline counters below each brawler card (3 per card)
    - [ ] Each brawler card shows `(N) batallas` and a `ConfidenceBadge` dot
    - [ ] NO mode-fallback banner visible
    - [ ] `CounterQuickView` is NOT rendered anywhere (section is gone)
- [ ] Same tab with a Tier D map (e.g. heist::Pit Stop if it's in rotation)
    - [ ] Mode-fallback banner visible at the top of `TopBrawlersGrid`: "Mostrando datos agregados del modo — este mapa tiene datos escasos."
    - [ ] The brawler grid is populated with mode-level data (non-empty)
    - [ ] Trends (7d/30d arrows) are present on the cards (verifies the Tier 2 fallback re-queried trends)
- [ ] `MatchupMatrix` section — title reads "TUS MATCHUPS — Cómo rindes TÚ contra cada oponente" (or the equivalent in the UI locale)

## Locale spot-check

- [ ] Switch the app to `en` — every new string renders in English, not as the key name
- [ ] Switch to `fr` — same
- [ ] Switch to `ja` — same; no broken characters

## Error paths

- [ ] Deliberately visit `/api/meta/pro-analysis` without `map` or `mode` query params → 400 error (pre-existing behaviour, verify it still holds)
- [ ] Disable network on the browser and reload Meta Pro → spinner + error state (pre-existing)

## Backend sanity

- [ ] `curl -s "https://brawlvision.com/api/meta?force=1"` returns JSON with each map having a `source` field (`"map-mode"` or `"mode-fallback"`)
- [ ] Response headers include `Cache-Control: public, s-maxage=1800, stale-while-revalidate=3600`
- [ ] `curl -s "https://brawlvision.com/api/meta/pro-analysis?map=Sidetrack&mode=brawlBall"` returns JSON with `topBrawlersSource: "map-mode"`

## If any step fails

1. Check the Vercel Function logs for the affected route
2. Verify migration 012 is applied (`SELECT indexname FROM pg_indexes WHERE indexname = 'idx_meta_stats_mode_lookup';` in Supabase Dashboard)
3. Verify the locale file for the active language parses as valid JSON
4. Re-run this checklist
```

- [ ] **Step 15.2 — Start a local dev server and walk the checklist**

```bash
npm run dev
```

Open a browser to `http://localhost:3000/es` and walk through the checkboxes. Check off each item or flag mismatches.

- [ ] **Step 15.3 — Commit the doc**

```bash
git add docs/superpowers/specs/SMOKE-TEST-SPRINT-C.md
git commit -m "docs(sprint-c): smoke test checklist"
```

---

## Task 16 — MEMORY.md + CLAUDE.md updates with sprint learnings

**Files:**
- Modify: `C:/Users/alvar/.claude/projects/C--Proyectos-Agentes-brawlValue/memory/MEMORY.md` (and one or more new memory entry files under the same directory)
- Modify: `CLAUDE.md` (optional — only if a learning is project-global, not just session-ephemeral)

**Why:** Spec's definition-of-done explicitly requires this. Learnings from execution (errors encountered during implementation, subagent report patterns, merge friction, anything non-obvious) go into new memory entries so future sprints benefit.

- [ ] **Step 16.1 — Review the sprint history**

Look at the commit log from this sprint (`git log --oneline main...HEAD` inside the Sprint C worktree) and the subagent reports from each task. Identify patterns worth capturing:

- Did the cascade refactor (Task 3) reveal any hidden assumptions?
- Did any test file fail in a way the plan did not predict? Why?
- Did any component prop change require a cascading update the plan missed?
- Did the i18n batch produce any surprising locale-specific issues?
- Did the smoke test (Task 15) reveal anything the unit/integration tests missed?

- [ ] **Step 16.2 — Write new memory entries**

For each non-obvious learning, create a new file under `memory/` following the existing pattern (see `feedback_*.md` files for the structure). Each file has front-matter with `name`, `description`, `type: feedback` or `project`, and a body explaining the lesson with a `Why:` and `How to apply:` section.

Example structure for a new entry (`memory/feedback_sprint_c_cascade_trends.md`):

```markdown
---
name: Cascade queries must also re-query their dependent trend maps
description: When a fallback query drops a filter dimension, any derived query that reused that dimension must also be re-run
type: feedback
---

(body explaining the lesson, with Why: and How to apply:)
```

- [ ] **Step 16.3 — Add the new entries to `MEMORY.md` index**

Edit `memory/MEMORY.md` (the top-level index) and add one line per new file, following the existing format:

```markdown
- [New entry name](new_entry_file.md) — one-line description
```

Keep the index sorted by topical grouping (feedback/project/reference/user). Do not reorder existing entries.

- [ ] **Step 16.4 — Optional: update `CLAUDE.md`**

If any learning from this sprint is a project-wide convention worth encoding (e.g., "every API route with a Cache-Control header should also be in SMOKE-TEST docs"), add it to `CLAUDE.md` under a new bullet.

Do NOT add session-ephemeral lessons to `CLAUDE.md` — those go in `memory/` only.

- [ ] **Step 16.5 — Commit**

```bash
git add C:/Users/alvar/.claude/projects/C--Proyectos-Agentes-brawlValue/memory/ CLAUDE.md
git commit -m "docs(memory): Sprint C execution learnings"
```

The CLAUDE.md add is only included if Step 16.4 actually modified it.

---

## Self-review (before subagent dispatch)

The brainstorming-skill workflow requires a spec self-review and a plan self-review. The plan self-review below was run against the spec v3 (commit `dabb7d1`) with the following checks:

### 1. Spec coverage

| Spec section / requirement | Task that implements it |
|---|---|
| §3 Track 1 contextual empty states | Tasks 11, 12 (MetaIntelligence, MapCard); Task 14 (i18n batch) |
| §3 Track 2 sample-size prominence | Tasks 5 (TopBrawlersGrid), 10 (MetaIntelligence), 12 (MapCard) |
| §3 Track 3 targeted cascade | Tasks 1 (index), 2 (type), 3 (pro-analysis), 4 (meta route); UI rendering in Tasks 6, 12 |
| §3 Track 4 ConfidenceBadge + clarity labels | Tasks 5, 10, 13 |
| §3 Track 5 inline counters + delete CounterQuickView | Tasks 7, 8, 9 |
| §4.2 File inventory — 8 TS/TSX, 13 JSON, 2 created, 4 test files, 1 delete | Tasks 1, 3, 4, 5-13, 14 |
| §4.3 Non-goals (no schema, no cron, etc.) | Respected — no task touches the non-goals list |
| §7.2 Migration 012 | Task 1 |
| §7.5 Cache-Control side-fix for /api/meta | Task 4 Step 4.2 |
| §8.1 Component unit tests | Tasks 5, 10, 12 create the 3 test files; Task 11 extends Task 10's file |
| §8.2 Integration tests for API cascade | Task 3 creates the file; Task 4's cascade is covered by the same integration suite shape (though no dedicated file for /api/meta — covered by smoke test Task 15) |
| §9 Rollout plan 16 tasks | Tasks 1-16 |
| §11 Definition of done | Task 15 (smoke), Task 16 (memory), Task 14 (i18n) |

All spec requirements have at least one task implementing them. No gaps detected.

### 2. Placeholder scan

Searched for `TODO`, `TBD`, `FIXME`, `implement later`, `fill in`, `Similar to Task`, `Add appropriate error handling`. Zero placeholder patterns remain in the plan — all code blocks are complete.

### 3. Type consistency

| Symbol | Defined in task | Consumed in task |
|---|---|---|
| `topBrawlersSource: 'map-mode' \| 'mode-fallback'` | Task 2 (type) | Task 3 (route), Task 6 (UI), Task 8 (MetaProTab prop wire), Task 12 Step 12.5 (MapCard parent) |
| `source: 'map-mode' \| 'mode-fallback'` (MapCard prop) | Task 12 | Task 12 Step 12.5 (PicksContent) |
| `counters?: CounterEntry[]` (TopBrawlersGrid prop) | Task 7 | Task 8 |
| `ConfidenceBadge total` prop | (existing component, unchanged) | Tasks 5, 7, 10, 12 |
| `aggregateAllBrawlers` helper | Task 3 | Task 3 only (scoped inside the route) |
| `buildTrendMaps` helper | Task 3 | Task 3 only |

All types flow consistently from definition to consumer.

### 4. i18n key consistency

| Key name | Added in task | Used in task |
|---|---|---|
| `metaPro.sampleSize` | Task 14 | Task 5 (TopBrawlersGrid card) |
| `metaPro.modeFallbackBanner` | Task 14 | Task 6 (TopBrawlersGrid banner) |
| `metaPro.countersLabel` | Task 14 | Task 7 (TopBrawlersGrid inline counters header) |
| `brawlerDetail.sampleSize` | Task 14 | Task 10 (MetaIntelligence all 3 lists) |
| `brawlerDetail.matchupsEmptyContextual` | Task 14 | Task 11 (MatchupList empty) |
| `brawlerDetail.bestMapsEmptyContextual` | Task 14 | Task 11 (bestMaps empty) |
| `brawlerDetail.bestTeammatesEmptyContextual` | Task 14 | (reserved — unused in Task 11 because silent omission is the chosen UX) |
| `picks.sampleSize` | Task 14 | Task 12 (MapCard header) |
| `picks.noDataContextual` | Task 14 | Task 12 (MapCard empty) |
| `picks.modeFallbackBanner` | Task 14 | Task 12 (MapCard banner) |
| `advancedAnalytics.matchupsTitleExplicit` | Task 14 | Task 13 (MatchupMatrix title) |

All 11 new keys are consumed by at least one component except `brawlerDetail.bestTeammatesEmptyContextual` which is intentionally reserved for future use (documented inline in Task 11 Step 11.3). The spec calls this out.

Deletions (2 keys) are consumed-nowhere — both were exclusively used by `CounterQuickView` which is deleted in Task 9.

### 5. Ordering consistency

The 9 phases are ordered so each phase's outputs are ready for the next phase's consumers:

- Phase A (Tasks 1-2) lands the index and the type field
- Phase B (Tasks 3-4) lands the cascade
- Phase C (Tasks 5-7) lands the TopBrawlersGrid rewrite (depends on the type field from Phase A)
- Phase D (Tasks 8-9) wires MetaProTab and deletes CounterQuickView (depends on Phase C)
- Phase E (Tasks 10-11) lands MetaIntelligence (independent of the other phases)
- Phase F (Task 12) lands MapCard (depends on Phase B's /api/meta source field)
- Phase G (Task 13) lands MatchupMatrix title (independent)
- Phase H (Task 14) lands i18n (depends on all component-level references)
- Phase I (Tasks 15-16) is validation + documentation

No dependency inversions detected.

### Self-review verdict

PASS. The plan is internally consistent, covers every spec requirement, has no placeholder code, and respects the brainstorming-skill's YAGNI + TDD + frequent-commits principles. Ready for subagent dispatch.
