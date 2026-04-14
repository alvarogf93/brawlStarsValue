# Meta Data Infrastructure — Technical Reference

> Last updated: 2026-04-14 (Sprint F+)
>
> **Scope**: this file is the technical reference for the pro-meta data pipeline. For operational concerns (schedules, secrets, recovery runbooks), see [`docs/crons/README.md`](crons/README.md). For the historical rationale behind individual design decisions, the commit history is the source of truth.

## Overview

System for tracking professional player performance in 3v3 competitive modes, aggregating win/loss statistics per `(brawler, map, mode, date)`, and serving ranked recommendations to the UI.

Since **Sprint F (2026-04-14)** the cron uses a **probabilistic weighted sampling** algorithm — no target thresholds, no gating — that attenuates oversampled maps and guarantees non-zero acceptance for the scarcest live map. See [`docs/crons/README.md#3-apicronmeta-poll-sprint-f-2026-04-14`](crons/README.md) for the full algorithm + data-preservation invariants.

## Data Pipeline

```
Cron every 30 min (VPS crontab)
  → Fetch candidate pool from 11 country rankings (~2,100 unique)
  → Fetch live events rotation (which `(map, mode)` pairs are active now)
  → Preload 28-day cumulative counts from meta_stats (real battles, not brawler-rows)
  → For each player (up to META_POLL_MAX_DEPTH = 1000):
      • Rebuild probabilistic sampler per player
      • Filter incoming battles via `rng() < (minLive+1)/(current+1)`
      • Accumulate in-memory
  → Bulk upsert meta_stats / meta_matchups / meta_trios (atomic +=)
  → Advance meta_poll_cursors to avoid re-processing
  → Write cron_heartbeats success row
  → Serve via /api/meta, /api/meta/pro-analysis
```

Every write path destructures `{ error }` from the Supabase client response and throws on error — a defensive pattern documented in `docs/crons/README.md#issue-7-resuelto--falsa-alarma`.

## Database Tables

### `meta_stats` — Win rate per brawler/map/mode/day
- **PK**: `(brawler_id, map, mode, source, date)`
- **Sources**: `'global'` (pro poll), `'users'` (premium sync aggregates)
- **Rolling windows**:
  - UI reads: **14 days** (`META_ROLLING_DAYS`)
  - Cron preload: **28 days** (`META_POLL_PRELOAD_DAYS` — longer so maps with slow rotation have memory of ≥2-3 appearances when the sampler decides priority)
  - Hot retention: **90 days** — anything older moves to `meta_stats_archive` via the weekly `archive-meta-stats` pg_cron job (Mondays 04:00 UTC). See [`archive-runbook.md`](crons/archive-runbook.md).
- **RLS**: Public SELECT, service-role-only writes

### `meta_stats_archive` — Long-term weekly aggregates
- **PK**: `(brawler_id, map, mode, source, period_start)` where `period_start` = first day of the ISO week
- **Purpose**: Preserves every row older than 90 days as a weekly aggregate. Append-or-merge only (never DELETE). Enables future cross-season analytics, balance-patch comparisons, etc.
- **Schema + function**: `supabase/migrations/018_meta_stats_archive.sql`
- **Scheduling**: `supabase/migrations/019_schedule_archive_cron.sql`

### `meta_matchups` — Brawler vs brawler counters
- **PK**: `(brawler_id, opponent_id, mode, source, date)`
- **Granularity**: Mode-level (NOT map-level) — more statistical power per cell
- **RLS**: Public SELECT, service-role-only writes

### `meta_trios` — 3-brawler composition stats
- **PK**: `(brawler1_id, brawler2_id, brawler3_id, map, mode, source, date)` (canonical ordering: `id1 ≤ id2 ≤ id3`)
- **Purpose**: Pro team-synergy analysis in the Team tab and the Meta PRO tab
- **RLS**: Public SELECT, service-role-only writes

### `meta_poll_cursors` — Deduplication tracking
- **PK**: `player_tag`
- **Purpose**: Prevents reprocessing the same battles across cron runs. The cursor advances to `max(battle_time)` of the processed battlelog **regardless of whether each battle was accepted by the sampler** — a rejected battle is not a DB mutation, just a captured-skipped decision at budget-allocation time.
- **RLS**: Service-role-only

### `cron_heartbeats` — Observability
- **PK**: `job_name` (e.g. `'meta-poll'`, `'sync'`, `'archive-meta-stats'`)
- **Columns**: `last_success_at`, `last_duration_ms`, `last_summary JSONB`
- **Purpose**: Staleness alerting — if a heartbeat row isn't updated within its expected window, the cron is down. See [`docs/crons/README.md#observability--cron_heartbeats-table`](crons/README.md).
- **Schema**: `supabase/migrations/016_cron_heartbeats.sql`

## API Endpoints

| Endpoint | Auth | Purpose | DB Access |
|----------|------|---------|-----------|
| `GET /api/cron/meta-poll` | CRON_SECRET | Poll pros, aggregate stats | W: meta_stats, meta_matchups, cursors |
| `GET /api/meta` | Public | Current rotation + top 10 per map | R: meta_stats |
| `GET /api/draft/data?map=X&mode=Y` | Public (+premium for personal) | Detailed stats + matchups | R: meta_stats, meta_matchups, battles |
| `GET /api/draft/maps?mode=X` | Public | All maps for mode + images | R: meta_stats + BrawlAPI |

## Scoring: Bayesian Win Rate

```
bayesianWR = ((wins + 30 * 0.5) / (total + 30)) * 100
```
- Shrinks small samples toward 50%
- 3/3 wins → ~54.5% (not 100%)
- 100/150 wins → ~63.9% (close to raw 66.7%)

## Draft Recommendation Weights

| Scenario | Meta Weight | Counter Weight | Personal Weight |
|----------|------------|---------------|----------------|
| No enemies, no personal | 100% | 0% | 0% |
| Enemies known | 33% | 67% | 0% |
| Enemies + personal | 25% | 50% | 25% |

## Key Constants (`src/lib/draft/constants.ts`)

- `META_ROLLING_DAYS = 14` — UI read window
- `META_POLL_PRELOAD_DAYS = 28` — cron preload window (strictly longer than UI so the sampler has memory of slowly-rotating maps)
- `META_POLL_MAX_DEPTH = 1000` — hard cap on players processed per cron run (Hobby-plan envelope; upgrades to 1500 on Pro)
- `META_POLL_RANKING_COUNTRIES` — 11 country codes (`global, US, BR, MX, DE, FR, ES, JP, KR, TR, RU`) merged + deduped for ~2,100 unique candidates per run
- `META_POLL_DELAY_MS = 100` — throttle between Supercell API calls (NOT polling — rate-limit pacing)
- `BAYESIAN_STRENGTH = 30` — prior strength for the `bayesianWinRate` helper
- `DRAFT_MODES`: `gemGrab`, `heist`, `bounty`, `brawlBall`, `hotZone`, `knockout`, `wipeout`, `brawlHockey`, `basketBrawl` (9 modes — all 3v3 competitive; showdown/boss/duels excluded upstream in `normalizeSupercellMode`)

Historical constants **removed** in Sprint F and no longer valid: `META_POLL_TARGET_RATIO`, `META_POLL_MIN_TARGET`, `META_POLL_BATCH_SIZE`, `META_POLL_CHUNK_SIZE`, `META_MIN_BATTLES`. If you find any of these referenced in docs or comments, they are stale.

## Files Reference

| File | Responsibility |
|------|---------------|
| `src/app/api/cron/meta-poll/route.ts` | Cron: pool fetch + rotation fetch + preload + sampling loop + bulk upsert + heartbeat |
| `src/lib/draft/meta-poll-balance.ts` | Pure helpers: `computeMinLive`, `computeAcceptRate`, `createSeededRng`, `findMapModeStragglers` |
| `src/app/api/meta/route.ts` | Public meta endpoint (rotation + top brawlers per map, 30-min Cache-Control) |
| `src/app/api/meta/pro-analysis/route.ts` | Personal analytics: top brawlers, matchup gap, trios, trend 7d/30d (cookie-auth) |
| `src/app/api/draft/data/route.ts` | Draft details (auth tiers) |
| `src/app/api/draft/maps/route.ts` | Map list + images |
| `src/lib/draft/meta-accumulator.ts` | In-memory `(brawler, map, mode)` / matchup / trio accumulation |
| `src/lib/draft/scoring.ts` | Bayesian WR + recommendation scoring |
| `src/lib/draft/constants.ts` | Config constants (see section above) |
| `src/lib/draft/types.ts` | `MetaStat`, `MetaMatchup`, `DraftData` |
| `src/lib/cron/heartbeat.ts` | `writeCronHeartbeat` helper shared by all HTTP crons |
| `supabase/migrations/004_meta_tables.sql` | Original `meta_stats` / `meta_matchups` schema + RLS |
| `supabase/migrations/005_bulk_meta_rpc.sql` | `bulk_upsert_meta_stats` / `..._matchups` RPCs |
| `supabase/migrations/008_meta_trios.sql` | `meta_trios` schema + bulk upsert RPC |
| `supabase/migrations/012_meta_stats_mode_index.sql` | Mode-only index for Tier 2 fallback queries in pro-analysis |
| `supabase/migrations/013_hyperspace_brawlhockey_backfill.sql` | One-time UPDATE migrating mis-classified Hyperspace rows |
| `supabase/migrations/014_sum_meta_stats_by_map_mode.sql` | Preload RPC (original) |
| `supabase/migrations/015_cleanup_map_mode_strays.sql` | Self-healing CTE DELETE-RETURNING-INSERT merge for stale rows |
| `supabase/migrations/016_cron_heartbeats.sql` | Observability table for cron staleness alerts |
| `supabase/migrations/017_sum_meta_stats_battles_unit_fix.sql` | Divides `SUM(total) / 6` so preload is in real battles, not brawler-rows |
| `supabase/migrations/018_meta_stats_archive.sql` | Long-term archive table + `archive_meta_stats_weekly()` function |
| `supabase/migrations/019_schedule_archive_cron.sql` | Weekly pg_cron entry for the archive job |

## Data Available but NOT Shown to Users

1. **Daily granularity** — meta_stats has `date` column, APIs aggregate to 14-day window. Could show trends.
2. **Full matchup matrix** — meta_matchups has every brawler-vs-brawler pair, only used in draft scoring.
3. **Community vs Pro comparison** — source='users' vs source='global' both exist, could compare.
4. **Pro WR vs User WR** — Could cross meta_stats (pro) with user's battles table for gap analysis.

## Architecture Insight: Mode vs Map

- **Stats**: Tracked at **map level** (brawler performance varies by map geometry)
- **Matchups**: Tracked at **mode level** (counter-picks are mode-dependent, not map-specific)
- This asymmetry is intentional — matchups need more data to be statistically significant
