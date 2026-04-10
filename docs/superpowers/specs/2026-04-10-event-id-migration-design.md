# Event ID Migration — Design Spec

**Date:** 2026-04-10
**Status:** REJECTED — investigation concluded, not viable
**Priority:** N/A

---

## Original Problem

`meta_stats` groups by `brawler_id + map (string) + mode (string)`. Proposed replacing with `event_id (integer)` for cleaner lookups and direct CDN image URLs.

## Investigation Results

### Data from BrawlAPI (verified 2026-04-10)

Queried `https://api.brawlapi.com/v1/maps` — 1,132 map entries, 853 unique names.

**Key findings:**

1. **event_id is stable per map version** — does NOT change between rotations. "Pinhole Punt" in Brawl Ball is always `15000026`.

2. **CRITICAL: 108 map+mode combinations have MULTIPLE event_ids.** The same map in the same mode can have different IDs across time (map remakes, balance updates, seasonal versions).
   - "Hard Rock Mine" in Gem Grab: **6 different event_ids** (15000007, 15000305, 15000664, 15000685, 15000708, 15000780)
   - "Skull Creek" across modes: **10 different event_ids**
   - "Shooting Star" in Bounty: **4 different event_ids**

3. **event_id encodes map+mode+version**, not just map+mode.

### Why This Kills the Migration

If we group by `event_id`, data for "Hard Rock Mine in Gem Grab" would split across 6 separate groups instead of 1. Win rates would be fragmented across versions, making statistical calculations meaningless with small sample sizes.

The current approach (`map + mode` strings) correctly groups all versions together, which is what users expect — they want to know "how does Shelly perform on Hard Rock Mine?" regardless of which version of the map it is.

## Decision: NOT DOING

**Reason:** `event_id` is not a 1:1 replacement for `map+mode`. It's more granular (includes version), which fragments data and reduces statistical significance.

**Current solution works correctly:**
- `useMapImages` hook resolves `mapName → imageUrl` via `/api/maps` endpoint
- Cached 24h in localStorage
- Zero database changes needed
- MetaIntelligence component uses it for map background images

**The only "cost" is one extra HTTP call (cached) — negligible vs. a production schema migration.**

## Lesson

Before proposing a database migration, verify the data model assumptions against real data. "event_id is permanent per map" was partially true but missed the version dimension that makes it unsuitable as an aggregation key.
