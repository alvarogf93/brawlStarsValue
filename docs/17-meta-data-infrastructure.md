# Meta Data Infrastructure — Technical Reference

> Last updated: 2026-04-09

## Overview

System for tracking professional player (top 100 global) performance in 3v3 competitive modes, aggregating into win/loss statistics, and serving ranked recommendations.

## Data Pipeline

```
Cron (every 2-4h) → Poll top 100 pros → Filter 3v3 draft battles
→ Accumulate in-memory → Bulk upsert DB (atomic +=) → Serve via APIs
```

## Database Tables

### `meta_stats` — Win rate per brawler/map/mode
- **PK**: (brawler_id, map, mode, source, date)
- **Sources**: `'global'` (pros), `'users'` (community)
- **Rolling window**: 14 days (cleanup at 30 days)
- **RLS**: Public SELECT, service-role-only writes

### `meta_matchups` — Brawler vs brawler counters
- **PK**: (brawler_id, opponent_id, mode, source, date)
- **Granularity**: Mode-level (NOT map-level) — more statistical power
- **RLS**: Public SELECT, service-role-only writes

### `meta_poll_cursors` — Deduplication tracking
- **PK**: player_tag
- **Purpose**: Prevents reprocessing same battles across cron runs
- **RLS**: Service-role-only

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

- `META_ROLLING_DAYS = 14`
- `META_POLL_BATCH_SIZE = 100` (pros per run)
- `META_POLL_DELAY_MS = 100` (throttle between API calls)
- `BAYESIAN_STRENGTH = 30`
- `DRAFT_MODES`: gemGrab, heist, bounty, brawlBall, hotZone, knockout, wipeout, brawlHockey

## Files Reference

| File | Responsibility |
|------|---------------|
| `src/app/api/cron/meta-poll/route.ts` | Cron: poll + accumulate + bulk upsert |
| `src/app/api/meta/route.ts` | Public meta endpoint |
| `src/app/api/draft/data/route.ts` | Draft details (auth tiers) |
| `src/app/api/draft/maps/route.ts` | Map list + images |
| `src/lib/draft/meta-accumulator.ts` | In-memory battle accumulation |
| `src/lib/draft/scoring.ts` | Bayesian WR + recommendation scoring |
| `src/lib/draft/constants.ts` | Config constants |
| `src/lib/draft/types.ts` | MetaStat, MetaMatchup, DraftData |
| `supabase/migrations/004_meta_tables.sql` | DB schema + RLS |
| `supabase/migrations/005_bulk_meta_rpc.sql` | Bulk upsert RPCs |

## Data Available but NOT Shown to Users

1. **Daily granularity** — meta_stats has `date` column, APIs aggregate to 14-day window. Could show trends.
2. **Full matchup matrix** — meta_matchups has every brawler-vs-brawler pair, only used in draft scoring.
3. **Community vs Pro comparison** — source='users' vs source='global' both exist, could compare.
4. **Pro WR vs User WR** — Could cross meta_stats (pro) with user's battles table for gap analysis.

## Architecture Insight: Mode vs Map

- **Stats**: Tracked at **map level** (brawler performance varies by map geometry)
- **Matchups**: Tracked at **mode level** (counter-picks are mode-dependent, not map-specific)
- This asymmetry is intentional — matchups need more data to be statistically significant
