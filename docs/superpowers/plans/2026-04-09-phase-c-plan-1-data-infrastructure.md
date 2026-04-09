# Phase C: Pro Meta Analytics — Data Infrastructure Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `meta_trios` table, extend the cron job to accumulate trio compositions from pro battlelogs, remove data cleanup, and add new display constants.

**Architecture:** The cron job (`meta-poll`) already polls top 100 global players and aggregates stats + matchups. This plan adds a third accumulator (`trios`) that captures 3-brawler team compositions per map/mode/date. The `MetaAccumulators` interface in `meta-accumulator.ts` gets a `trios` field. After the existing `processBattleForMeta()` call, trio extraction logic identifies the polled player's team, sorts brawler IDs canonically, and accumulates win/loss/total. A new Supabase RPC (`bulk_upsert_meta_trios`) atomically upserts accumulated trios. Data cleanup (lines 171-173 in the cron route) is removed so PRO data persists forever.

**Tech Stack:** Supabase SQL (migration), TypeScript, Vitest (TDD)

**Spec reference:** `docs/superpowers/specs/2026-04-09-phase-c-pro-meta-analytics-design.md`

**Dependency:** None (first plan in Phase C)

---

## Task 1: Create migration `007_meta_trios.sql`

Creates the `meta_trios` table, lookup index, RLS policies, and the `bulk_upsert_meta_trios` RPC function.

### Steps

- [ ] **1.1** Create the migration file:

**File:** `supabase/migrations/007_meta_trios.sql`

```sql
-- ═══════════════════════════════════════════════════════════════
-- Meta Trios: Aggregated trio compositions from pro battlelogs
-- ═══════════════════════════════════════════════════════════════

-- Table: stores win/loss/total per trio (3 brawlers) per map/mode/date
-- Brawler IDs are canonically sorted: brawler1_id < brawler2_id < brawler3_id
CREATE TABLE IF NOT EXISTS meta_trios (
  brawler1_id INT NOT NULL,
  brawler2_id INT NOT NULL,
  brawler3_id INT NOT NULL,
  map TEXT NOT NULL,
  mode TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'global',
  date DATE NOT NULL,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  PRIMARY KEY (brawler1_id, brawler2_id, brawler3_id, map, mode, source, date)
);

-- Lookup index for API queries: filter by map + mode + source + date range
CREATE INDEX IF NOT EXISTS idx_meta_trios_lookup
  ON meta_trios(map, mode, source, date);

-- RLS: public read, service-role-only write
ALTER TABLE meta_trios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_trios_select" ON meta_trios
  FOR SELECT USING (true);

CREATE POLICY "meta_trios_all_service" ON meta_trios
  FOR ALL USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
  );

-- Bulk upsert RPC: atomically inserts or increments counters
CREATE OR REPLACE FUNCTION bulk_upsert_meta_trios(rows JSONB)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r JSONB;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(rows)
  LOOP
    INSERT INTO meta_trios (brawler1_id, brawler2_id, brawler3_id, map, mode, source, date, wins, losses, total)
    VALUES (
      (r->>'brawler1_id')::int, (r->>'brawler2_id')::int, (r->>'brawler3_id')::int,
      r->>'map', r->>'mode', r->>'source', (r->>'date')::date,
      (r->>'wins')::int, (r->>'losses')::int, (r->>'total')::int
    )
    ON CONFLICT (brawler1_id, brawler2_id, brawler3_id, map, mode, source, date)
    DO UPDATE SET
      wins = meta_trios.wins + EXCLUDED.wins,
      losses = meta_trios.losses + EXCLUDED.losses,
      total = meta_trios.total + EXCLUDED.total;
  END LOOP;
END;
$$;
```

- [ ] **1.2** Verify the migration file is valid SQL by reviewing it manually (no automated SQL linting available in this project).

- [ ] **1.3** Commit:

```bash
git add supabase/migrations/007_meta_trios.sql
git commit -m "feat(db): add meta_trios table + bulk upsert RPC

Migration 007: creates meta_trios for aggregated pro trio data,
lookup index, RLS policies, and bulk_upsert_meta_trios RPC."
```

---

## Task 2: Update `MetaAccumulators` type + trio accumulation logic (TDD)

Extends the `MetaAccumulators` interface with a `trios` field and keeps `processBattleForMeta()` unchanged (trio extraction happens at cron level since it needs the full team, not just the polled player's brawler ID).

### Steps

- [ ] **2.1** Write the test FIRST:

**File:** `src/__tests__/unit/lib/draft/meta-accumulator.test.ts`

Add a new `describe` block at the end of the existing file (after the existing `processBattleForMeta` describe):

```typescript
import { describe, it, expect } from 'vitest'
import { processBattleForMeta, type MetaAccumulators } from '@/lib/draft/meta-accumulator'

// --- ADD AFTER existing tests ---

describe('MetaAccumulators trios field', () => {
  it('initializes with an empty trios Map', () => {
    const acc: MetaAccumulators = { stats: new Map(), matchups: new Map(), trios: new Map() }
    expect(acc.trios).toBeInstanceOf(Map)
    expect(acc.trios.size).toBe(0)
  })

  it('trios Map accepts TrioAccumulator entries', () => {
    const acc: MetaAccumulators = { stats: new Map(), matchups: new Map(), trios: new Map() }
    const trioKey = '1|2|3|Hard Rock Mine|gemGrab'
    acc.trios.set(trioKey, {
      wins: 5,
      losses: 3,
      total: 8,
      ids: [1, 2, 3],
      map: 'Hard Rock Mine',
      mode: 'gemGrab',
    })

    const entry = acc.trios.get(trioKey)!
    expect(entry.wins).toBe(5)
    expect(entry.losses).toBe(3)
    expect(entry.total).toBe(8)
    expect(entry.ids).toEqual([1, 2, 3])
    expect(entry.map).toBe('Hard Rock Mine')
    expect(entry.mode).toBe('gemGrab')
  })

  it('processBattleForMeta still works after trios added to interface', () => {
    const acc: MetaAccumulators = { stats: new Map(), matchups: new Map(), trios: new Map() }
    processBattleForMeta(acc, {
      myBrawlerId: 1,
      opponentBrawlerIds: [10, 11, 12],
      map: 'Hard Rock Mine',
      mode: 'gemGrab',
      result: 'victory',
    })

    expect(acc.stats.size).toBe(1)
    expect(acc.matchups.size).toBe(3)
    // trios are NOT populated by processBattleForMeta — cron does that separately
    expect(acc.trios.size).toBe(0)
  })
})
```

- [ ] **2.2** Run the test (expect it to fail because `trios` is not on the interface yet):

```bash
npx vitest run src/__tests__/unit/lib/draft/meta-accumulator.test.ts
```

- [ ] **2.3** Update the `MetaAccumulators` interface:

**File:** `src/lib/draft/meta-accumulator.ts`

Replace the existing `MetaAccumulators` interface (lines 4-9):

```typescript
/** In-memory accumulators for batch processing */
export interface MetaAccumulators {
  /** Key: "brawlerId|map|mode" → wins/losses/total */
  stats: Map<string, StatAccumulator>
  /** Key: "brawlerId|opponentId|mode" → wins/losses/total */
  matchups: Map<string, StatAccumulator>
  /** Key: "b1|b2|b3|map|mode" → wins/losses/total + metadata */
  trios: Map<string, StatAccumulator & { ids: number[]; map: string; mode: string }>
}
```

- [ ] **2.4** Run the test again (expect it to pass):

```bash
npx vitest run src/__tests__/unit/lib/draft/meta-accumulator.test.ts
```

- [ ] **2.5** Also run the existing meta-accumulator tests to confirm nothing broke:

```bash
npx vitest run src/__tests__/unit/lib/draft/
```

- [ ] **2.6** Commit:

```bash
git add src/lib/draft/meta-accumulator.ts src/__tests__/unit/lib/draft/meta-accumulator.test.ts
git commit -m "feat(meta): add trios field to MetaAccumulators interface

Extends the in-memory accumulator type with a trios Map for storing
trio composition data. Includes TDD tests for the new field."
```

---

## Task 3: Update cron to extract trios from battles + bulk upsert

Modifies `src/app/api/cron/meta-poll/route.ts` to:
1. Initialize `trios: new Map()` in the accumulator
2. After `processBattleForMeta()`, extract the polled player's team trio
3. After existing bulk upserts, call `bulk_upsert_meta_trios`
4. Include `trioKeys` in the response

### Steps

- [ ] **3.1** Update the accumulator initialization at line 48:

**File:** `src/app/api/cron/meta-poll/route.ts`

Find this line:
```typescript
    const acc: MetaAccumulators = { stats: new Map(), matchups: new Map() }
```

Replace with:
```typescript
    const acc: MetaAccumulators = { stats: new Map(), matchups: new Map(), trios: new Map() }
```

- [ ] **3.2** Add trio extraction after the `processBattleForMeta()` call. After line 108 (`battlesProcessed++`), insert before the closing of the `for (const entry of entries)` loop:

**File:** `src/app/api/cron/meta-poll/route.ts`

Find this block (lines 101-109):
```typescript
          processBattleForMeta(acc, {
            myBrawlerId,
            opponentBrawlerIds,
            map,
            mode,
            result: battle.result,
          })

          battlesProcessed++
```

Replace with:
```typescript
          processBattleForMeta(acc, {
            myBrawlerId,
            opponentBrawlerIds,
            map,
            mode,
            result: battle.result,
          })

          // Extract trio composition (polled player's team — 3 brawlers sorted canonically)
          const myTeamIdx = battle.teams.findIndex((team: Array<{ tag: string; brawler: { id: number } }>) =>
            team.some(p => p.tag === tag),
          )
          if (myTeamIdx !== -1 && map) {
            const teamBrawlerIds = battle.teams[myTeamIdx]
              .map((p: { brawler: { id: number } }) => p.brawler.id)
              .sort((a: number, b: number) => a - b)

            if (teamBrawlerIds.length === 3) {
              const trioKey = `${teamBrawlerIds[0]}|${teamBrawlerIds[1]}|${teamBrawlerIds[2]}|${map}|${mode}`
              const existing = acc.trios.get(trioKey) ?? {
                wins: 0, losses: 0, total: 0,
                ids: teamBrawlerIds, map, mode,
              }
              existing.total++
              if (battle.result === 'victory') existing.wins++
              else existing.losses++
              acc.trios.set(trioKey, existing)
            }
          }

          battlesProcessed++
```

- [ ] **3.3** Add trio bulk upsert after the matchups bulk upsert (after line 162). Find the section after `bulk_upsert_meta_matchups`:

**File:** `src/app/api/cron/meta-poll/route.ts`

Find this block:
```typescript
      await supabase.rpc('bulk_upsert_meta_matchups', { rows: matchupRows })
    }

    // 6. Update cursors
```

Replace with:
```typescript
      await supabase.rpc('bulk_upsert_meta_matchups', { rows: matchupRows })
    }

    // 5b. Bulk upsert meta_trios (single RPC call)
    if (acc.trios.size > 0) {
      const trioRows = Array.from(acc.trios.entries()).map(([, val]) => ({
        brawler1_id: val.ids[0],
        brawler2_id: val.ids[1],
        brawler3_id: val.ids[2],
        map: val.map,
        mode: val.mode,
        source: 'global',
        date: today,
        wins: val.wins,
        losses: val.losses,
        total: val.total,
      }))

      await supabase.rpc('bulk_upsert_meta_trios', { rows: trioRows })
    }

    // 6. Update cursors
```

- [ ] **3.4** Update the response JSON to include `trioKeys`. Find this block:

**File:** `src/app/api/cron/meta-poll/route.ts`

Find:
```typescript
    return NextResponse.json({
      processed,
      skipped,
      errors,
      battlesProcessed,
      statKeys: acc.stats.size,
      matchupKeys: acc.matchups.size,
    })
```

Replace with:
```typescript
    return NextResponse.json({
      processed,
      skipped,
      errors,
      battlesProcessed,
      statKeys: acc.stats.size,
      matchupKeys: acc.matchups.size,
      trioKeys: acc.trios.size,
    })
```

- [ ] **3.5** Run the existing cron integration test to confirm it still passes:

```bash
npx vitest run src/__tests__/integration/api/
```

- [ ] **3.6** Commit:

```bash
git add src/app/api/cron/meta-poll/route.ts
git commit -m "feat(cron): accumulate trio compositions from pro battlelogs

Extracts 3-brawler team compositions from each battle, sorts IDs
canonically, accumulates in-memory, and bulk upserts via RPC."
```

---

## Task 4: Remove data cleanup from cron (lines 171-173)

The spec mandates that PRO data persists forever. UI filters by time window. Remove the DELETE statements that purge data older than 30 days.

### Steps

- [ ] **4.1** Remove the cleanup block:

**File:** `src/app/api/cron/meta-poll/route.ts`

Find and remove these lines entirely (they will have shifted due to Task 3 insertions, but search for this exact content):

```typescript
    // 7. Cleanup old data (>30 days)
    await supabase.from('meta_stats').delete().lt('date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
    await supabase.from('meta_matchups').delete().lt('date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
```

Replace with nothing (delete those 3 lines completely).

- [ ] **4.2** Verify the file compiles:

```bash
npx tsc --noEmit src/app/api/cron/meta-poll/route.ts 2>&1 || echo "Check for errors"
```

- [ ] **4.3** Commit:

```bash
git add src/app/api/cron/meta-poll/route.ts
git commit -m "fix(cron): remove meta data cleanup — data persists forever

PRO data is the asset. UI filters by time window instead of
deleting old records. Supports 7/14/30/90 day windows."
```

---

## Task 5: Add PRO display constants

Adds configurable constants for minimum battle thresholds and trend calculation windows.

### Steps

- [ ] **5.1** Write the test FIRST:

**File:** `src/__tests__/unit/lib/constants.test.ts`

Add at the end of the existing file (after existing tests):

```typescript
import {
  PRO_MIN_BATTLES_DISPLAY,
  PRO_TREND_DAYS_SHORT,
  PRO_TREND_DAYS_MEDIUM,
  PRO_TREND_DAYS_LONG,
} from '@/lib/draft/constants'

describe('PRO display constants', () => {
  it('PRO_MIN_BATTLES_DISPLAY is a positive integer', () => {
    expect(PRO_MIN_BATTLES_DISPLAY).toBeGreaterThan(0)
    expect(Number.isInteger(PRO_MIN_BATTLES_DISPLAY)).toBe(true)
  })

  it('PRO_MIN_BATTLES_DISPLAY is 20 (design spec value)', () => {
    expect(PRO_MIN_BATTLES_DISPLAY).toBe(20)
  })

  it('trend windows are ordered SHORT < MEDIUM < LONG', () => {
    expect(PRO_TREND_DAYS_SHORT).toBeLessThan(PRO_TREND_DAYS_MEDIUM)
    expect(PRO_TREND_DAYS_MEDIUM).toBeLessThan(PRO_TREND_DAYS_LONG)
  })

  it('PRO_TREND_DAYS_SHORT is 7', () => {
    expect(PRO_TREND_DAYS_SHORT).toBe(7)
  })

  it('PRO_TREND_DAYS_MEDIUM is 14', () => {
    expect(PRO_TREND_DAYS_MEDIUM).toBe(14)
  })

  it('PRO_TREND_DAYS_LONG is 30', () => {
    expect(PRO_TREND_DAYS_LONG).toBe(30)
  })
})
```

- [ ] **5.2** Run the test (expect it to fail because constants don't exist yet):

```bash
npx vitest run src/__tests__/unit/lib/constants.test.ts
```

- [ ] **5.3** Add the constants:

**File:** `src/lib/draft/constants.ts`

Add at the end of the file, after the existing `META_POLL_DELAY_MS` line:

```typescript

/** Minimum pro battles to show PRO data for a brawler/map combo (avoids noise) */
export const PRO_MIN_BATTLES_DISPLAY = 20

/** Short-term trend window (days) */
export const PRO_TREND_DAYS_SHORT = 7

/** Medium-term trend window (days) */
export const PRO_TREND_DAYS_MEDIUM = 14

/** Long-term trend window (days) */
export const PRO_TREND_DAYS_LONG = 30
```

- [ ] **5.4** Run the test again (expect it to pass):

```bash
npx vitest run src/__tests__/unit/lib/constants.test.ts
```

- [ ] **5.5** Run all draft tests to confirm nothing broke:

```bash
npx vitest run src/__tests__/unit/lib/draft/
```

- [ ] **5.6** Commit:

```bash
git add src/lib/draft/constants.ts src/__tests__/unit/lib/constants.test.ts
git commit -m "feat(constants): add PRO display thresholds and trend windows

PRO_MIN_BATTLES_DISPLAY=20, PRO_TREND_DAYS_SHORT=7,
PRO_TREND_DAYS_MEDIUM=14, PRO_TREND_DAYS_LONG=30."
```

---

## Verification Checklist

After all 5 tasks are complete, run the full test suite to confirm no regressions:

```bash
npx vitest run
```

Expected results:
- All existing tests pass (meta-accumulator, scoring, constants)
- New trio accumulator tests pass
- New constants tests pass
- No TypeScript compilation errors

### Files Modified
| File | Change |
|------|--------|
| `supabase/migrations/007_meta_trios.sql` | **Created** — table + index + RLS + RPC |
| `src/lib/draft/meta-accumulator.ts` | **Modified** — added `trios` to `MetaAccumulators` |
| `src/lib/draft/constants.ts` | **Modified** — added 4 PRO constants |
| `src/app/api/cron/meta-poll/route.ts` | **Modified** — trio extraction, bulk upsert, removed cleanup |
| `src/__tests__/unit/lib/draft/meta-accumulator.test.ts` | **Modified** — added trio tests |
| `src/__tests__/unit/lib/constants.test.ts` | **Modified** — added PRO constant tests |
