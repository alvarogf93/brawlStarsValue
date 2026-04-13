# Smoke Test — Sprint C Meta UX Remediation

Run this checklist once after any deploy that touches `/api/meta/pro-analysis`, `/api/meta`, `TopBrawlersGrid`, `MetaIntelligence`, `MapCard`, `MatchupMatrix`, `MetaProTab`, the picks pages, or any locale file under `messages/`. Takes ~5 minutes.

## Prerequisites

- Migration `012_meta_stats_mode_index.sql` has been applied to production via the Supabase Dashboard SQL Editor (same flow as migrations `010` and `011`).
- Deploy is live.
- A premium dev account is available for the tier-specific checks.
- A rare brawler is identified (e.g. a recently released one) for testing contextual empty states on the brawler detail page.

## Public surface (anonymous user)

- [ ] `/picks` — each `MapCard` shows the promoted sample size text in its bottom-left corner (e.g. "1,250 batallas")
- [ ] `/picks` — on a map with `totalBattles < 100`, the amber "Datos limitados" indicator is visible next to the sample size
- [ ] `/picks` — on a map with effectively zero battles, either (a) the contextual empty state renders "Mapa nuevo o rotación reciente — recolectando datos." or (b) the mode-fallback banner renders at the top of the card and the card shows mode-level data
- [ ] `/brawler/16000000` (Shelly public page) — `MetaIntelligence` shows per-row `(N) batallas` on strong/weak matchups and on the teammates list
- [ ] `/brawler/16000000` — `MetaIntelligence` shows per-card `(N) batallas` overlay on the best-maps grid
- [ ] `/brawler/16000000` — `ConfidenceBadge` dots are visible on every row with sample size ≥ 1
- [ ] On a rare brawler page (low total battles), empty sections show the new contextual copy:
  - "No hay matchups registrados para este brawler en los últimos 90 días..." instead of "Datos insuficientes"
  - "No hay datos de mapas para este brawler todavía..." instead of "Datos insuficientes"
  - `bestTeammates` section is silently omitted (intentional — no empty-state copy for this one)

## Premium Meta Pro tab (authenticated premium user)

- [ ] `/profile/{tag}/analytics` → Meta Pro tab with a Tier A map selected (e.g. Sidetrack + brawlBall)
    - [ ] `TopBrawlersGrid` shows inline counters below each brawler card (3 per card)
    - [ ] Each brawler card shows `(N) batallas` text and a `ConfidenceBadge` dot (top-right corner of the card)
    - [ ] NO mode-fallback banner visible
    - [ ] `CounterQuickView` is NOT rendered anywhere (section is gone)
- [ ] Same tab with a Tier D map (e.g. heist::Pit Stop if it's in rotation, or any map with `<30` total battles)
    - [ ] Mode-fallback banner visible at the top of `TopBrawlersGrid`: "Mostrando datos agregados del modo — este mapa tiene datos escasos."
    - [ ] The brawler grid is populated with mode-level data (non-empty)
    - [ ] Trends (7d/30d arrows) are present on the cards — this verifies the Tier 2 fallback re-queried trends instead of reusing stale map-filtered trend maps (see spec §7.2 and Task 3 correctness fix)
- [ ] `MatchupMatrix` section — title reads "TUS MATCHUPS — Cómo rindes TÚ contra cada oponente" (or the equivalent in the active UI locale)

## Locale spot-check

- [ ] Switch the app to `en` — every new string renders in English, not as the key name
- [ ] Switch to `fr` — same
- [ ] Switch to `ja` — same; no broken characters
- [ ] Switch to `ar` — RTL layout still sane; sample size and banners render right-to-left aware

## Error paths

- [ ] Visit `/api/meta/pro-analysis` without `map` or `mode` query params → 400 error (pre-existing behaviour, verify it still holds)
- [ ] Disable network on the browser and reload Meta Pro → spinner + error state (pre-existing)

## Backend sanity

- [ ] `curl -s "https://brawlvision.com/api/meta"` returns JSON with each map in `events[]` having a `source` field (`"map-mode"` or `"mode-fallback"`)
- [ ] Response headers include `Cache-Control: public, s-maxage=1800, stale-while-revalidate=3600`
- [ ] `curl -s "https://brawlvision.com/api/meta/pro-analysis?map=Sidetrack&mode=brawlBall"` returns JSON with `topBrawlersSource: "map-mode"` or `"mode-fallback"` at the top level

## Migration sanity

- [ ] Run `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_meta_stats_mode_lookup';` in the Supabase Dashboard SQL Editor. Expected: one row returned. If zero rows, migration `012_meta_stats_mode_index.sql` has not been applied.
- [ ] Optional: `EXPLAIN ANALYZE SELECT brawler_id FROM meta_stats WHERE mode = 'brawlBall' AND source = 'global' AND date >= '2026-04-06';` — verify Postgres chooses `idx_meta_stats_mode_lookup` (leading-column match) instead of an index skip-scan on the old `idx_meta_stats_lookup`.

## If any step fails

1. Check the Vercel Function logs for the affected route.
2. Verify migration 012 is applied (`SELECT indexname FROM pg_indexes WHERE indexname = 'idx_meta_stats_mode_lookup';` in Supabase Dashboard).
3. Verify the locale file for the active language parses as valid JSON (`node -e "JSON.parse(require('fs').readFileSync('messages/es.json', 'utf-8'))"`).
4. Re-run this checklist.
