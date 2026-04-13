# Sprint D — Implemented Changelog (2026-04-13)

> Reference doc summarizing every change shipped in the Sprint D session.
> Sprint D was executed **inline** (not subagent-driven, by user request to
> save tokens). Each section links to the canonical helpers / tests so a
> future session can locate them quickly.

**Branch:** `main` (committed and pushed throughout the day, no feature branch)

**Final state:** `625 tests passing (was 514 at start of Sprint C)`, `tsc clean`, `e2e/*.spec.ts compiles`, `13 locales synchronized`

---

## Phase A — Sprint C residue + planning sub-sprint

Quick fixes that shipped before Sprint D's main work began:

- **`fix(playnow)`**: `aggregateByBrawler` in `src/lib/analytics/recommendations.ts` collapses duplicate brawlers from the mode-aggregate fallback path so Najia no longer appears twice on Crab Claws Knockout. Added `source: 'map-specific' | 'mode-aggregate'` discriminator on `PlayNowRecommendation` so the UI can show a "Modo" badge when the player has no map-specific data.

- **`fix(brawl-img)`**: `BrawlImg` was storing `currentSrc` in `useState(src)` (only read at mount). Reused instances across brawlers (e.g. `BrawlerTierList` detail panel) never updated the image. Refactored to derive `currentSrc` from props + state and reset failure flags via the React-recommended "reset state during render" pattern with `prevSrc` comparison.

- **`refactor(tier-list)`**: `BrawlerTierList` rebuilt as a horizontal S/A/B/C/D tier grouping with click-to-select detail panel. Replaced the vertical list that wasted space.

- **`feat(meta-pro)`**: `topBrawlerTeammates` field added to `ProAnalysisResponse`. Each top brawler in `TopBrawlersGrid` now shows the most-repeated PRO teammate pair under its card with a "Ver más (N)" expand toggle. Removes the standalone `ProTrioGrid` section. Trio data derived from the same `meta_trios` aggregate, no extra DB query. `proTrios` field retained on the response because `TeamSynergyView` (private analytics) uses it as a lookup map.

- **`fix(playnow)`**: `bestTrio` in PlayNow recommendations now filters `trioSynergy` by `trio.map === slot.event.map` instead of `=== null` (global). A trio that works on map Y won't necessarily work on map Z; misleading recommendations removed.

---

## Phase B — Compare bug + battlelog audit

User reported "Cambio de Trofeos (reciente)" missing in localhost on `/profile/:tag/compare`.

**Root cause:** `src/lib/api.ts:3` falls back to a hardcoded Oracle VPS IP (`http://141.253.197.60:3001/v1`) when `BRAWLSTARS_API_URL` is not set. The VPS is firewalled to Vercel IPs only, so dev machines silently time out and `useBattlelog` returns `null` data → `CompareTrophyChart` is gated on `p1Battles?.battles && p2Battles?.battles` → silent disappearance.

**Audit findings — 5 features depend on `/api/battlelog`, 4 fail silently:**

| Feature | Failure mode |
|---|---|
| `/profile/:tag/compare` CompareTrophyChart | 🔇 silent (the original bug) |
| `/profile/:tag/battles` page | 🔊 visible error card |
| `/profile/:tag/subscribe` segment detection | 🔇 silent (generic upsell copy) |
| `/brawler/:id` PersonalAnalysis calendar | 🔇 silent (empty grid) |
| Club trophy chart (`useClubTrophyChanges`) | 🔇 silent (empty chart) |

**Fixes:**

- `.env.example` adds `BRAWLSTARS_API_URL` with a long comment listing the 5 features that break without it.
- `src/lib/api.ts` warns on dev-server boot if `BRAWLSTARS_API_URL` is missing, naming the affected features.
- `e2e/compare.spec.ts` smoke test with **positive assertion**: `getByText(/Cambio de Trofeos/).toBeVisible()`. Console-error smokes do NOT catch silent component absence; positive assertions do. This is the regression lock.

---

## Phase C — `parseSupercellTime` ("NaNm" badge fix)

User reported `NaNm` appearing in the time-left badge of "Juega Ahora" map cards.

**Root cause:** Supercell `/events/rotation` returns times in compact format `"20260413T120000.000Z"` (no dashes/colons). JavaScript's `new Date()` constructor cannot parse this format → `Invalid Date` → `getTime() = NaN`. The early-return guard `if (diff <= 0) return endedLabel` never fires because `NaN <= 0` is `false` (every comparison with NaN is false).

**Fix:** `parseSupercellTime` helper in `src/lib/battle-parser.ts`:

- Detects the compact regex `^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.(\d{3}))?Z$`, converts to ISO 8601 before `new Date()`.
- Falls back to Date's own parser for already-ISO strings.
- Returns `Date | null` so callers can hide the UI element instead of rendering garbage.

Both `computeTimeLeft` (PlayNowDashboard, MapCard) refactored to return `string | null`. Renders gate the badge on `{timeLeft && <span>}`.

8 unit tests + 2 component regression tests in `PlayNowDashboard.test.tsx`.

---

## Phase D — Adaptive meta-poll cron

User requested: niche game modes get only ~30 battles per map while flagship modes get ~200, because the top 200 pro players concentrate on flagship modes. Asked to "extend deeper into the rankings until each mode hits a target".

**Implementation:** `src/lib/draft/meta-poll-balance.ts` pure helpers + adaptive top-up loop in `src/app/api/cron/meta-poll/route.ts`.

**Algorithm:**
1. Fetch top `META_POLL_MAX_DEPTH = 600` players in one call
2. Process base batch of `META_POLL_BATCH_SIZE = 200` — accept all draft modes
3. Compute `target = max(50, bestMode × 0.6)` via `computeModeTarget`
4. While any mode is under target AND offset < cap: fetch next chunk of `META_POLL_CHUNK_SIZE = 100` players, only keep battles from under-target modes (saturated modes' battles are discarded but cursors still advance to avoid re-examination)
5. Bulk upsert as before

**Constraints:** balanced day → ~60s (1 iteration), worst case → ~180s (5 iterations × 100 players + base 200 = 600). Stays inside the 300s `maxDuration` Vercel cap.

**Response diagnostics:** new `adaptive` block with `iterationsRun`, `playersPolled`, `finalCountsByMode` for observability.

10 unit tests for the pure helpers + 6 integration tests using shrunken constants (`BATCH=10, CHUNK=5, MAX_DEPTH=30, MIN_TARGET=5`) so the test suite runs in <1 second.

**Rejected alternative:** Vercel Workflow migration. The cron is deliberately bounded to ~180s; Workflow is for hours/days of polling. Logged the rejection rationale in CLAUDE.md "Important Decisions".

---

## Phase E — Game mode icon audit

User reported wrong/inconsistent mode icons on the battles page and asked to use the same icons as Draft everywhere.

**Source of truth:** `src/components/ui/ModeIcon.tsx` (already existed) + `getGameModeImageUrl` in `src/lib/utils.ts` (uses Brawlify CDN).

**Sites fixed:**

- `battles/page.tsx`: deleted local `MODE_ICONS` emoji table. "Modo Favorito" card now uses `<ModeIcon size={36}>` + `MODE_DISPLAY_NAMES[mode]` localized. `winRateByMode` and battle list rows use `<ModeIcon>` instead of emojis.
- `components/club/ClubTrophyChart.tsx`: deleted second local `MODE_ICONS` table. SVG `foreignObject` tooltip renders `<img src={getGameModeImageUrl(mode)}>` inline.
- `components/battles/TrophyChart.tsx`: tooltip renders the mode icon and localized name.

**Sites already correct (not touched):** MapCard, ModePerformanceChart, PlayNowDashboard, MapSelector.

---

## Phase F — Stats page completion charts

User reported that the Gem Score donut on `/profile/:tag/stats` always fills to ~50% and the category bars are nonsensical.

**Root cause:** the donut showed `powerLevels.gems / totalGems` (a composition ratio, always ~50% for any normal player). The category bars showed each category as a fraction of the player's own total — collectively summing to 100% but conveying no progress.

**Fix:** all bars normalize to **game-wide max** (not personal total).

- New `/api/brawlers` route + `fetchBrawlers()` helper: fetches the Supercell `/brawlers` registry once per 24h server-side. Returns `{ brawlerCount, maxGadgets, maxStarPowers }` derived from the full roster.
- New `useBrawlerRegistry()` hook with localStorage cache (24h) and **always-returns-a-value** fallback (101 brawlers / 202 gadgets / 202 SPs).
- New `src/lib/stats-maxes.ts` pure helpers: `computeMaxGems`, `computeMaxCounts`, `completionPct`, `safeNumber`.
- New constants: `PER_BRAWLER_MAX = { gears: 6, hypercharges: 1 }`, `CURRENT_MAX_BUFFIES = 36`, `TROPHY_ROAD_MAX = 100_000`.

**UI changes:**
- Gem Score donut now shows `totalGems / maxGems.total` as a real completion %, big "X%" label centered, ratio `X / Y 💎` underneath.
- Category bars rellena hacia su propio max (`gadgets / maxGadgets`, etc.) with `X%` labels.
- Trophy road bar normalized to `TROPHY_ROAD_MAX` (100k), not `highestTrophies`.
- Details grid shows `X / Y` for every upgrade category.

**NaN safety (post-fix):** the user reported NaN appearing in multiple calculations after the chart refactor. Root cause: `completionPct` did not guard against `NaN`/`undefined` numerators (cached `GemScore` payloads from older versions of the type may be missing fields). Fixed by:
- Hardening `completionPct` with `Number.isFinite` checks on both inputs and the computed `raw` value.
- Adding `safeNumber(value)` helper that maps `undefined`/`null`/`NaN`/`Infinity` to `0`.
- Wrapping every numeric pulled from `data.breakdown.*` and `data.stats.*` in `safeNumber()` so cached payloads degrade gracefully.

19 unit tests for the helpers + the NaN regression suite.

---

## Phase G — Club page redesign

User asked to remove the "worst player" (3rd) and "trophy spread" (4th) cards and replace them with cards showing the best player of the club for the most-played game modes.

**Implementation:** `src/lib/club-mode-leaders.ts` derives per-mode leaders from `useClubTrophyChanges`'s already-cached `battlePoints[]` — **zero extra network calls**. Picks the top 6 most-played draft modes across the club's last ~25 battles per member, picks the leader of each by raw wins (tiebreak win rate).

**Other club-page fixes in the same commit:**
- Real club badge: header now renders `<img src={getClubBadgeUrl(club.badgeId)}>` with onError fallback to a shield emoji, instead of the placeholder `<Shield>` lucide icon.
- New i18n key `club.modeLeadersTitle` × 13 locales.

9 unit tests covering: empty data, unloaded members, tiebreak by WR, sort by volume, topN cap, non-draft mode exclusion, zero-wins fallback, realistic multi-member scenario.

---

## Phase H — Test infrastructure (P1 + P2)

User asked: "why don't tests catch these kinds of bugs?". Findings: unit-test-rich, integration-poor.

**Strict next-intl mock (`P1.1`):** `src/__tests__/helpers/mock-next-intl.ts` throws `MockIntlFormattingError` when any `{param}` is referenced but missing — mirrors next-intl runtime. **Verified against the real `teammatesSeeMore` aria-label bug** (reverted the fix → tests failed with the exact production error message). Pilot-migrated 3 component test files; rest can migrate opportunistically.

**Auth contract tests (`P1.2`):** 11 new tests across `src/__tests__/integration/api/battles-auth-contract.test.ts` (6) and `analytics-auth-contract.test.ts` (5). Each covers anonymous / cookie session valid / cookie session valid but no data. Locks in the cookie-vs-Bearer auth contract that the pro-analysis bug exposed.

**Playwright smoke tests (`P2.1`):** `e2e/picks.spec.ts` and `e2e/meta-pro.spec.ts` — zero-`console.error` flow tests with allowlists for known-noisy CDN 404s. Plus `e2e/compare.spec.ts` (Phase B) with positive assertion for silent-absence bugs.

---

## Phase I — Pro-analysis cookie auth fix

User reported: gap analysis on Meta PRO always shows "Juega partidas en este mapa..." even when they have battles.

**Root cause:** `useProAnalysis` hook fetches with `credentials: 'include'` (cookies only). The route only read auth from `Authorization: Bearer` header. Two ships in the night → `playerTag` was always null → premium fields stayed null → empty state shown.

**Fix:** route now uses `createClient()` from `@/lib/supabase/server` for cookie-based auth, keeps the service-role client for data queries that bypass RLS.

3 new auth contract tests in `pro-analysis-cascade.test.ts` lock in the contract. `next/headers` cookies mock added to the test setup.

---

## Files created in Sprint D

### Source

| File | Purpose |
|---|---|
| `src/lib/battle-parser.ts` (`parseSupercellTime`) | Robust event-time parser with null fallback |
| `src/lib/draft/meta-poll-balance.ts` | Pure helpers for the adaptive meta-poll algorithm |
| `src/lib/stats-maxes.ts` | `computeMaxGems`/`computeMaxCounts`/`completionPct`/`safeNumber` |
| `src/lib/club-mode-leaders.ts` | Derive per-mode club leaderboard from in-memory battlepoints |
| `src/hooks/useBrawlerRegistry.ts` | Game-wide registry with 24h cache + fallback |
| `src/app/api/brawlers/route.ts` | Supabase-bypassing pass-through to Supercell `/brawlers` |
| `src/components/ui/ModeIcon.tsx` | Already existed; now the canonical mode-icon entry point |

### Tests

| File | Tests |
|---|---|
| `src/__tests__/unit/lib/meta-poll-balance.test.ts` | 10 |
| `src/__tests__/unit/lib/stats-maxes.test.ts` | 19 (10 happy + 9 NaN safety) |
| `src/__tests__/unit/lib/club-mode-leaders.test.ts` | 9 |
| `src/__tests__/unit/lib/battle-parser.test.ts` (added `parseSupercellTime` block) | +8 |
| `src/__tests__/unit/components/analytics/PlayNowDashboard.test.tsx` (added "NaNm regression") | +2 |
| `src/__tests__/integration/api/meta-poll-adaptive.test.ts` | 6 |
| `src/__tests__/integration/api/battles-auth-contract.test.ts` | 6 |
| `src/__tests__/integration/api/analytics-auth-contract.test.ts` | 5 |
| `src/__tests__/integration/api/meta/pro-analysis-cascade.test.ts` (added 3 cookie auth tests) | +3 |
| `src/__tests__/helpers/mock-next-intl.ts` + `mock-next-intl.test.ts` | 9 |
| `e2e/picks.spec.ts` | 2 |
| `e2e/meta-pro.spec.ts` | 2 |
| `e2e/compare.spec.ts` | 2 |

### Scripts

| File | Purpose |
|---|---|
| `scripts/add-sprint-d-translations.js` | PlayNow + Meta PRO clarity labels |
| `scripts/add-sprint-d-tier-list-translations.js` | BrawlerTierList tier grouping keys |
| `scripts/add-sprint-d-teammates-translations.js` | Teammate inline UX keys |
| `scripts/add-club-mode-leaders-translations.js` | `club.modeLeadersTitle` × 13 locales |

---

## Constants that need manual upkeep

These can't be derived from the API and must be bumped by a developer when Supercell ships new content:

- `CURRENT_MAX_BUFFIES = 36` in `src/lib/constants.ts` — currently 12 brawlers × 3 slots. Excludes the Blin-bought 4th slot (data model doesn't track it yet).
- `PER_BRAWLER_MAX = { gears: 6, hypercharges: 1 }` — per-brawler ceilings for items NOT returned by `/brawlers`.
- `TROPHY_ROAD_MAX = 100_000` — current season cap.
- `useBrawlerRegistry` fallback constants (101 / 202 / 202) — only used if the API is unreachable.

---

## Open work / future improvements

Not blockers, but worth tracking:

- **Blin buffies (4th slot)**: not modeled in `BrawlerStat.buffies` yet. When the data pipeline supports it, bump `CURRENT_MAX_BUFFIES` and extend `countBuffies` in `src/lib/calculate.ts`.
- **`MapSelector` inline event-time parser**: still has its own regex-replace inline. Could migrate to `parseSupercellTime` for consistency. Not urgent — it works.
- **`MODE_DISPLAY_NAMES`** missing some modes (payload, paintBrawl, volleyBrawl, etc.). Add as the game expands.
- **Component test migration**: only 3 component tests use the strict `mockNextIntl` helper. The rest can migrate when they're next touched.
