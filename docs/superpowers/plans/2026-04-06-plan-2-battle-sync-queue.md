# Plan 2: Battle Sync Engine + Queue

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the battle sync pipeline — parse Supercell API responses into structured database rows, provide a manual sync endpoint for premium users, and deploy a pg_cron-driven Edge Function worker for automatic hourly syncing.

**Architecture:** Battles are parsed from the Supercell API response into flat rows with JSONB columns for brawler/teammate/opponent data. Manual sync goes through a Next.js API route. Automatic sync uses pg_cron to enqueue premium users into `sync_queue`, then a separate pg_cron job triggers a Supabase Edge Function (Deno) that polls the queue and processes tags. Deduplication is handled by `UNIQUE(player_tag, battle_time)` + `ON CONFLICT DO NOTHING`.

**Tech Stack:** Supabase PostgreSQL, Supabase Edge Functions (Deno), pg_cron, Vitest, Next.js API routes

**Spec:** `docs/superpowers/specs/2026-04-06-premium-battle-analytics-design.md`

**Depends on:** Plan 1 (auth + profiles must be implemented first)

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/battle-parser.ts` | Parse BattlelogEntry into database row |
| Create | `src/lib/battle-sync.ts` | Insert parsed battles into Supabase (dedup) |
| Create | `src/app/api/sync/route.ts` | Manual sync endpoint (premium only) |
| Create | `supabase/functions/sync-worker/index.ts` | Edge Function polling worker |
| Create | `src/__tests__/unit/lib/battle-parser.test.ts` | Parser tests |
| Create | `src/__tests__/unit/lib/battle-sync.test.ts` | Sync logic tests |
| Create | `src/__tests__/integration/api/sync.test.ts` | Sync endpoint tests |
| Modify | `src/lib/supabase/types.ts` | Add battles + sync_queue types |
| Modify | `src/components/layout/Header.tsx` | Sync indicator for premium users |

---

### Task 0: Create battles + sync_queue Tables

**Files:**
- None (SQL executed in Supabase Dashboard)

- [ ] **Step 1: Run SQL migration for battles table**

Open Supabase Dashboard → SQL Editor → New Query:

```sql
CREATE TABLE battles (
  id              BIGSERIAL PRIMARY KEY,
  player_tag      TEXT NOT NULL,
  battle_time     TIMESTAMPTZ NOT NULL,
  mode            TEXT NOT NULL,
  map             TEXT,
  result          TEXT NOT NULL CHECK (result IN ('victory', 'defeat', 'draw')),
  trophy_change   INT DEFAULT 0,
  duration        INT,
  is_star_player  BOOLEAN DEFAULT FALSE,
  my_brawler      JSONB NOT NULL,
  teammates       JSONB DEFAULT '[]'::jsonb,
  opponents       JSONB DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(player_tag, battle_time)
);

CREATE INDEX idx_battles_tag_time ON battles(player_tag, battle_time DESC);
CREATE INDEX idx_battles_mode ON battles(mode);
CREATE INDEX idx_battles_brawler_id ON battles((my_brawler->>'id'));

ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
CREATE POLICY battles_select ON battles FOR SELECT USING (
  player_tag IN (SELECT player_tag FROM profiles WHERE id = auth.uid())
);
-- INSERT/UPDATE/DELETE only via service role (server-side)
```

- [ ] **Step 2: Run SQL migration for sync_queue table**

```sql
CREATE TABLE sync_queue (
  id            BIGSERIAL PRIMARY KEY,
  player_tag    TEXT NOT NULL,
  scheduled_at  TIMESTAMPTZ DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  retry_count   INT DEFAULT 0,
  error         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_queue_pending ON sync_queue(scheduled_at)
  WHERE completed_at IS NULL AND started_at IS NULL AND retry_count < 3;

ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
-- No policies = no client access (service role bypasses RLS)
```

- [ ] **Step 3: Verify tables in Dashboard**

Check Table Editor → `battles` and `sync_queue` visible, RLS enabled on both.

---

### Task 1: Extend Database Types

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Add battles and sync_queue types**

Add these types to `src/lib/supabase/types.ts` after the existing `Profile` types:

```typescript
/** Row type for the battles table */
export interface Battle {
  id: number
  player_tag: string
  battle_time: string
  mode: string
  map: string | null
  result: 'victory' | 'defeat' | 'draw'
  trophy_change: number
  duration: number | null
  is_star_player: boolean
  my_brawler: BrawlerJsonb
  teammates: TeammateJsonb[]
  opponents: TeammateJsonb[]
  created_at: string
}

export interface BrawlerJsonb {
  id: number
  name: string
  power: number
  trophies: number
  gadgets: Array<{ id: number; name: string }>
  starPowers: Array<{ id: number; name: string }>
  hypercharges: Array<{ id: number; name: string }>
}

export interface TeammateJsonb {
  tag: string
  name: string
  brawler: {
    id: number
    name: string
    power: number
    trophies: number
  }
}

/** What we INSERT into battles (id and created_at auto-generated) */
export interface BattleInsert {
  player_tag: string
  battle_time: string
  mode: string
  map: string | null
  result: 'victory' | 'defeat' | 'draw'
  trophy_change: number
  duration: number | null
  is_star_player: boolean
  my_brawler: BrawlerJsonb
  teammates: TeammateJsonb[]
  opponents: TeammateJsonb[]
}

/** Row type for sync_queue */
export interface SyncQueueRow {
  id: number
  player_tag: string
  scheduled_at: string
  started_at: string | null
  completed_at: string | null
  retry_count: number
  error: string | null
  created_at: string
}
```

Update the `Database` interface to include the new tables:

```typescript
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
      battles: {
        Row: Battle
        Insert: BattleInsert
        Update: Partial<BattleInsert>
      }
      sync_queue: {
        Row: SyncQueueRow
        Insert: { player_tag: string }
        Update: Partial<SyncQueueRow>
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat: add battles + sync_queue database types"
```

---

### Task 2: Battle Data Parser

**Files:**
- Create: `src/lib/battle-parser.ts`
- Test: `src/__tests__/unit/lib/battle-parser.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/unit/lib/battle-parser.test.ts
import { describe, it, expect } from 'vitest'
import { parseBattle, parseBattleTime } from '@/lib/battle-parser'
import type { BattlelogEntry } from '@/lib/api'

const PLAYER_TAG = '#YJU282PV'

function makeBattleEntry(overrides: Partial<BattlelogEntry> = {}): BattlelogEntry {
  return {
    battleTime: '20260405T171604.000Z',
    event: { id: 15000001, mode: 'brawlBall', modeId: 2, map: 'Super Beach' },
    battle: {
      mode: 'brawlBall',
      type: 'ranked',
      result: 'victory',
      duration: 120,
      trophyChange: 8,
      starPlayer: { tag: '#YJU282PV', name: 'TestPlayer', brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 750 } },
      teams: [
        [
          { tag: '#YJU282PV', name: 'TestPlayer', brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 750 } },
          { tag: '#ALLY1', name: 'Ally1', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 600 } },
          { tag: '#ALLY2', name: 'Ally2', brawler: { id: 16000002, name: 'BULL', power: 10, trophies: 500 } },
        ],
        [
          { tag: '#FOE1', name: 'Foe1', brawler: { id: 16000003, name: 'BROCK', power: 11, trophies: 700 } },
          { tag: '#FOE2', name: 'Foe2', brawler: { id: 16000004, name: 'RICO', power: 8, trophies: 400 } },
          { tag: '#FOE3', name: 'Foe3', brawler: { id: 16000005, name: 'SPIKE', power: 11, trophies: 800 } },
        ],
      ],
    },
    ...overrides,
  }
}

describe('parseBattleTime', () => {
  it('converts Supercell format to ISO 8601', () => {
    expect(parseBattleTime('20260405T171604.000Z')).toBe('2026-04-05T17:16:04.000Z')
  })

  it('handles missing milliseconds', () => {
    expect(parseBattleTime('20260405T171604Z')).toBe('2026-04-05T17:16:04.000Z')
  })
})

describe('parseBattle', () => {
  it('extracts basic fields', () => {
    const result = parseBattle(makeBattleEntry(), PLAYER_TAG)
    expect(result.player_tag).toBe('#YJU282PV')
    expect(result.mode).toBe('brawlBall')
    expect(result.map).toBe('Super Beach')
    expect(result.result).toBe('victory')
    expect(result.trophy_change).toBe(8)
    expect(result.duration).toBe(120)
  })

  it('detects star player correctly', () => {
    const result = parseBattle(makeBattleEntry(), PLAYER_TAG)
    expect(result.is_star_player).toBe(true)
  })

  it('detects non-star-player correctly', () => {
    const entry = makeBattleEntry()
    entry.battle.starPlayer = { tag: '#SOMEONE', name: 'Other', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 600 } }
    const result = parseBattle(entry, PLAYER_TAG)
    expect(result.is_star_player).toBe(false)
  })

  it('extracts my_brawler from team', () => {
    const result = parseBattle(makeBattleEntry(), PLAYER_TAG)
    expect(result.my_brawler.id).toBe(16000000)
    expect(result.my_brawler.name).toBe('SHELLY')
    expect(result.my_brawler.power).toBe(11)
  })

  it('extracts teammates (excluding self)', () => {
    const result = parseBattle(makeBattleEntry(), PLAYER_TAG)
    expect(result.teammates).toHaveLength(2)
    expect(result.teammates[0].tag).toBe('#ALLY1')
    expect(result.teammates[1].tag).toBe('#ALLY2')
  })

  it('extracts opponents (other team)', () => {
    const result = parseBattle(makeBattleEntry(), PLAYER_TAG)
    expect(result.opponents).toHaveLength(3)
    expect(result.opponents[0].tag).toBe('#FOE1')
  })

  it('handles showdown (players array, no teams)', () => {
    const entry = makeBattleEntry({
      battle: {
        mode: 'showdown',
        type: 'soloRanked',
        result: 'victory',
        duration: 90,
        trophyChange: 10,
        players: [
          { tag: '#YJU282PV', name: 'TestPlayer', brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 750 } },
          { tag: '#OTHER1', name: 'Other1', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 600 } },
        ],
      },
    })
    const result = parseBattle(entry, PLAYER_TAG)
    expect(result.my_brawler.id).toBe(16000000)
    expect(result.teammates).toHaveLength(0)
    expect(result.opponents).toHaveLength(1)
  })

  it('handles missing trophyChange', () => {
    const entry = makeBattleEntry()
    delete entry.battle.trophyChange
    const result = parseBattle(entry, PLAYER_TAG)
    expect(result.trophy_change).toBe(0)
  })

  it('uses event.mode as fallback when battle.mode is empty', () => {
    const entry = makeBattleEntry()
    entry.battle.mode = ''
    const result = parseBattle(entry, PLAYER_TAG)
    expect(result.mode).toBe('brawlBall')
  })

  it('returns null if player not found in battle', () => {
    const result = parseBattle(makeBattleEntry(), '#NOTINBATTLE')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/unit/lib/battle-parser.test.ts`

Expected: FAIL — module `@/lib/battle-parser` not found.

- [ ] **Step 3: Implement battle parser**

```typescript
// src/lib/battle-parser.ts
import type { BattlelogEntry } from '@/lib/api'
import type { BattleInsert, BrawlerJsonb, TeammateJsonb } from '@/lib/supabase/types'

/**
 * Convert Supercell battleTime format "20260405T171604.000Z"
 * to ISO 8601 "2026-04-05T17:16:04.000Z"
 */
export function parseBattleTime(raw: string): string {
  const y = raw.slice(0, 4)
  const m = raw.slice(4, 6)
  const d = raw.slice(6, 8)
  const rest = raw.slice(8) // "T171604.000Z" or "T171604Z"
  const h = rest.slice(1, 3)
  const min = rest.slice(3, 5)
  const sec = rest.slice(5, 7)
  return `${y}-${m}-${d}T${h}:${min}:${sec}.000Z`
}

interface BattlePlayer {
  tag: string
  name: string
  brawler: { id: number; name: string; power: number; trophies: number }
}

function toBrawlerJsonb(player: BattlePlayer): BrawlerJsonb {
  return {
    id: player.brawler.id,
    name: player.brawler.name,
    power: player.brawler.power,
    trophies: player.brawler.trophies,
    gadgets: [],
    starPowers: [],
    hypercharges: [],
  }
}

function toTeammateJsonb(player: BattlePlayer): TeammateJsonb {
  return {
    tag: player.tag,
    name: player.name,
    brawler: {
      id: player.brawler.id,
      name: player.brawler.name,
      power: player.brawler.power,
      trophies: player.brawler.trophies,
    },
  }
}

/**
 * Parse a single BattlelogEntry into a database-ready BattleInsert.
 * Returns null if the player is not found in the battle.
 */
export function parseBattle(entry: BattlelogEntry, playerTag: string): BattleInsert | null {
  const battle = entry.battle
  const mode = battle.mode || entry.event.mode
  const map = entry.event.map || null

  // Find the player in teams or players array
  let myPlayer: BattlePlayer | null = null
  let teammates: BattlePlayer[] = []
  let opponents: BattlePlayer[] = []

  if (battle.teams) {
    // Team mode (3v3, 5v5, etc.)
    for (let teamIdx = 0; teamIdx < battle.teams.length; teamIdx++) {
      const team = battle.teams[teamIdx]
      const playerInTeam = team.find(p => p.tag === playerTag)

      if (playerInTeam) {
        myPlayer = playerInTeam
        teammates = team.filter(p => p.tag !== playerTag)
        // All other teams are opponents
        for (let otherIdx = 0; otherIdx < battle.teams.length; otherIdx++) {
          if (otherIdx !== teamIdx) {
            opponents.push(...battle.teams[otherIdx])
          }
        }
        break
      }
    }
  } else if (battle.players) {
    // Solo mode (showdown, duels)
    const playerInList = battle.players.find(p => p.tag === playerTag)
    if (playerInList) {
      myPlayer = playerInList
      opponents = battle.players.filter(p => p.tag !== playerTag)
    }
  }

  if (!myPlayer) return null

  const isStarPlayer = battle.starPlayer?.tag === playerTag

  return {
    player_tag: playerTag,
    battle_time: parseBattleTime(entry.battleTime),
    mode,
    map,
    result: battle.result,
    trophy_change: battle.trophyChange ?? 0,
    duration: battle.duration ?? null,
    is_star_player: isStarPlayer,
    my_brawler: toBrawlerJsonb(myPlayer),
    teammates: teammates.map(toTeammateJsonb),
    opponents: opponents.map(toTeammateJsonb),
  }
}

/**
 * Parse all battles from a battlelog response.
 * Skips entries where the player is not found.
 */
export function parseBattlelog(entries: BattlelogEntry[], playerTag: string): BattleInsert[] {
  const results: BattleInsert[] = []
  for (const entry of entries) {
    const parsed = parseBattle(entry, playerTag)
    if (parsed) results.push(parsed)
  }
  return results
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/unit/lib/battle-parser.test.ts`

Expected: PASS — all 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle-parser.ts src/__tests__/unit/lib/battle-parser.test.ts
git commit -m "feat: battle data parser — transforms Supercell API into DB rows"
```

---

### Task 3: Battle Sync Logic

**Files:**
- Create: `src/lib/battle-sync.ts`
- Test: `src/__tests__/unit/lib/battle-sync.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/unit/lib/battle-sync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncBattles } from '@/lib/battle-sync'
import type { BattleInsert } from '@/lib/supabase/types'

const mockUpsert = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn()
const mockSupabase = { from: mockFrom }

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

vi.mock('@/lib/api', () => ({
  fetchBattlelog: vi.fn().mockResolvedValue({ items: [] }),
}))

const MOCK_BATTLE: BattleInsert = {
  player_tag: '#YJU282PV',
  battle_time: '2026-04-05T17:16:04.000Z',
  mode: 'brawlBall',
  map: 'Super Beach',
  result: 'victory',
  trophy_change: 8,
  duration: 120,
  is_star_player: true,
  my_brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 750, gadgets: [], starPowers: [], hypercharges: [] },
  teammates: [],
  opponents: [],
}

describe('syncBattles', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('inserts parsed battles with ON CONFLICT DO NOTHING', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({
      items: [{
        battleTime: '20260405T171604.000Z',
        event: { id: 1, mode: 'brawlBall', modeId: 2, map: 'Super Beach' },
        battle: {
          mode: 'brawlBall', type: 'ranked', result: 'victory', duration: 120,
          trophyChange: 8,
          starPlayer: { tag: '#YJU282PV', name: 'Test', brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 750 } },
          teams: [[{ tag: '#YJU282PV', name: 'Test', brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 750 } }], []],
        },
      }],
      paging: { cursors: {} },
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'battles') return { upsert: mockUpsert.mockResolvedValue({ error: null, count: 1 }) }
      if (table === 'profiles') return { update: mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
      return {}
    })

    const result = await syncBattles('#YJU282PV')
    expect(result.inserted).toBe(1)
    expect(mockUpsert).toHaveBeenCalledTimes(1)
  })

  it('returns 0 inserted when no battles found', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({ items: [], paging: { cursors: {} } })

    const result = await syncBattles('#YJU282PV')
    expect(result.inserted).toBe(0)
  })

  it('updates last_sync on profiles after successful sync', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({ items: [], paging: { cursors: {} } })

    const eqMock = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return { update: vi.fn().mockReturnValue({ eq: eqMock }) }
      return {}
    })

    await syncBattles('#YJU282PV')
    expect(eqMock).toHaveBeenCalledWith('player_tag', '#YJU282PV')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/unit/lib/battle-sync.test.ts`

Expected: FAIL — module `@/lib/battle-sync` not found.

- [ ] **Step 3: Implement battle sync**

```typescript
// src/lib/battle-sync.ts
import { createServiceClient } from '@/lib/supabase/server'
import { fetchBattlelog } from '@/lib/api'
import { parseBattlelog } from '@/lib/battle-parser'

export interface SyncResult {
  playerTag: string
  fetched: number
  inserted: number
  error: string | null
}

/**
 * Fetch the latest battlelog from Supercell API, parse battles,
 * and insert into the database with deduplication.
 * Uses service role client (bypasses RLS).
 */
export async function syncBattles(playerTag: string): Promise<SyncResult> {
  const supabase = await createServiceClient()

  // 1. Fetch from Supercell API
  const response = await fetchBattlelog(playerTag)
  const entries = response.items ?? []

  if (entries.length === 0) {
    // Still update last_sync to avoid re-queuing immediately
    await supabase
      .from('profiles')
      .update({ last_sync: new Date().toISOString() })
      .eq('player_tag', playerTag)

    return { playerTag, fetched: 0, inserted: 0, error: null }
  }

  // 2. Parse into database rows
  const parsed = parseBattlelog(entries, playerTag)

  // 3. Insert with deduplication (ON CONFLICT DO NOTHING)
  const { error, count } = await supabase
    .from('battles')
    .upsert(parsed, {
      onConflict: 'player_tag,battle_time',
      ignoreDuplicates: true,
      count: 'exact',
    })

  if (error) {
    return { playerTag, fetched: entries.length, inserted: 0, error: error.message }
  }

  // 4. Update last_sync timestamp
  await supabase
    .from('profiles')
    .update({ last_sync: new Date().toISOString() })
    .eq('player_tag', playerTag)

  return { playerTag, fetched: entries.length, inserted: count ?? parsed.length, error: null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/unit/lib/battle-sync.test.ts`

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle-sync.ts src/__tests__/unit/lib/battle-sync.test.ts
git commit -m "feat: battle sync logic — fetch, parse, dedup insert, update last_sync"
```

---

### Task 4: Manual Sync API Route

**Files:**
- Create: `src/app/api/sync/route.ts`
- Test: `src/__tests__/integration/api/sync.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/integration/api/sync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/sync/route'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
  createServiceClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null, count: 0 }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
  }),
}))

vi.mock('@/lib/api', () => ({
  fetchBattlelog: vi.fn().mockResolvedValue({ items: [], paging: { cursors: {} } }),
}))

vi.mock('@/lib/battle-sync', () => ({
  syncBattles: vi.fn().mockResolvedValue({ playerTag: '#TAG', fetched: 5, inserted: 3, error: null }),
}))

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/sync', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is free tier', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'uid1', player_tag: '#TAG', tier: 'free', ls_subscription_status: null },
            error: null,
          }),
        }),
      }),
    })
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(403)
  })

  it('returns 200 and sync result for premium user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'uid1', player_tag: '#TAG', tier: 'premium', ls_subscription_status: 'active' },
            error: null,
          }),
        }),
      }),
    })

    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.inserted).toBe(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/integration/api/sync.test.ts`

Expected: FAIL — module `@/app/api/sync/route` not found.

- [ ] **Step 3: Implement sync API route**

```typescript
// src/app/api/sync/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPremium } from '@/lib/auth'
import { syncBattles } from '@/lib/battle-sync'
import type { Profile } from '@/lib/supabase/types'

export async function POST() {
  // 1. Authenticate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // 2. Get profile + verify ownership and tier
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!isPremium(profile as Profile)) {
    return NextResponse.json({ error: 'Premium subscription required' }, { status: 403 })
  }

  // 3. Sync battles
  const result = await syncBattles(profile.player_tag)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  return NextResponse.json(result)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/integration/api/sync.test.ts`

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/sync/route.ts src/__tests__/integration/api/sync.test.ts
git commit -m "feat: manual sync API route — auth + premium check + sync"
```

---

### Task 5: Supabase Edge Function (sync-worker)

**Files:**
- Create: `supabase/functions/sync-worker/index.ts`

- [ ] **Step 1: Create supabase functions directory**

Run: `mkdir -p supabase/functions/sync-worker`

- [ ] **Step 2: Create the Edge Function**

```typescript
// supabase/functions/sync-worker/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPERCELL_API_BASE = Deno.env.get('BRAWLSTARS_API_URL') || 'http://141.253.197.60:3001/v1'
const SUPERCELL_API_KEY = Deno.env.get('BRAWLSTARS_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface BattlePlayer {
  tag: string
  name: string
  brawler: { id: number; name: string; power: number; trophies: number }
}

function parseBattleTime(raw: string): string {
  const y = raw.slice(0, 4), m = raw.slice(4, 6), d = raw.slice(6, 8)
  const h = raw.slice(9, 11), min = raw.slice(11, 13), sec = raw.slice(13, 15)
  return `${y}-${m}-${d}T${h}:${min}:${sec}.000Z`
}

function findPlayer(battle: Record<string, unknown>, tag: string) {
  const teams = battle.teams as BattlePlayer[][] | undefined
  const players = battle.players as BattlePlayer[] | undefined

  if (teams) {
    for (let i = 0; i < teams.length; i++) {
      const p = teams[i].find(x => x.tag === tag)
      if (p) {
        const teammates = teams[i].filter(x => x.tag !== tag)
        const opponents: BattlePlayer[] = []
        for (let j = 0; j < teams.length; j++) {
          if (j !== i) opponents.push(...teams[j])
        }
        return { player: p, teammates, opponents }
      }
    }
  } else if (players) {
    const p = players.find(x => x.tag === tag)
    if (p) return { player: p, teammates: [], opponents: players.filter(x => x.tag !== tag) }
  }
  return null
}

async function processTag(playerTag: string): Promise<{ fetched: number; inserted: number }> {
  const encoded = encodeURIComponent(playerTag)
  const res = await fetch(`${SUPERCELL_API_BASE}/players/${encoded}/battlelog`, {
    headers: { Authorization: `Bearer ${SUPERCELL_API_KEY}`, Accept: 'application/json' },
  })

  if (!res.ok) throw new Error(`Supercell API ${res.status}`)
  const data = await res.json()
  const items = data.items ?? []
  if (items.length === 0) return { fetched: 0, inserted: 0 }

  const rows = []
  for (const entry of items) {
    const found = findPlayer(entry.battle, playerTag)
    if (!found) continue

    rows.push({
      player_tag: playerTag,
      battle_time: parseBattleTime(entry.battleTime),
      mode: entry.battle.mode || entry.event?.mode || 'unknown',
      map: entry.event?.map || null,
      result: entry.battle.result,
      trophy_change: entry.battle.trophyChange ?? 0,
      duration: entry.battle.duration ?? null,
      is_star_player: entry.battle.starPlayer?.tag === playerTag,
      my_brawler: {
        id: found.player.brawler.id,
        name: found.player.brawler.name,
        power: found.player.brawler.power,
        trophies: found.player.brawler.trophies,
        gadgets: [], starPowers: [], hypercharges: [],
      },
      teammates: found.teammates.map((t: BattlePlayer) => ({
        tag: t.tag, name: t.name,
        brawler: { id: t.brawler.id, name: t.brawler.name, power: t.brawler.power, trophies: t.brawler.trophies },
      })),
      opponents: found.opponents.map((o: BattlePlayer) => ({
        tag: o.tag, name: o.name,
        brawler: { id: o.brawler.id, name: o.brawler.name, power: o.brawler.power, trophies: o.brawler.trophies },
      })),
    })
  }

  if (rows.length > 0) {
    await supabase.from('battles').upsert(rows, { onConflict: 'player_tag,battle_time', ignoreDuplicates: true })
  }

  await supabase.from('profiles').update({ last_sync: new Date().toISOString() }).eq('player_tag', playerTag)

  return { fetched: items.length, inserted: rows.length }
}

Deno.serve(async (req) => {
  try {
    // Claim up to 5 pending jobs
    const { data: jobs, error: claimErr } = await supabase.rpc('claim_sync_jobs', { batch_size: 5 })

    if (claimErr || !jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { 'Content-Type': 'application/json' } })
    }

    const results = []
    for (const job of jobs) {
      try {
        const result = await processTag(job.player_tag)
        await supabase.from('sync_queue').update({ completed_at: new Date().toISOString() }).eq('id', job.id)
        results.push({ tag: job.player_tag, ...result })
      } catch (err) {
        await supabase.from('sync_queue').update({ error: String(err) }).eq('id', job.id)
        results.push({ tag: job.player_tag, error: String(err) })
      }

      // Rate limit: 200ms between tags
      await new Promise(r => setTimeout(r, 200))
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
```

- [ ] **Step 3: Create the claim_sync_jobs RPC function in Supabase**

Run in Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION claim_sync_jobs(batch_size INT DEFAULT 5)
RETURNS SETOF sync_queue
LANGUAGE sql
AS $$
  UPDATE sync_queue
  SET started_at = NOW()
  WHERE id IN (
    SELECT id FROM sync_queue
    WHERE started_at IS NULL
      AND completed_at IS NULL
      AND retry_count < 3
    ORDER BY scheduled_at
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: Edge Function sync-worker + claim_sync_jobs RPC"
```

---

### Task 6: pg_cron Scheduler Configuration

**Files:**
- None (SQL executed in Supabase Dashboard)

- [ ] **Step 1: Enable pg_cron extension**

In Supabase Dashboard → Database → Extensions → search "pg_cron" → Enable.

Also enable `pg_net` for HTTP calls from SQL:

Database → Extensions → search "pg_net" → Enable.

- [ ] **Step 2: Create scheduler job**

Run in SQL Editor:

```sql
-- Enqueue premium users who need syncing (every minute, LIMIT 50)
SELECT cron.schedule(
  'enqueue-premium-syncs',
  '* * * * *',
  $$
    -- Reset stale jobs
    UPDATE sync_queue
    SET started_at = NULL, retry_count = retry_count + 1
    WHERE started_at < NOW() - INTERVAL '10 minutes'
      AND completed_at IS NULL
      AND retry_count < 3;

    -- Enqueue new syncs
    INSERT INTO sync_queue (player_tag)
    SELECT player_tag FROM profiles
    WHERE tier IN ('premium', 'pro')
      AND (last_sync IS NULL OR last_sync < NOW() - INTERVAL '1 hour')
      AND player_tag NOT IN (
        SELECT player_tag FROM sync_queue
        WHERE completed_at IS NULL
      )
    LIMIT 50;
  $$
);
```

- [ ] **Step 3: Create worker trigger job**

```sql
-- Trigger the Edge Function to process queue (every minute)
SELECT cron.schedule(
  'process-sync-queue',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT current_setting('app.settings.supabase_url') || '/functions/v1/sync-worker'),
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      )
    );
  $$
);
```

Note: `app.settings.supabase_url` and `app.settings.service_role_key` must be configured in Supabase Dashboard → Settings → Database → Custom config, or replace with literal values.

- [ ] **Step 4: Verify cron jobs are registered**

Run in SQL Editor:

```sql
SELECT * FROM cron.job;
```

Expected: 2 rows — `enqueue-premium-syncs` and `process-sync-queue`.

---

### Task 7: Deploy Edge Function

**Files:**
- None (CLI deployment)

- [ ] **Step 1: Install Supabase CLI (if not installed)**

Run: `npm install -g supabase`

- [ ] **Step 2: Link project**

Run: `supabase link --project-ref <your-project-ref>`

- [ ] **Step 3: Set Edge Function secrets**

```bash
supabase secrets set BRAWLSTARS_API_KEY=<your-key>
supabase secrets set BRAWLSTARS_API_URL=http://141.253.197.60:3001/v1
```

- [ ] **Step 4: Deploy the function**

Run: `supabase functions deploy sync-worker`

Expected: Function deployed successfully.

- [ ] **Step 5: Test the function manually**

```bash
curl -X POST "https://<project>.supabase.co/functions/v1/sync-worker" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `{"processed": 0}` (no jobs in queue yet).

---

### Task 8: Premium Sync Indicator in Header

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add sync indicator for premium users**

In `Header.tsx`, after the player tag pill, add a last-sync indicator for premium users. Inside the `<div className="flex items-center gap-4">` block, after the `playerTag` span:

```tsx
{/* Premium sync indicator */}
{!loading && user && profile?.tier !== 'free' && profile?.last_sync && (
  <span className="text-[10px] text-slate-500 font-semibold hidden md:inline-block">
    {t('lastSync')}: {formatTimeAgo(profile.last_sync)}
  </span>
)}
```

Add this helper function at the top of the file (after imports):

```typescript
function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '<1 min'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}
```

- [ ] **Step 2: Update manual sync to call sync API for premium users**

In `handleSync`, differentiate between cache-clear (free) and API sync (premium):

```typescript
const handleSync = async () => {
  setSyncing(true)

  if (user && profile && isPremium(profile as Profile)) {
    // Premium: call sync API
    try {
      await fetch('/api/sync', { method: 'POST' })
    } catch { /* ignore */ }
  }

  // Always clear local cache
  try {
    const keysToKeep = ['brawlvalue:user']
    const keysToKeepPrefixes = ['brawlvalue:skins:']
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith('brawlvalue:') && !keysToKeep.includes(key) && !keysToKeepPrefixes.some(p => key.startsWith(p))) {
        localStorage.removeItem(key)
      }
    }
  } catch { /* ignore */ }

  window.location.reload()
}
```

Add the `isPremium` import:
```typescript
import { isPremium } from '@/lib/auth'
import type { Profile } from '@/lib/supabase/types'
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: premium sync indicator + manual sync calls API"
```

---

### Task 9: i18n for Sync Strings

**Files:**
- Modify: all 13 files in `messages/*.json`

- [ ] **Step 1: Add lastSync key to nav namespace**

Run:

```bash
node -e "
const fs = require('fs');
const path = require('path');

const STRINGS = {
  es: 'Última sincr.',
  en: 'Last sync',
  fr: 'Dernière synchro.',
  pt: 'Última sinc.',
  de: 'Letzte Synch.',
  it: 'Ultima sinc.',
  ru: 'Послед. синхр.',
  tr: 'Son senk.',
  pl: 'Ostatnia synch.',
  ar: 'آخر مزامنة',
  ko: '마지막 동기화',
  ja: '最終同期',
  zh: '上次同步',
};

const dir = path.join(__dirname, 'messages');
for (const [locale, text] of Object.entries(STRINGS)) {
  const filePath = path.join(dir, locale + '.json');
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  content.nav.lastSync = text;
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\\n');
}
console.log('Done: lastSync added to all 13 locales');
"
```

- [ ] **Step 2: Commit**

```bash
git add messages/
git commit -m "i18n: add lastSync to nav namespace (13 locales)"
```

---

### Task 10: Full Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`

Expected: All tests pass, including new ones:
- `unit/lib/battle-parser.test.ts` (10 tests)
- `unit/lib/battle-sync.test.ts` (3 tests)
- `integration/api/sync.test.ts` (3 tests)

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Final commit if fixes needed**

```bash
git add -A
git commit -m "chore: fix lint/type/build issues from Plan 2"
```
