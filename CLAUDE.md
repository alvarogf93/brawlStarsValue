@AGENTS.md

# BrawlVision -- Project Guide

## What is this?
Brawl Stars combat analytics platform. 13 locales, premium subscriptions via PayPal, Supabase backend.

## Tech Stack
- Next.js 16 (App Router, `cacheComponents` era — read `AGENTS.md` first)
- TypeScript (strict mode)
- Tailwind CSS v4
- Supabase (auth, database, RLS)
- PayPal (subscriptions)
- next-intl (13 locales, default: es)
- Vitest + @testing-library/react + Playwright (E2E)
- Vercel (deployment)

## Commands
- `npm run dev` — local dev server (compiles pages on demand)
- `npx vitest run` — full unit/integration suite (~90s, 587 tests)
- `npx vitest run path/to/file.test.ts` — single file
- `npx tsc --noEmit` — strict typecheck (no build artifacts)
- `npx playwright test --list` — list E2E tests without running
- `npx playwright test e2e/<file>.spec.ts` — run a single spec (needs `npm run dev` up)
- `node scripts/git-push.js` — push current branch to origin
- i18n batch scripts live in `scripts/add-*.js` — one-off CommonJS scripts that idempotently write keys across all 13 `messages/*.json`

## Dev environment gotchas
- **`BRAWLSTARS_API_URL` is REQUIRED in `.env.local`** — without it, `src/lib/api.ts` falls back to a VPS IP unreachable from dev machines. Features that silently break: `/profile/:tag/compare` trophy chart, `/profile/:tag/subscribe` segment detection, `/brawler/:id` activity calendar, club trophy chart. See `.env.example` for the full list. The dev server logs a warning on boot when the var is missing.
- **Stale `.next/dev/types/validator.ts`** — Next 16's dev type generator occasionally emits a corrupted file that blocks `tsc --noEmit` with syntax errors in generated code. Fix: `node -e "require('fs').unlinkSync('.next/dev/types/validator.ts')"` and re-run typecheck.
- **NEVER create `src/middleware.ts`** — Next 16 renamed the middleware file convention to `src/proxy.ts`. Having both throws a hard build error: *"Both middleware file and proxy file are detected. Please use './src/proxy.ts' only."* `proxy.ts` already handles next-intl locale negotiation **and** Supabase session refresh; adding a middleware file would also silently bypass the auth refresh logic. If you find yourself reaching for `middleware.ts`, edit `src/proxy.ts` instead.
- **Line endings**: repo is Windows — git warns about LF→CRLF conversion on new files. Ignore.

## Key Architecture
- `/src/app/[locale]/profile/[tag]/` — private profile pages (DashboardLayoutClient)
- `/src/app/[locale]/brawler/[brawlerId]/` — public brawler pages (no layout)
- `/src/app/[locale]/picks/` — public anonymous map picks page (server component + private `fetchMetaEvents` that queries Supabase directly; **NOT** via `/api/meta`)
- `/src/app/api/` — 23 API routes
- `/src/proxy.ts` — request interceptor (next-intl middleware + Supabase session refresh). Renamed from `middleware.ts` per Next 16 migration. See "Dev environment gotchas" for the don't-add-middleware-ts rule.
- `/src/lib/analytics/compute.ts` — heavy computation (800+ lines, pure functions)
- `/src/lib/draft/` — draft simulator, meta aggregation, adaptive cron helpers
- `/src/hooks/` — 11 data-fetching hooks with localStorage cache
- `/src/__tests__/helpers/` — shared test helpers (e.g. strict `next-intl` mock)

## API route auth pattern (IMPORTANT)
- **All user-authenticated routes use cookie-based auth** via `createClient` from `@/lib/supabase/server`. Never `Authorization: Bearer` tokens — the client hooks all fetch with `credentials: 'include'`, not headers.
- Data queries that need to bypass RLS use `createServiceClient()` from the same helper.
- `/api/meta/pro-analysis` is the canonical pattern: `createCookieAuthClient()` for auth, service-role client for data.
- `/api/cron/*` routes are protected with `Authorization: Bearer ${process.env.CRON_SECRET}` — NOT a user session.

## Testing conventions
- **Component tests**: use `mockNextIntl` from `src/__tests__/helpers/mock-next-intl.ts`. It **throws** when a `{param}` is referenced but not supplied — mirrors next-intl production behaviour and catches `FORMATTING_ERROR` bugs at test time. Pilot-migrated: `TopBrawlersGrid`, `PlayNowDashboard`, `BrawlerTierList`. Remaining test files can migrate opportunistically.
- **API route integration tests**: use the `fromMock` + `queueByTable` pattern (see `src/__tests__/integration/api/battles-auth-contract.test.ts` or `meta-poll-adaptive.test.ts`). Queue one response per Supabase call; the mock throws loudly if the route issues more calls than queued.
- **Auth contract tests**: every user-facing API route gets a `-auth-contract.test.ts` covering anonymous → 401/empty, cookie session + data → 200, cookie session + no data → empty (not 401). Locks in the cookie-vs-Bearer contract.
- **E2E smoke tests**: `e2e/*.spec.ts`. Two styles: "zero console.error during flow" catches runtime throws; **positive assertion** tests (e.g. `e2e/compare.spec.ts` asserting the trophy chart is visible) catch silent component absence — the `console.error` style will NOT catch silent-hide bugs.
- **Numeric regex in tests**: always `\b`-anchor — `/\b8 batallas\b/` not `/8 batallas/` (avoids substring collisions with 98, 108, etc.).

## i18n
- 13 locales: ar, de, en, es, fr, it, ja, ko, pl, pt, ru, tr, zh. Default: es.
- Adding keys: write a `scripts/add-<feature>-translations.js` with the full dictionary per locale, run with `node`, commit. Idempotent — re-runnable.
- Keys with `{param}` interpolation: every `t('key', { param })` callsite MUST pass the param. Including `aria-label`s. The strict mock will fail the test otherwise.

## Design System
- Font: Lilita_One (headings), Inter (body)
- Cards: `.brawl-card` (white dots), `.brawl-card-dark` (dark)
- Buttons: `.brawl-button` (gold, 3D shadow)
- Chips: `DottedChip` component (colored bg with dot pattern)
- Text: `.text-stroke-brawl` (white text, dark border)
- Colors: `#FFC91B` (gold), `#4EC0FA` (blue), `wrColor()` util for WR-based coloring

## Game-mode rendering (STRICT)
- **Always use `<ModeIcon mode={m} size={N} />`** from `src/components/ui/ModeIcon.tsx`. It resolves to the Brawlify CDN asset via `getGameModeImageUrl` and falls back to an emoji when the CDN is down.
- **Never** reinvent a local `MODE_ICONS` emoji table — two existed (battles + club) and were deleted in Sprint D.
- **Display names** come from `MODE_DISPLAY_NAMES` in `src/lib/constants.ts`. The raw API string (`"brawlBall"`, `"gemGrab"`) is NOT user-facing copy — always localize via this map.
- **Inside SVG `foreignObject` tooltips** (TrophyChart, ClubTrophyChart) you can't use React components easily; use `getGameModeImageUrl(mode)` + `<img>` inline. Same CDN asset, no component overhead.

## Event-time parsing
- Supercell `/events/rotation` returns times in compact format `"20260413T120000.000Z"` (no dashes/colons). **`new Date()` cannot parse this** — it returns `Invalid Date` → `NaN` → `"NaNm"` in the UI.
- Use `parseSupercellTime(raw)` from `src/lib/battle-parser.ts` for every event-time parse. It returns `Date | null` — the `null` lets callers hide the element instead of rendering garbage.
- Countdown helpers (`computeTimeLeft` in `PlayNowDashboard`, `MapCard`) return `string | null` and the render uses `{timeLeft && <badge>}` to hide when unknown.

## Stats completion denominators
- All progress bars on `/profile/:tag/stats` rellena contra un **máximo real del juego**, never against the player's own total (that's a meaningless ratio).
- Pure helpers in `src/lib/stats-maxes.ts`: `computeMaxGems(registry)`, `computeMaxCounts(registry)`, `completionPct(num, den)`. 10 unit tests.
- **Game-wide registry** is fetched from `/api/brawlers` (our route → Supercell `/brawlers`, 24h server cache). Consumed via `useBrawlerRegistry()` hook which always returns a value (localStorage cache → in-flight fetch → hardcoded fallback 101 brawlers / 202 gadgets / 202 SPs). Consumers never deal with a null.
- **Constants that need manual updates** as Supercell releases new content:
  - `CURRENT_MAX_BUFFIES = 36` in `constants.ts` — tracked game-wide buffies (12 brawlers × 3 slots). The 4th slot bought with Blins is NOT tracked in `BrawlerStat.buffies` yet; excluded from the max until the model extends.
  - `PER_BRAWLER_MAX = { gears: 6, hypercharges: 1 }` — per-brawler ceilings for items NOT returned by `/brawlers`.
  - `TROPHY_ROAD_MAX = 100_000` — current season cap, the denominator for the trophy road bar (not `highestTrophies`, which is a moving personal target).

## Derivation-from-memory pattern (no extra fetches)
When a new UI widget needs aggregates that the existing hooks already fetched, **derive in-memory** instead of adding queries. Example: `src/lib/club-mode-leaders.ts` computes the per-mode club leaderboard from `useClubTrophyChanges`' already-cached `battlePoints[]`, zero extra network. Pure function → easy to unit-test (9 tests cover tiebreaks, fallbacks, sorting, non-draft exclusion).

## Data Pipeline
- Supercell API → `battle-parser` → `battles` table (premium users only, via `/api/cron/sync`)
- Cron sync → `processBattleForMeta` → `meta_stats` / `meta_matchups` (aggregated, source='user')
- `/api/cron/meta-poll` → **adaptive** top-up polling of top pro players → `meta_stats` / `meta_matchups` / `meta_trios` (source='global')
  - Base batch: 200 players. Hard cap: 600. Top-up chunks of 100 when any draft mode is below `max(50, bestMode × 0.6)`. Only keeps battles from under-sampled modes in top-up iterations.
  - Runtime: ~60s balanced day, up to ~180s on top-up days. Well inside the 300s Vercel Function cap.
  - Pure helper: `src/lib/draft/meta-poll-balance.ts` (`computeModeTarget`, `findUnderTargetModes`).
  - Response includes an `adaptive` diagnostic block (iterations, players polled, per-mode counts) for observability.

## Premium Model
- Free: last 25 battles from Supercell API, basic stats
- Trial: 3 days PRO on sign-up (auto-activated via `trial_ends_at`)
- Premium: unlimited battle history, advanced analytics, Meta PRO section
- `isPremium(profile)` from `src/lib/premium.ts` checks BOTH `tier !== 'free' && ls_subscription_status in (active, cancelled)` AND `trial_ends_at > now`.

## Important Decisions (and their *why*)
- **`event_id` NOT used as aggregation key** — 108 multi-ID collisions in BrawlAPI make it unreliable. `map + mode` string pair is the canonical key for `meta_stats`.
- **`map + mode` as composite key is imperfect but works** — maps sometimes appear in multiple modes; we accept the rare collision rather than the event_id chaos.
- **`useMapImages` hook resolves by name**, not id — same reason.
- **`last_sync` is the cursor for meta aggregation dedup** — `processBattleForMeta` only consumes new battles since the cursor. Running the cron twice doesn't duplicate data.
- **Cron stays on Vercel Functions, not Workflow** — the meta-poll is deliberately bounded by `META_POLL_MAX_DEPTH = 600` to fit within `maxDuration = 300`. Not polling, bounded batch; Workflow would be over-engineering.
- **Duplicate cascade logic between `/api/meta` and `src/app/[locale]/picks/page.tsx`** — the public picks page queries Supabase directly via `fetchMetaEvents`, bypassing the API route, for SSR performance. A ~30 line duplication is YAGNI-acceptable for a single cross-file reuse; do NOT extract into a shared helper. Both paths must be updated when changing cascade logic.
- **`proTrios` kept in `ProAnalysisResponse` even after removing `ProTrioGrid`** — the private analytics page's `TeamSynergyView` uses it as a lookup to annotate user's own trios with pro comparison badges. `topBrawlerTeammates` is a derived different field for the public Meta PRO tab.
- **Completion charts normalize to game-wide max, not player total** — the old "gem score donut" showed `powerLevels.gems / totalGems` which is always ~50% for any player and means nothing. Progress bars must rellena toward a real in-game ceiling: `computeMaxGems` for gem-weighted, `TROPHY_ROAD_MAX=100000` for trophies, `computeMaxCounts` for raw unlocks. Never against personal best (moving target) or own total (self-referential).
- **Club leader cards are derivation-only** — `computeClubModeLeaders` pulls from the in-memory battlepoints that `useClubTrophyChanges` already has. Adding a widget that needs club-battle aggregates? Derive from the hook's data, do NOT add per-member fetches.
- **Real club badge, not placeholder** — the header uses `getClubBadgeUrl(club.badgeId)` with an `onError` fallback to a shield emoji. Placeholder lucide icons for content that has a real asset are banned.
- **Ads go through `SafeAdSlot`, not `AdPlaceholder` directly** — `SafeAdSlot` (`src/components/ui/SafeAdSlot.tsx`) forces every callsite to pass a required `hasContent: boolean` prop; it returns `null` when false. This defends against AdSense's "Valuable Inventory: No Content" infraction — Google banned our account once because ads were rendering during skeleton/error/empty-state screens. Public pages with ads today: `/brawler`, `/brawler/[id]`, `/picks`, `/battle-history`, `/leaderboard`. Landing (`/[locale]`) and all edit/form screens (subscribe, cosmetics calculator) intentionally have no ads. Who sees ads: anonymous + registered-free. Trial and premium are gated via `isPremium(profile)`. Never pass a literal `true` to `hasContent` — that defeats the defensive design.
- **`alternateLinks: false` in `src/i18n/routing.ts`** — disables the HTTP `Link: ...; hreflang="x-default"` header that next-intl emits by default. Without this, the header's `x-default` points to the bare URL (`https://brawlvision.com/`) while the HTML `<link rel="alternate">` and sitemap point to `/es`, producing a canonicalization conflict that Google Search Console flagged. The HTML metadata is the single source of truth for hreflang — do not re-enable `alternateLinks` without also reconciling `sitemap.ts` and every `[locale]/**/layout.tsx` to match.
- **Multi-size icons use `generateImageMetadata`, never an exported `sizes` array** — Next 16's `icon.tsx` file convention only honors `generateImageMetadata` for multiple sizes. An older pattern (exporting `sizes = [...]` and reading `params.size`) looked like it worked but produced 404s for every non-48px request; the manifest's `/icon?size=192` never resolved. See `src/app/icon.tsx` for the canonical setup: `generateImageMetadata` returns `{id, size, contentType}` entries and the default export consumes `{id}` to pick dimensions. Next auto-routes to `/icon/<id>` and auto-injects the `<link rel="icon" sizes="...">` tags; `public/manifest.json` references those URLs.
- **Price-period strings MUST have a space after the slash** — `"/mes"`, `"/mo"`, `"/año"` etc. get parsed by Googlebot as relative paths, which created phantom 404 URLs (`/mes`, `/año`, `/mo`, `/$`) in Search Console. Adding a space (`"/ mes"`) breaks the token so Google's link extractor doesn't treat it as a URL. Applies to `landing.premiumFrom`, `premium.planMonthlyPeriod`, `premium.planQuarterlyPeriod`, `premium.planYearlyPeriod`, `premium.teaserSubtitle` across all 13 locales. Use `scripts/add-price-spacing.js` (idempotent) to re-apply if a locale ships new copy.
