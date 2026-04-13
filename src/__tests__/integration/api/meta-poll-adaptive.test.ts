import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Integration test for the adaptive meta-poll cron.
 *
 * Mocks the Supercell API and Supabase layer, then uses shrunken
 * constants (BATCH=10, CHUNK=5, MAX_DEPTH=30, MIN_TARGET=5) so the
 * algorithm's scaling behaviour can be verified with tens of players
 * instead of hundreds — the logic is identical, the runtime is 100×
 * faster. This lets us exercise all four branches of the top-up
 * algorithm (base only, top-up triggered + resolved, top-up + cap,
 * cursor-based skip) without flaky timeouts.
 */

// ── Shrunk constants for deterministic, fast tests ─────────────

vi.mock('@/lib/draft/constants', async () => {
  const actual = await vi.importActual<typeof import('@/lib/draft/constants')>(
    '@/lib/draft/constants',
  )
  return {
    ...actual,
    META_POLL_DELAY_MS: 0,   // no throttle
    META_POLL_BATCH_SIZE: 10, // base batch
    META_POLL_MAX_DEPTH: 30,  // hard cap
    META_POLL_CHUNK_SIZE: 5,  // top-up chunk
    META_POLL_MIN_TARGET: 5,  // floor for target computation
    // META_POLL_TARGET_RATIO stays at the default 0.6
  }
})

// ── Supabase mock ───────────────────────────────────────────────

type QueuedResponse = { data: unknown; error?: unknown }
const queueByTable: Record<string, QueuedResponse[]> = {}
const rpcCalls: Array<{ fn: string; payload: unknown }> = []

function enqueue(table: string, response: QueuedResponse) {
  if (!queueByTable[table]) queueByTable[table] = []
  queueByTable[table].push(response)
}

function makeBuilder(response: QueuedResponse) {
  const methods = [
    'select', 'eq', 'gte', 'lte', 'lt', 'gt', 'in', 'order', 'limit', 'single', 'maybeSingle', 'upsert',
  ]
  const builder: Record<string, unknown> = {}
  for (const m of methods) builder[m] = () => builder
  builder.then = (resolve: (v: QueuedResponse) => unknown) => resolve(response)
  return builder
}

const fromMock = vi.fn((table: string) => {
  const queue = queueByTable[table]
  if (!queue || queue.length === 0) {
    return makeBuilder({ data: [] })
  }
  return makeBuilder(queue.shift()!)
})

const rpcMock = vi.fn(async (fn: string, payload: unknown) => {
  rpcCalls.push({ fn, payload })
  return { data: null, error: null }
})

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}))

// ── Supercell API mock ──────────────────────────────────────────

interface BattleFixture {
  battleTime: string
  mode: string
  map: string
  result: 'victory' | 'defeat'
}

const battlelogByTag: Record<string, BattleFixture[]> = {}
let rankingTags: string[] = []

vi.mock('@/lib/api', () => ({
  fetchPlayerRankings: vi.fn(async (_region: string, limit: number) => ({
    items: rankingTags.slice(0, limit).map(tag => ({ tag })),
  })),
  fetchBattlelog: vi.fn(async (tag: string) => {
    const entries = battlelogByTag[tag] ?? []
    return {
      items: entries.map(e => ({
        battleTime: e.battleTime,
        event: { id: 1, mode: e.mode, map: e.map },
        battle: {
          mode: e.mode,
          type: 'ranked',
          result: e.result,
          teams: [
            [
              { tag, brawler: { id: 16000000, name: 'A' } },
              { tag: `${tag}-ma`, brawler: { id: 16000001, name: 'B' } },
              { tag: `${tag}-mb`, brawler: { id: 16000002, name: 'C' } },
            ],
            [
              { tag: `${tag}-oa`, brawler: { id: 16000003, name: 'D' } },
              { tag: `${tag}-ob`, brawler: { id: 16000004, name: 'E' } },
              { tag: `${tag}-oc`, brawler: { id: 16000005, name: 'F' } },
            ],
          ],
        },
      })),
    }
  }),
}))

process.env.CRON_SECRET = 'test-cron-secret'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost/supabase'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'

import { GET } from '@/app/api/cron/meta-poll/route'
import { DRAFT_MODES } from '@/lib/draft/constants'

// ── Helpers ─────────────────────────────────────────────────────

function makeRequest(authHeader?: string) {
  return new Request('http://localhost/api/cron/meta-poll', {
    method: 'GET',
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

/** Supercell battleTime format is "YYYYMMDDTHHMMSS.000Z" (no dashes/colons) */
function battleTime(offsetSec: number): string {
  const base = new Date('2026-01-01T00:00:00.000Z').getTime()
  return new Date(base + offsetSec * 1000).toISOString().replace(/[-:]/g, '')
}

function playerTag(n: number): string {
  return `#P${String(n).padStart(3, '0')}`
}

let battleSeq = 0
function addBattle(
  tag: string,
  opts: { mode: string; map: string; result: 'victory' | 'defeat' },
) {
  if (!battlelogByTag[tag]) battlelogByTag[tag] = []
  battlelogByTag[tag].push({
    battleTime: battleTime(battleSeq++),
    mode: opts.mode,
    map: opts.map,
    result: opts.result,
  })
}

beforeEach(() => {
  for (const k of Object.keys(queueByTable)) delete queueByTable[k]
  for (const k of Object.keys(battlelogByTag)) delete battlelogByTag[k]
  rpcCalls.length = 0
  rankingTags = []
  battleSeq = 0
  fromMock.mockClear()
  rpcMock.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

// ── Tests ───────────────────────────────────────────────────────

describe('GET /api/cron/meta-poll — adaptive top-up algorithm', () => {
  it('returns 401 when the cron secret header is missing or wrong', async () => {
    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(401)

    const res2 = await GET(makeRequest('Bearer wrong-secret') as unknown as Parameters<typeof GET>[0])
    expect(res2.status).toBe(401)
  })

  it('runs only the base batch when every mode is already balanced', async () => {
    // 10 players, each plays every draft mode once → 10 battles per mode.
    // With MIN_TARGET=5 and ratio=0.6: target = max(5, 10*0.6) = 6.
    // Every mode has 10 ≥ 6 → no top-up needed.
    rankingTags = Array.from({ length: 10 }, (_, i) => playerTag(i + 1))
    for (const tag of rankingTags) {
      for (const mode of DRAFT_MODES) {
        addBattle(tag, { mode, map: `${mode}-map`, result: 'victory' })
      }
    }
    enqueue('meta_poll_cursors', { data: [] })

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.adaptive.iterationsRun).toBe(1)
    expect(body.adaptive.playersPolled).toBe(10)
    // Total battles = 10 players × 9 modes = 90
    expect(body.battlesProcessed).toBe(90)
    for (const mode of DRAFT_MODES) {
      expect(body.adaptive.finalCountsByMode[mode]).toBe(10)
    }
  })

  it('triggers top-up iterations when niche modes are under-sampled', async () => {
    // 20 players in the ranking.
    // Base (1-10): each plays 1 brawlBall → brawlBall=10, everything else=0.
    // Top-up pool (11-20): each plays 1 basketBrawl AND 1 brawlBall.
    //   - basketBrawl should be accepted (under-target).
    //   - brawlBall should be DISCARDED (already saturated).
    rankingTags = Array.from({ length: 20 }, (_, i) => playerTag(i + 1))

    for (let i = 0; i < 10; i++) {
      addBattle(rankingTags[i], { mode: 'brawlBall', map: 'Sidetrack', result: 'victory' })
    }
    for (let i = 10; i < 20; i++) {
      addBattle(rankingTags[i], { mode: 'basketBrawl', map: 'Dunk Zone', result: 'victory' })
      addBattle(rankingTags[i], { mode: 'brawlBall', map: 'Sidetrack', result: 'victory' })
    }

    enqueue('meta_poll_cursors', { data: [] })

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    // Top-up must have fired at least once
    expect(body.adaptive.iterationsRun).toBeGreaterThan(1)
    expect(body.adaptive.playersPolled).toBeGreaterThan(10)
    // brawlBall stays at 10 — top-up did NOT amplify it (saturated filter)
    expect(body.adaptive.finalCountsByMode.brawlBall).toBe(10)
    // basketBrawl got battles from players 11-20 during top-up
    expect(body.adaptive.finalCountsByMode.basketBrawl).toBeGreaterThan(0)
  })

  it('stops at META_POLL_MAX_DEPTH even when modes remain under-target', async () => {
    // 40 players, all playing brawlBall only. basketBrawl stays at 0
    // forever → under-target — algorithm must cap at MAX_DEPTH (30).
    rankingTags = Array.from({ length: 40 }, (_, i) => playerTag(i + 1))
    for (const tag of rankingTags) {
      addBattle(tag, { mode: 'brawlBall', map: 'Sidetrack', result: 'victory' })
    }
    enqueue('meta_poll_cursors', { data: [] })

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    // Cap enforces 30 players max even though 40 are available
    expect(body.adaptive.playersPolled).toBe(30)
    // basketBrawl never reached — no miracle top-up happened
    expect(body.adaptive.finalCountsByMode.basketBrawl ?? 0).toBe(0)
    // brawlBall is capped at 10 — top-up chunks polled players 11-30 but
    // discarded all their brawlBall battles (already saturated filter)
    expect(body.adaptive.finalCountsByMode.brawlBall).toBe(10)
  })

  it('respects cursors: battles already processed in a prior run are skipped', async () => {
    rankingTags = [playerTag(1)]

    // Two battles for this player. The cursor will point to a time
    // BETWEEN them so only the later one is counted.
    addBattle(playerTag(1), { mode: 'brawlBall', map: 'Sidetrack', result: 'defeat' }) // battleSeq=0
    addBattle(playerTag(1), { mode: 'brawlBall', map: 'Sidetrack', result: 'victory' }) // battleSeq=1

    // The cursor is expressed in ISO format (what parseBattleTime emits)
    // and sits between battle 0 and battle 1 — using offsetSec = 0.5 equivalent.
    const base = new Date('2026-01-01T00:00:00.000Z').getTime()
    const cursorISO = new Date(base + 500).toISOString() // 0.5s past base

    enqueue('meta_poll_cursors', {
      data: [{ player_tag: playerTag(1), last_battle_time: cursorISO }],
    })

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    // Only the battle at offsetSec=1 (AFTER the cursor) counts
    expect(body.battlesProcessed).toBe(1)
    expect(body.adaptive.finalCountsByMode.brawlBall).toBe(1)
  })

  it('calls the three bulk upsert RPCs when data is accumulated', async () => {
    rankingTags = [playerTag(1), playerTag(2)]
    for (const tag of rankingTags) {
      addBattle(tag, { mode: 'brawlBall', map: 'Sidetrack', result: 'victory' })
    }
    enqueue('meta_poll_cursors', { data: [] })

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    expect(res.status).toBe(200)

    const fns = rpcCalls.map(c => c.fn)
    expect(fns).toContain('bulk_upsert_meta_stats')
    expect(fns).toContain('bulk_upsert_meta_matchups')
    expect(fns).toContain('bulk_upsert_meta_trios')
  })
})
