# Event ID Migration — Design Spec (DRAFT)

**Date:** 2026-04-10
**Status:** Draft — needs brainstorming session
**Priority:** HIGH — simplifies data model, enables map images everywhere

---

## Problem

`meta_stats` currently groups by `brawler_id + map (string) + mode (string)`. This has issues:

1. **No map images** — We need `event_id` to get map images from Brawlify CDN (`cdn.brawlify.com/maps/regular/{eventId}.png`). Currently resolving images by map name via a separate `useMapImages` hook is a workaround.
2. **String comparison is slower** than integer comparison for queries and indexes.
3. **Redundancy** — `event_id` already encodes both the map AND the mode. `map + mode` as strings are redundant when we have the integer ID.

## Proposed Change

Replace `map (text) + mode (text)` with `event_id (integer)` as the grouping key in `meta_stats`.

**Key insight:** A Brawl Stars `event_id` is permanent per map. "Pinhole Punt" always has the same `event_id` regardless of rotation schedule.

## Impact Analysis (must verify each)

### Database
- `meta_stats` table: add `event_id integer` column, possibly replace `map + mode` or keep for backward compat
- `bulk_upsert_meta_stats` RPC: update to accept `event_id`, update upsert conflict key
- Indexes: new index on `(brawler_id, event_id, source, date)`

### Backend
- `meta-accumulator.ts`: change `BattleMetaInput` to include `eventId`, change stat key from `brawlerId|map|mode` to `brawlerId|eventId`
- `cron/sync/route.ts`: pass `event_id` from parsed battle
- `cron/meta-poll/route.ts`: pass `entry.event.id`
- `api/draft/data/route.ts`: query by `event_id` instead of `map + mode`
- `api/meta/brawler-detail/route.ts`: select `event_id`, group by it
- `api/meta/pro-analysis/route.ts`: query by `event_id`

### Frontend
- `MetaIntelligence.tsx`: use `getMapImageUrl(eventId)` directly, remove `useMapImages` dependency
- `MapSelector.tsx`: may need updates if it uses map name for queries
- Remove `useMapImages` hook if no longer needed

### Data
- Need a `event_id → map_name + mode` lookup (from BrawlAPI or stored in DB)
- Existing data in `meta_stats` needs migration (backfill `event_id` from map name)

## Questions to Resolve
1. Keep `map + mode` columns for human readability, or drop them?
2. How to backfill `event_id` for existing rows? (match map name against BrawlAPI)
3. Should `meta_matchups` also get `event_id`? (currently mode-level only)
4. Impact on `battles` table? (already has `event_id` column?)

## Recommendation
This is a **schema migration** that touches 6+ API routes, 2 RPC functions, and the accumulator. Needs its own spec → plan → execution cycle. Don't rush it.
