# Sprint C — Meta UX Remediation Design Spec

**Date:** 2026-04-13
**Status:** Draft (pending user approval)
**Author:** Brainstormed with Claude Opus 4.6 (1M context)

## Changelog

- **v1 (2026-04-13)** — initial design, post 3 rounds of UI verification
- **v1 retracted partially** — audit conflated meta_stats sparsity with meta_matchups sparsity; see §2
- **v2 (2026-04-13)** — full scope rewrite after reading the actual components directly. This is the first version grounded in verified code reality, not agent summaries.

## 1. Motivation

On 2026-04-12 the meta-coverage audit identified that Tier D maps (heist::Pit Stop, knockout::Goldarm Gulch, etc.) show sparse top-brawler lists because `meta_stats(map, mode)` has very few battles on those rotations. The audit proposed a "hierarchical backoff for counter-picks" as Priority 2.

On 2026-04-13 a UX-focused re-audit found that the audit conflated two independent problems:

1. **`meta_stats` map-level sparsity** — real, affects `TopBrawlersGrid` and `MapCard`
2. **`meta_matchups` rare-brawler sparsity** — much less visible, affects `MetaIntelligence` in edge cases

The UX re-audit also found that the existing analytics surface already handles sparsity with three layered defences: Bayesian smoothing (`bayesianWinRate`, strength 30), display thresholds (`PRO_MIN_BATTLES_DISPLAY`, `>= 3` filters), and visual muting (`ConfidenceBadge`, `opacity-40`). None of these are user-visible explanations of WHY data is sparse, and several key components either hide the existing sample-size data or show a generic "Insufficient data" string without context.

Sprint C is the remediation of these gaps. It is a **UX sprint**, not a data sprint: no schema changes, no migrations, no cron work. The objective is that every metric the user sees is honest about its confidence, every empty state explains itself, and one real redundancy (`CounterQuickView` vs the top-brawlers view) is removed so the same information is not rendered in two places with different framings.

## 2. Problems actually present (verified from code)

### 2.1 Generic empty states

The UI audit catalogued 14 empty states across the analytics surface. All are i18n-wrapped but most say some variant of "Insufficient data" / "No data" / "Collecting data" without explaining WHY. Sprint C targets the 5 most-visible ones in the components it otherwise touches.

### 2.2 Hidden sample-size information

`TopBrawlerEntry`, `MatchupStat`, `TeammateStat`, and `MapStat` all carry `totalBattles: number`. None of the consuming components display it per-row. Users see a win-rate percentage with no indication whether it's based on 5 games or 500.

`TopBrawlersGrid` shows `totalBattles` at the header level but in `text-[10px]` in the top-right corner — easy to miss. `ConfidenceBadge` exists (a 2×2px dot with a hover tooltip) and is used in 6 components, but is absent from `TopBrawlersGrid`, `MetaIntelligence`, and `CounterQuickView`.

### 2.3 Redundant rendering of counter data

`CounterQuickView` renders a list of "best counters" per top brawler on the selected map. The same information is available inside `ProAnalysisResponse.counters` and could be rendered inline with each card in `TopBrawlersGrid`. Two separate cards asking two versions of the same question:

- `TopBrawlersGrid`: "Who wins on this map?"
- `CounterQuickView`: "For each of those winners, who beats them?"

Inline-connecting these answers is the single highest-value UX improvement available from the existing data. A user reading a TopBrawlersGrid card no longer has to scroll to a second section to find the follow-up information.

### 2.4 Empty state returns `null` in `CounterQuickView`

`CounterQuickView` returns `null` when `counters.length === 0`, meaning the component silently disappears from the layout. No copy, no explanation. If `CounterQuickView` is deleted (§3 Track 5), the problem goes away.

### 2.5 Map-specific meta is sparse on Tier D rotations

Today a user selecting `heist::Pit Stop` in the Meta Pro tab sees `TopBrawlersGrid` with its generic "no data for map" empty state (a real user-visible behaviour on low-rotation maps). The data IS available at the mode level; showing the mode-level aggregate with a clear "(datos del modo, este mapa está escaso)" label is honest and useful.

### 2.6 Framing ambiguity between related components

`MatchupMatrix` ("how do I fare against X") and `CounterQuickView` ("who beats X in the meta") are complementary, not duplicates, but their titles are not explicit about the question each one answers. Deleting `CounterQuickView` removes half of this confusion. The remaining half — `MatchupMatrix`'s title — is upgraded to be explicit.

## 3. Scope — 5 tracks

### Track 1 — Contextual empty states

Replace 5 generic empty state strings with copy that explains the concrete cause, using the data that's already available (map name, mode name, window, counts).

| Component | Before | After |
|---|---|---|
| `TopBrawlersGrid` (no data) | `t('metaPro.noDataForMap')` → "No hay datos para este mapa" | `"No hay datos suficientes para {mode}::{map} en los últimos {N} días. La ventana mínima es 3 batallas por brawler."` |
| `TopBrawlersGrid` (mode fallback engaged) | n/a (new) | `"Mostrando datos agregados de {mode} — {map} tiene solo {N} batallas en los últimos {window}d."` |
| `MapCard` (no data) | `t('picks.noData')` → "Sin datos" | `"Mapa nuevo o rotación reciente — recolectando datos. Última actualización: hace {N}h."` |
| `MetaIntelligence` MatchupList (empty) | `t('brawlerDetail.insufficientData')` → "Datos insuficientes" | `"No hay matchups registrados para {brawlerName} en los últimos 90 días. Esto suele ocurrir con brawlers recién lanzados o poco jugados."` |
| `MetaIntelligence` bestMaps (empty) | `t('brawlerDetail.insufficientData')` → "Datos insuficientes" | `"No hay datos de mapas para {brawlerName} todavía. Vuelve a revisar en 24-48h."` |

All new keys go under a new `metaUx.emptyStates.*` namespace to avoid polluting existing namespaces. Existing keys remain in place until all consumers are migrated; in this sprint we update every consumer, so the old keys can be deleted in the same commit where the last consumer is migrated.

### Track 2 — Sample size prominence

Render the `totalBattles` field — already present in the data types — at per-row/per-card level in the 4 components that currently hide it.

| Component | Current | Change |
|---|---|---|
| `TopBrawlersGrid` card | shows WR and pick rate only | Add `{totalBattles.toLocaleString()} batallas` under the name |
| `TopBrawlersGrid` header | `text-[10px]` corner text | Promote to a section subtitle `"{totalUnique} batallas totales analizadas en los últimos {window}d"` |
| `MetaIntelligence` MatchupList row | shows WR only | Append `· {totalBattles} batallas` after the WR |
| `MetaIntelligence` bestMaps card | shows WR only | Overlay `{totalBattles}` in the bottom-right of the card |
| `MetaIntelligence` bestTeammates row | shows WR only | Append `· {totalBattles} batallas` after the WR |
| `MapCard` (event rotation) | `text-[9px]` "Limited data" warning only when `<100` | Replace with permanent `{totalBattles} batallas` + amber warning only when `<100` |

### Track 3 — Targeted 2-tier cascade for map-specific meta

The ONLY cascade in this sprint is for `meta_stats` map-level aggregation in the pro-analysis and event-rotation API routes. No shared helper, no types, no abstraction — the logic is ~10 lines inline with a comment pointing to this spec section.

**Pseudocode in `src/app/api/meta/pro-analysis/route.ts`:**

```ts
// Tier 1: map+mode filter (current behaviour)
const { data: statsRows } = await supabase.from('meta_stats')
  .select(...).eq('map', map).eq('mode', mode)...

let topBrawlersSource: 'map-mode' | 'mode-fallback' = 'map-mode'
let effectiveStatsRows = statsRows ?? []

// Aggregate and filter to brawlers that pass PRO_MIN_BATTLES_DISPLAY
// (existing code path, lines 120-194)

// New: if the filter leaves the list empty, fall back to mode-only
if (allBrawlers.length === 0) {
  const { data: modeStatsRows } = await supabase.from('meta_stats')
    .select(...).eq('mode', mode)...  // NO map filter
  if (modeStatsRows && modeStatsRows.length > 0) {
    topBrawlersSource = 'mode-fallback'
    // Re-run aggregation with modeStatsRows
    effectiveStatsRows = modeStatsRows
    // Re-run the loop that builds allBrawlers
  }
}
```

The response gets a new field:

```ts
interface ProAnalysisResponse {
  // ...existing fields
  topBrawlersSource: 'map-mode' | 'mode-fallback'  // NEW
}
```

The `TopBrawlersGrid` component reads this field and, when it's `'mode-fallback'`, renders a yellow inline badge above the grid explaining that the map is too sparse.

The same logic is applied in `src/app/api/meta/route.ts` (the event-rotation endpoint that feeds `MapCard`). That API response also gets a `source` field per map, and `MapCard` reads it.

**Explicit non-goal:** no backoff for `meta_matchups`. Matchups are mode-only in the schema (verified in `supabase/migrations/004_meta_tables.sql:21`), and the audit's claim that counter-picks are map-sparse is factually incorrect given the schema. `CounterEntry[]` is already robust.

### Track 4 — ConfidenceBadge integration

Add the existing `ConfidenceBadge` component to the 4 components that lack it. The badge uses the same `total` → confidence thresholds (`RELIABLE_GAMES=10`, `CONFIDENT_GAMES=3`) as the rest of the repo, so no new constants are introduced.

| Component | Where |
|---|---|
| `TopBrawlersGrid` | per brawler card, next to the pick-rate line |
| `MetaIntelligence` MatchupList row | inline after the WR |
| `MetaIntelligence` bestMaps card | top-right corner overlay |
| `MetaIntelligence` bestTeammates row | inline after the WR |

`MatchupMatrix` already uses `ConfidenceBadge`. Its title is updated to explicitly state the question:

- Before: `t('matchups.title')` → "MATCHUPS"
- After: `t('matchups.titleExplicit')` → "TUS MATCHUPS — Cómo rindes TÚ contra cada oponente"

### Track 5 — Inline counters in `TopBrawlersGrid` and deletion of `CounterQuickView`

**Step 1:** `TopBrawlersGrid.tsx` receives a new prop `counters: CounterEntry[]` and builds an internal `Map<number, CounterEntry>` keyed by `brawlerId` for O(1) lookup.

**Step 2:** Each brawler card renders an expandable "counters" section below the existing info:

```
🥇  Crow
   62.4%  (142 batallas · ●)
   pick rate 18.2%  ↑2.3%
   ─────
   Counters: [Dynamike 58% ●] [Piper 56% ●] [Colt 54% ●]
```

Each counter badge shows the opponent name, the opponent's WR against this brawler (flipping the perspective), and a `ConfidenceBadge` for the `counter.total` sample.

**Tier behaviour (verified against the code, not agent summaries):** the API at `src/app/api/meta/pro-analysis/route.ts:241` already returns `counterLimit = hasPremium ? matchups.length : 3` — so free users already receive exactly 3 counters per brawler in the response, while premium users receive every available counter. `CounterQuickView` then always truncated to 3 in the render, discarding the extra data for premium users. Sprint C fixes that waste: the inline counters section in `TopBrawlersGrid` shows 3 by default for every user (same as today), and premium users get a "Ver más" expand control that reveals the full set. Free users see the same 3 they see today; premium users gain a benefit from data they were already paying for but never seeing.

**Step 3:** `CounterQuickView.tsx` is deleted. The usage in `MetaProTab.tsx` (line 80) is removed, and `TopBrawlersGrid` now receives the `data.counters` prop it needs to render the inline section.

**Step 4:** i18n keys specific to `CounterQuickView` (`metaPro.counterTitle`, `metaPro.counterHint`) are moved to a new `metaPro.topBrawlers.counters.*` namespace used by `TopBrawlersGrid`. The old keys are deleted across all 13 locale files in the same commit.

**Step 5:** `useProAnalysis` hook (the consumer of the API) is unchanged — the response shape is a superset of the old one, so existing tests still pass.

## 4. Architecture

### 4.1 Layer boundaries respected

```
┌──────────────── UI (4 existing components touched + 0 new) ──────┐
│                                                                    │
│  TopBrawlersGrid  ←─── new prop `counters` + `topBrawlersSource`   │
│  MapCard          ←─── new field `source` in MapCard props         │
│  MetaIntelligence ←─── per-row totalBattles + ConfidenceBadge      │
│  MatchupMatrix    ←─── title-only change                           │
│                                                                    │
│  CounterQuickView ←─── DELETED                                     │
│                                                                    │
└────────────┬──────────────────────────┬────────────────────────────┘
             │                          │
             ▼                          ▼
┌─────────────────────────┐   ┌────────────────────────────────────┐
│ /api/meta/pro-analysis  │   │ /api/meta (event rotation)         │
│                         │   │                                     │
│ New: topBrawlersSource  │   │ New: map.source per event           │
│ New: mode-fallback path │   │ New: mode-fallback per map          │
└─────────────────────────┘   └────────────────────────────────────┘
             │                          │
             ▼                          ▼
      Supabase (meta_stats, meta_matchups — no schema changes)
```

### 4.2 File inventory

**Create (0 new production files):**
None. This is important: the sprint is a UX remediation, not an architecture change. Everything fits in existing files. No `src/lib/analytics/fallback/` helper, no shared `SourceTierLabel` component — the cascade logic is ~10 lines inline per API route, and the badge rendering is 3-5 lines inline per component.

**Delete (1 file):**
- `src/components/analytics/CounterQuickView.tsx`
- `src/__tests__/unit/components/analytics/CounterQuickView.test.tsx` (if it exists — verified it does not)

**Modify (8 TS/TSX files + 13 JSON locale files = 21 files total):**

TypeScript / TSX:

| File | Purpose |
|---|---|
| `src/lib/draft/pro-analysis.ts` | Add `topBrawlersSource: 'map-mode' \| 'mode-fallback'` to `ProAnalysisResponse` |
| `src/app/api/meta/pro-analysis/route.ts` | Implement Tier 2 fallback for the top-brawlers aggregation |
| `src/app/api/meta/route.ts` | Implement Tier 2 fallback per map for the event rotation |
| `src/components/analytics/TopBrawlersGrid.tsx` | Add `counters` prop, per-card sample size + confidence badge, inline counters section, mode-fallback banner |
| `src/components/analytics/MetaProTab.tsx` | Remove `CounterQuickView` import + usage, pass `data.counters` to `TopBrawlersGrid` |
| `src/components/picks/MapCard.tsx` | Add mode-fallback banner, promote sample-size text |
| `src/components/brawler-detail/MetaIntelligence.tsx` | Add per-row `totalBattles` + `ConfidenceBadge` to the 3 lists |
| `src/components/analytics/MatchupMatrix.tsx` | Title-only change (one string replacement) |

Locale files: `messages/{ar,de,en,es,fr,it,ja,ko,pl,pt,ru,tr,zh}.json` — add `metaUx.emptyStates.*`, `metaUx.sampleSize.*`, `metaPro.topBrawlers.counters.*`, `matchups.titleExplicit`; remove the obsolete `metaPro.counterTitle`, `metaPro.counterHint` in the same batch.

`src/lib/brawler-detail/types.ts` is NOT modified — the `totalBattles` field already exists on `MatchupStat`, `MapStat`, `TeammateStat`.

**Create (tests — 4 files):**
- `src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx` — renders the new counters section, respects free tier limit, handles mode-fallback banner
- `src/__tests__/unit/components/brawler-detail/MetaIntelligence.test.tsx` — renders per-row sample size + badge, contextual empty states
- `src/__tests__/unit/components/picks/MapCard.test.tsx` — promoted sample size text, mode-fallback banner
- `src/__tests__/integration/api/meta/pro-analysis-cascade.test.ts` — API route returns `topBrawlersSource: 'mode-fallback'` when map is sparse, returns `'map-mode'` when map has data

No unit test for the API cascade logic standalone — it's 10 inline lines tested via the integration test above. No helper to unit-test in isolation.

**Create (i18n script):**
- `scripts/add-meta-ux-translations.js` — batch adds new keys across 13 locales and deletes the 2 obsolete keys in the same run (clean i18n state)

### 4.3 Things NOT touched (explicit non-goals)

- ❌ Schema migrations (no changes to `meta_stats`, `meta_matchups`, or any other table)
- ❌ Meta-poll cron (`src/app/api/cron/meta-poll/route.ts` and `src/lib/draft/meta-accumulator.ts`) — the pipeline that writes to `meta_matchups` is not touched
- ❌ `DraftSimulator` — the audit flagged it as lacking explanation but it's outside the UX-remediation scope
- ❌ `PersonalAnalysis` — the premium blurred teaser is out of scope
- ❌ `PicksContent` header / `/picks` page layout — only the individual `MapCard` children are touched
- ❌ Tier gating — free users see the same information they see today, just with clearer copy and sample-size indicators. No content is unlocked or locked
- ❌ `bayesianWinRate` — respected as the canonical smoothing; not modified
- ❌ Existing `ConfidenceBadge` component — not modified, only consumed by new call sites
- ❌ `MatchupMatrix` deeper refactor — only the title changes (one string)
- ❌ Test framework decisions — `@testing-library/react` + `vi.mock('next-intl')` pattern from the existing `ConfidenceBadge.test.tsx` is the template

## 5. User-visible change walkthrough

### 5.1 Free user, private profile, Meta Pro tab, Tier A map (Sidetrack)

**Before:**
```
[Top Brawlers on this map]    3,542 battles
🥇 Crow     62.4%   8.2% picks   ↑2.3%
🥈 Bull     58.1%   7.5% picks   —
🥉 Piper    56.8%   6.9% picks   ↓1.1%
...

[Counter picks]
You're trying to counter...
🎯 Crow   → [Dynamike 58%] [Piper 56%] [Colt 54%]
🎯 Bull   → [Leon 61%] [Penny 55%] [Pearl 53%]
🎯 Piper  → [Carl 63%] [Darryl 57%] [Shelly 52%]
```

**After:**
```
[Top Brawlers on this map]
Últimos 14 días · 3,542 batallas analizadas

🥇 Crow   62.4% ●     142 batallas · 8.2% picks · ↑2.3%
   Counters: [Dynamike 58% ●] [Piper 56% ●] [Colt 54% ●]

🥈 Bull   58.1% ●     98 batallas · 7.5% picks · —
   Counters: [Leon 61% ●] [Penny 55% ●] [Pearl 53% ●]

🥉 Piper  56.8% ●     156 batallas · 6.9% picks · ↓1.1%
   Counters: [Carl 63% ●] [Darryl 57% ●] [Shelly 52% ●]
```

Same information, one card instead of two, sample sizes visible, confidence badges present. One fewer scroll to connect "top brawler" to "who beats them".

### 5.2 Free user, Meta Pro tab, Tier D map (heist::Pit Stop)

**Before:**
```
[Top Brawlers on this map]    2 battles

  No hay datos para este mapa
```

**After:**
```
[Top Brawlers on this map]
Últimos 14 días · datos agregados del modo heist

⚠️ Pit Stop tiene solo 2 batallas en los últimos 14d —
mostrando top brawlers del modo heist en general.

🥇 Crow   52.1% ●     1,843 batallas · 11.2% picks · ↑1.8%
   Counters: [Dynamike 54% ●] [Piper 53% ●] [Colt 52% ●]

...
```

The user gets actionable information instead of a dead end. The banner is explicit about what data they're seeing.

### 5.3 Anonymous user, public brawler page (Piper detail)

**Before:**
```
[💪 Fuerte contra]
🎯 Bull       68.2%
🎯 Shelly     64.1%
🎯 Bibi       62.8%
🎯 El Primo   61.5%
🎯 Frank      60.2%

[⚠️ Débil contra]
Datos insuficientes
```

**After:**
```
[💪 Fuerte contra]
🎯 Bull       68.2%  ● · 342 batallas
🎯 Shelly     64.1%  ● · 298 batallas
🎯 Bibi       62.8%  ● · 189 batallas
🎯 El Primo   61.5%  ● · 156 batallas
🎯 Frank      60.2%  ● · 143 batallas

[⚠️ Débil contra]
No hay matchups registrados donde Piper tenga menos del 50%
de WR en los últimos 90 días. Esto suele ocurrir cuando
un brawler está en forma.
```

Sample sizes are visible; the empty state explains itself; and the user understands why the "weak against" list is empty (it's a compliment, not a bug).

### 5.4 Free user, picks page, Tier D map card

**Before:**
```
[Pit Stop · Heist · 2m left]
⚠️ Limited data
  No data
```

**After:**
```
[Pit Stop · Heist · 2m left]
⚠️ Mapa escaso — 2 batallas en las últimas 24h

(fallback to mode aggregate)
🥇 Crow    52.1% ●   1,843 batallas
🥈 Gene    51.8% ●   1,421 batallas
🥉 Dynamike 51.3% ●  1,356 batallas
```

Same fix as 5.2, applied to the rotation feed.

## 6. Error handling

Every component that receives mode-fallback data handles the new field optionally. If the API response is missing `topBrawlersSource` (e.g., during a deploy where API is new but client is old, or vice versa), the component defaults to `'map-mode'` (no banner rendered). This keeps the client robust to partial deploys.

The cascade logic in the API routes is wrapped in a simple check: if the Tier 1 query returns empty AFTER the PRO_MIN_BATTLES_DISPLAY filter, the Tier 2 query runs. If Tier 2 also returns empty (genuinely new rotation, no meta), the response returns `topBrawlersSource: 'map-mode'` with `topBrawlers: []`, and the component shows the contextual empty state from Track 1. No infinite loop, no cascading failures.

## 7. Testing strategy

### 7.1 Unit tests for components (~30 tests)

One test file per modified component. Template: existing `src/__tests__/unit/components/ConfidenceBadge.test.tsx` (vitest + `@testing-library/react` + inline `vi.mock('next-intl')`).

- `TopBrawlersGrid.test.tsx` (~12 tests): happy path rendering, empty state, mode-fallback banner, inline counters, free tier 3-counter limit, premium unlimited, per-card sample size, confidence badges
- `MetaIntelligence.test.tsx` (~10 tests): MatchupList with/without data, bestMaps with/without data, bestTeammates with/without data, contextual empty state strings, per-row sample size, confidence badges
- `MapCard.test.tsx` (~8 tests): limited-data banner, mode-fallback banner, promoted sample-size text, per-row confidence badges, expand/collapse

### 7.2 Integration tests for API routes (~6 tests)

- `pro-analysis-cascade.test.ts` (~4 tests):
  - Returns `topBrawlersSource: 'map-mode'` when the map has data
  - Returns `topBrawlersSource: 'mode-fallback'` when the map is empty but the mode has data
  - Returns `topBrawlersSource: 'map-mode'` with empty `topBrawlers` when both are empty (graceful degradation, Track 1 takes over)
  - Fallback path produces valid `counters` derived from the Tier 2 data

- Additional cascade test in `src/__tests__/integration/api/meta/rotation-cascade.test.ts` (~2 tests) for the event-rotation endpoint.

### 7.3 i18n regression

After the batch script runs, a quick test validates that all 13 locale files parse as valid JSON and contain every new key. A one-line script:

```js
node -e "['ar','de','en','es','fr','it','ja','ko','pl','pt','ru','tr','zh'].forEach(l => { const m = require(\`./messages/\${l}.json\`); ['metaUx','metaPro'].forEach(ns => console.assert(m[ns], \`\${l} missing \${ns}\`)) })"
```

This is run manually after the i18n task, not committed as a test.

## 8. Rollout plan

Standard BrawlVision sprint pattern (subagent-driven development, branch per task, `--no-ff` merge):

### Phase A — Scaffolding (1 task)
- Task 1: Add `topBrawlersSource` field to `ProAnalysisResponse` + corresponding field to the event-rotation API response type. No behavioural change yet.

### Phase B — API cascade (2 tasks)
- Task 2: Implement mode-fallback in `/api/meta/pro-analysis/route.ts` with integration test
- Task 3: Implement per-map mode-fallback in `/api/meta/route.ts` with integration test

### Phase C — TopBrawlersGrid rewrite (3 tasks)
- Task 4: Add per-card sample size + ConfidenceBadge (no inline counters yet)
- Task 5: Add mode-fallback banner
- Task 6: Add inline counters section

### Phase D — MetaProTab cleanup (2 tasks)
- Task 7: Pass `counters` prop through to `TopBrawlersGrid`
- Task 8: Delete `CounterQuickView.tsx` + remove usage + clean up i18n keys

### Phase E — MetaIntelligence (2 tasks)
- Task 9: Add per-row `totalBattles` + `ConfidenceBadge` to the 3 lists
- Task 10: Contextual empty states for the 3 sections

### Phase F — MapCard (1 task)
- Task 11: Promoted sample-size text, mode-fallback banner, contextual empty state

### Phase G — MatchupMatrix title (1 task)
- Task 12: Title string update, i18n key migration

### Phase H — i18n batch (1 task)
- Task 13: `scripts/add-meta-ux-translations.js` executes; all 13 locale files updated in one commit

### Phase I — Smoke test + documentation (2 tasks)
- Task 14: Execute the smoke checklist (§8.1 below) against a local dev server
- Task 15: Update `CLAUDE.md` and relevant memory entries with sprint learnings

**Total: 15 tasks.** Each task targets a single component or API route, respects existing layer boundaries, and lands with its own unit/integration tests. Branches: `sprint-c/task-01-*` through `sprint-c/task-15-*`.

### 8.1 Smoke test checklist

After all 15 tasks are merged, a manual smoke test validates:

- [ ] Open Meta Pro tab on Tier A map (Sidetrack) → TopBrawlersGrid shows inline counters, sample sizes, confidence badges
- [ ] Open Meta Pro tab on Tier D map (any map with `<30` total battles) → mode-fallback banner appears, data populated
- [ ] Open public brawler detail page (Piper) → per-row sample sizes + badges in all 3 lists
- [ ] Open public brawler detail page (a rare brawler like Mr. P) → contextual empty states for missing sections
- [ ] Open `/picks` page → MapCards show promoted sample sizes, mode-fallback on sparse maps
- [ ] Switch language (es/en/fr/ko/ja) → all new copy renders correctly in each locale
- [ ] Free user → sees inline counters capped at 3 per brawler
- [ ] Premium user → sees all available counters per brawler
- [ ] `CounterQuickView` is genuinely gone (no stale references, no console errors)
- [ ] `npx tsc --noEmit` → clean
- [ ] `npx vitest run` → 486 + new tests all pass

## 9. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Users notice `CounterQuickView` is gone and miss it | Low | Low | Inline counters in TopBrawlersGrid give them the same info with more context. If feedback comes in, re-add `CounterQuickView` as a separate sprint with a clearer question: "what counters X specifically" as a detail drill-down |
| 2 | Mode-fallback banner is misinterpreted as an error | Low | Medium | Copy is explicit: "mostrando datos agregados del modo" — reviewed by user before i18n batch |
| 3 | `bayesianWinRate` smoothing produces unexpected numbers after the cascade (fewer samples per bucket in the Tier 1 query) | Low | Low | `bayesianWinRate` is not touched — any smoothing behaviour is pre-existing |
| 4 | i18n batch misses a key or adds to the wrong namespace | Medium | Low | Regression test in §7.3 catches missing keys at the top-namespace level; for nested keys, the TypeScript check catches them because the components use typed translation calls |
| 5 | The API cascade produces wrong numbers if the mode has <30 total battles (cascade useless in that edge case) | Very Low | Low | Graceful: cascade's Tier 2 empty → component shows Tier 1 empty contextual state. No infinite loop |
| 6 | Adding `counters` prop to `TopBrawlersGrid` couples two previously-independent concerns | Medium | Low | Acceptable coupling: the two sections already render data that is logically connected; splitting them into two components was the accidental choice, not the intentional one |
| 7 | Changing 14 components at once creates review burden | Low | Medium | Sprint broken into 15 small tasks, each reviewed independently |
| 8 | Free users don't see sample sizes today; adding them reveals that numbers are less reliable than they looked | Low | Positive impact | This is the goal. Honesty > false confidence |

## 10. Definition of done

A Sprint C PR is ready to merge when:

1. All 15 tasks are complete, each with its own green test suite
2. `npx tsc --noEmit` is clean
3. Full test run is green (existing 486 + ~36 new tests)
4. Smoke test checklist (§8.1) passes end-to-end on a local dev server
5. No new warnings in `npm run lint`
6. `MEMORY.md` has been updated with at least 1 new learning entry per phase (lessons learned during execution, not just the pre-brainstorm learnings from this morning)
7. The spec file (this document) has a `Status: Implemented` changelog entry
8. A new `docs/superpowers/specs/SMOKE-TEST-SPRINT-C.md` file exists with the checklist from §8.1, so future deploys that touch any of these 10 files can re-run the exact same validation

## 11. Future work (v2+, explicitly out of scope)

- **Meta-poll cron enhancement** to write `meta_matchups` with map context. This would enable a real map-level counter-pick query. Requires changes to `meta-accumulator.ts` + a new schema column + a multi-week wait for data to accumulate. Separate sprint.
- **DraftSimulator recommendation reasoning** — explain WHY the draft engine suggests a pick (counter, synergy, meta WR). Requires deeper work in `src/lib/draft/scoring.ts`.
- **PersonalAnalysis free-tier teaser overhaul** — outside UX-remediation scope.
- **MatchupMatrix map dimension** — showing per-map breakdown of each matchup. Requires either a new query or client-side computation from battles table. Valuable but bigger.
- **Deeper `MetaIntelligence` rewrite** — e.g., per-mode breakdown of a brawler's matchups. Not fixing a visible bug, just adding info.
- **`ConfidenceBadge` prominence rework** — the 2×2px dot is subtle; a bigger visual treatment could be considered but is orthogonal to Sprint C's scope.
- **Expanding `RELIABLE_GAMES` / `CONFIDENT_GAMES` thresholds** — currently 10/3, quite low; could be made more aggressive. Out of scope — tuning decision, not remediation.

## 12. Approval

This spec reflects:
1. The user-stated goal of "no repetitions, no nulls, valuable/new/distinct information"
2. The verified code reality as of 2026-04-13
3. The 4 memory-saved learnings from today about audit-before-design, copy-as-feature, schema-verification, and agent-inventory-not-claims
4. Zero schema changes, zero cron changes, zero new abstractions
5. Exactly 15 tasks of bounded scope that can be executed subagent-driven

Pending: final user review of this spec before invoking `superpowers:writing-plans`.
