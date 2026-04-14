import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Integration test for the per-(map, mode) cumulative balancing cron.
 *
 * The cron fetches candidate pools from multiple country rankings,
 * dedupes into an ordered list, preloads 14-day cumulative counts
 * from meta_stats, fetches the live events rotation, and filters
 * battles by dynamically-recomputed `(map, mode)` targets.
 *
 * This test mocks Supercell API + Supabase layer and uses shrunken
 * constants so the scaling behaviour can be verified in tens of
 * players instead of thousands.
 */

// ── Shrunk constants for deterministic, fast tests ─────────────
vi.mock('@/lib/draft/constants', async () => {
  const actual = await vi.importActual<typeof import('@/lib/draft/constants')>(
    '@/lib/draft/constants',
  )
  return {
    ...actual,
    META_POLL_DELAY_MS: 0,
    META_POLL_MAX_DEPTH: 30,
    META_POLL_MIN_TARGET: 5,
    // META_POLL_TARGET_RATIO stays at 0.6
    // META_POLL_RANKING_COUNTRIES kept from real list so mock covers them all
  }
})

// ── Supabase mock ───────────────────────────────────────────────
type QueuedResponse = { data: unknown; error?: unknown }
const queueByTable: Record<string, QueuedResponse[]> = {}
const rpcCalls: Array<{ fn: string; payload: unknown }> = []
const rpcResponses: Record<string, unknown> = {}

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
  if (fn in rpcResponses) {
    return { data: rpcResponses[fn], error: null }
  }
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
  modeId?: number
  map: string
  result: 'victory' | 'defeat'
}

const battlelogByTag: Record<string, BattleFixture[]> = {}
const rankingByCountry: Record<string, string[]> = {}
let rotationFixture: Array<{ map: string; mode: string; modeId?: number }> = []

vi.mock('@/lib/api', () => ({
  fetchPlayerRankings: vi.fn(async (region: string, limit: number) => ({
    items: (rankingByCountry[region] ?? []).slice(0, limit).map(tag => ({ tag })),
  })),
  fetchBattlelog: vi.fn(async (tag: string) => {
    const entries = battlelogByTag[tag] ?? []
    return {
      items: entries.map(e => ({
        battleTime: e.battleTime,
        event: { id: 1, mode: e.mode, modeId: e.modeId ?? 0, map: e.map },
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
  fetchEventRotation: vi.fn(async () =>
    rotationFixture.map(r => ({
      startTime: '',
      endTime: '',
      slotId: 0,
      event: { id: 0, mode: r.mode, modeId: r.modeId ?? 0, map: r.map },
    })),
  ),
}))

process.env.CRON_SECRET = 'test-cron-secret'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost/supabase'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'

import { GET } from '@/app/api/cron/meta-poll/route'

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
  opts: { mode: string; modeId?: number; map: string; result: 'victory' | 'defeat' },
) {
  if (!battlelogByTag[tag]) battlelogByTag[tag] = []
  battlelogByTag[tag].push({
    battleTime: battleTime(battleSeq++),
    mode: opts.mode,
    modeId: opts.modeId,
    map: opts.map,
    result: opts.result,
  })
}

/** Put a list of tags under `global` ranking (other countries empty). */
function setGlobalRanking(tags: string[]) {
  for (const k of Object.keys(rankingByCountry)) delete rankingByCountry[k]
  rankingByCountry.global = tags
}

beforeEach(() => {
  for (const k of Object.keys(queueByTable)) delete queueByTable[k]
  for (const k of Object.keys(battlelogByTag)) delete battlelogByTag[k]
  for (const k of Object.keys(rankingByCountry)) delete rankingByCountry[k]
  for (const k of Object.keys(rpcResponses)) delete rpcResponses[k]
  rotationFixture = []
  rpcCalls.length = 0
  battleSeq = 0
  fromMock.mockClear()
  rpcMock.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

// ── Tests ───────────────────────────────────────────────────────

describe('GET /api/cron/meta-poll — cumulative per-(map, mode) balancing', () => {
  it('returns 401 when the cron secret header is missing or wrong', async () => {
    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(401)

    const res2 = await GET(makeRequest('Bearer wrong-secret') as unknown as Parameters<typeof GET>[0])
    expect(res2.status).toBe(401)
  })

  it('processes every player when all live pairs start at zero', async () => {
    // 5 players in global, each plays 1 brawlBall battle on Sneaky Fields.
    // Rotation: Sneaky Fields brawlBall + Hyperspace brawlHockey (so the
    // filter knows both are valid live targets).
    // Target = max(5, 0 × 0.6) = 5. Sneaky Fields stays under-target
    // until it hits 5.
    setGlobalRanking([playerTag(1), playerTag(2), playerTag(3), playerTag(4), playerTag(5)])
    for (let i = 1; i <= 5; i++) {
      addBattle(playerTag(i), { mode: 'brawlBall', map: 'Sneaky Fields', result: 'victory' })
    }
    rotationFixture = [
      { map: 'Sneaky Fields', mode: 'brawlBall' },
      { map: 'Hyperspace', mode: 'brawlHockey', modeId: 45 },
    ]

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.battlesProcessed).toBe(5)
    expect(body.adaptive.finalCountsByMapMode['Sneaky Fields|brawlBall']).toBe(5)
    // Hyperspace stays at 0 because no player played it, but it WAS live
    expect(body.adaptive.liveKeyCount).toBe(2)
  })

  it('drops battles on over-target live pairs (the cumulative preload wins)', async () => {
    // Preload says Sneaky Fields brawlBall already has 1000 battles
    // cumulative. Target = max(5, 1000 × 0.6) = 600. Sneaky Fields is
    // OVER target immediately and stays that way for the whole run.
    // Players trying to deposit brawlBall battles get them REJECTED.
    rpcResponses.sum_meta_stats_by_map_mode = [
      { map: 'Sneaky Fields', mode: 'brawlBall', total: 1000 },
      { map: 'Hyperspace', mode: 'brawlHockey', total: 0 },
    ]
    setGlobalRanking([playerTag(1), playerTag(2), playerTag(3)])
    for (let i = 1; i <= 3; i++) {
      addBattle(playerTag(i), { mode: 'brawlBall', map: 'Sneaky Fields', result: 'victory' })
    }
    rotationFixture = [
      { map: 'Sneaky Fields', mode: 'brawlBall' },
      { map: 'Hyperspace', mode: 'brawlHockey', modeId: 45 },
    ]

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    // Every brawlBall battle was rejected — 0 kept this run
    expect(body.battlesProcessed).toBe(0)
    // Cumulative total stays at 1000 (preload) — no this-run additions
    expect(body.adaptive.finalCountsByMapMode['Sneaky Fields|brawlBall']).toBe(1000)
  })

  it('KEEPS battles on under-target live pairs even when other pairs are saturated', async () => {
    // Mixed scenario: Sneaky Fields is over target, Hyperspace is under.
    // Players 1-3 play brawlBall only → rejected.
    // Players 4-6 play brawlHockey → kept.
    rpcResponses.sum_meta_stats_by_map_mode = [
      { map: 'Sneaky Fields', mode: 'brawlBall', total: 1000 },
    ]
    setGlobalRanking([playerTag(1), playerTag(2), playerTag(3), playerTag(4), playerTag(5), playerTag(6)])
    for (let i = 1; i <= 3; i++) {
      addBattle(playerTag(i), { mode: 'brawlBall', map: 'Sneaky Fields', result: 'victory' })
    }
    for (let i = 4; i <= 6; i++) {
      addBattle(playerTag(i), { mode: 'brawlHockey', modeId: 45, map: 'Hyperspace', result: 'victory' })
    }
    rotationFixture = [
      { map: 'Sneaky Fields', mode: 'brawlBall' },
      { map: 'Hyperspace', mode: 'brawlHockey', modeId: 45 },
    ]

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    // Only the 3 Hyperspace battles survived the filter
    expect(body.battlesProcessed).toBe(3)
    expect(body.adaptive.finalCountsByMapMode['Hyperspace|brawlHockey']).toBe(3)
    // brawlBall cumulative stays at the preload value, untouched
    expect(body.adaptive.finalCountsByMapMode['Sneaky Fields|brawlBall']).toBe(1000)
  })

  it('early-exits once every live pair reaches target', async () => {
    // Target floor is 5. 10 players, each plays 1 Sneaky Fields brawlBall
    // battle. As soon as Sneaky Fields hits 5, it stops being under-target.
    // Other live pairs are also at 0 → still under target → loop continues.
    // But if the ONLY live pair is Sneaky Fields and it hits 5, underTarget
    // becomes empty → early exit.
    setGlobalRanking(Array.from({ length: 10 }, (_, i) => playerTag(i + 1)))
    for (let i = 1; i <= 10; i++) {
      addBattle(playerTag(i), { mode: 'brawlBall', map: 'Sneaky Fields', result: 'victory' })
    }
    rotationFixture = [{ map: 'Sneaky Fields', mode: 'brawlBall' }]

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.battlesProcessed).toBe(5)
    expect(body.adaptive.finalCountsByMapMode['Sneaky Fields|brawlBall']).toBe(5)
    expect(body.adaptive.earlyExit).toBe(true)
    // Only 5 players were polled before the loop bailed
    expect(body.adaptive.playersPolled).toBe(5)
  })

  it('stops at META_POLL_MAX_DEPTH even when pairs remain under-target', async () => {
    // 40 players all playing Hyperspace brawlHockey. Target stays at
    // min-floor 5. Hyperspace grows by 1 per player. It hits 5 after
    // 5 players (early exit). If we make the target unreachable by
    // seeding high, the cap should apply.
    rpcResponses.sum_meta_stats_by_map_mode = [
      { map: 'Sneaky Fields', mode: 'brawlBall', total: 10000 },
    ]
    setGlobalRanking(Array.from({ length: 40 }, (_, i) => playerTag(i + 1)))
    for (let i = 1; i <= 40; i++) {
      addBattle(playerTag(i), { mode: 'brawlHockey', modeId: 45, map: 'Hyperspace', result: 'victory' })
    }
    rotationFixture = [
      { map: 'Sneaky Fields', mode: 'brawlBall' },
      { map: 'Hyperspace', mode: 'brawlHockey', modeId: 45 },
    ]

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    // Cap enforces 30 players max even though 40 are in pool
    expect(body.adaptive.playersPolled).toBe(30)
    // Every processed player contributed 1 hockey battle → 30 kept
    expect(body.battlesProcessed).toBe(30)
    expect(body.adaptive.earlyExit).toBe(false)
  })

  it('respects cursors: battles before the cursor are skipped', async () => {
    setGlobalRanking([playerTag(1)])

    // Two battles. Cursor sits between them → only the later one survives.
    addBattle(playerTag(1), { mode: 'brawlBall', map: 'Sneaky Fields', result: 'defeat' })  // seq 0
    addBattle(playerTag(1), { mode: 'brawlBall', map: 'Sneaky Fields', result: 'victory' }) // seq 1
    rotationFixture = [{ map: 'Sneaky Fields', mode: 'brawlBall' }]

    const base = new Date('2026-01-01T00:00:00.000Z').getTime()
    const cursorISO = new Date(base + 500).toISOString() // between seq 0 and seq 1

    enqueue('meta_poll_cursors', {
      data: [{ player_tag: playerTag(1), last_battle_time: cursorISO }],
    })

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.battlesProcessed).toBe(1)
    expect(body.adaptive.finalCountsByMapMode['Sneaky Fields|brawlBall']).toBe(1)
  })

  it('merges players from multiple country rankings, deduping on tag', async () => {
    // global has P1,P2; US has P2,P3; BR has P4
    // Unique ordered pool = [P1, P2, P3, P4] (insertion order)
    rankingByCountry.global = [playerTag(1), playerTag(2)]
    rankingByCountry.US = [playerTag(2), playerTag(3)]
    rankingByCountry.BR = [playerTag(4)]
    for (let i = 1; i <= 4; i++) {
      addBattle(playerTag(i), { mode: 'brawlBall', map: 'Sneaky Fields', result: 'victory' })
    }
    rotationFixture = [{ map: 'Sneaky Fields', mode: 'brawlBall' }]

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    // 4 unique players, but the target floor is 5 so all 4 are polled
    expect(body.adaptive.poolSize).toBe(4)
    // All 4 battles kept (still under the floor)
    expect(body.battlesProcessed).toBe(4)
  })

  it('prefers modeId over conflicting mode string (Hyperspace regression)', async () => {
    // The Supercell API ships Hyperspace battles with mode='brawlBall'
    // and modeId=45 (brawlHockey). The normalizer MUST trust the modeId
    // and classify the battle as brawlHockey::Hyperspace.
    setGlobalRanking([playerTag(1)])
    addBattle(playerTag(1), { mode: 'brawlBall', modeId: 45, map: 'Hyperspace', result: 'victory' })
    rotationFixture = [
      { map: 'Hyperspace', mode: 'brawlBall', modeId: 45 },  // rotation also ships the wrong name
    ]

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    // Must appear under brawlHockey, not brawlBall
    expect(body.adaptive.finalCountsByMapMode['Hyperspace|brawlHockey']).toBe(1)
    expect(body.adaptive.finalCountsByMapMode['Hyperspace|brawlBall']).toBeUndefined()
  })

  it('calls cleanup_map_mode_strays when the preload shows a stale mode for a live map', async () => {
    // Preload claims Hyperspace has rows under brawlBall (the old
    // mis-classification bug). Rotation says Hyperspace is currently
    // live under brawlHockey. The cron MUST detect this at runtime
    // and call cleanup_map_mode_strays to merge the stale rows.
    rpcResponses.sum_meta_stats_by_map_mode = [
      { map: 'Hyperspace', mode: 'brawlBall', total: 596 },
      { map: 'Hyperspace', mode: 'brawlHockey', total: 5 },
    ]
    setGlobalRanking([playerTag(1)])
    addBattle(playerTag(1), { mode: 'brawlHockey', modeId: 45, map: 'Hyperspace', result: 'victory' })
    rotationFixture = [
      { map: 'Hyperspace', mode: 'brawlHockey', modeId: 45 },
    ]

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    // The cleanup RPC was called with the right shape
    const cleanupCall = rpcCalls.find(c => c.fn === 'cleanup_map_mode_strays')
    expect(cleanupCall).toBeDefined()
    expect(cleanupCall?.payload).toEqual({
      p_map: 'Hyperspace',
      p_wrong_mode: 'brawlBall',
      p_canonical_mode: 'brawlHockey',
      p_source: 'global',
    })
    // The response body exposes the merged straggler for observability
    expect(body.adaptive.stragglersMerged).toHaveLength(1)
    expect(body.adaptive.stragglersMerged[0]).toMatchObject({
      map: 'Hyperspace',
      wrongMode: 'brawlBall',
      canonicalMode: 'brawlHockey',
    })
    // After cleanup, the in-memory state reflects the merged count
    // (596 + 5 = 601 battles under brawlHockey, no more brawlBall row)
    expect(body.adaptive.finalCountsByMapMode['Hyperspace|brawlHockey']).toBeGreaterThanOrEqual(601)
    expect(body.adaptive.finalCountsByMapMode['Hyperspace|brawlBall']).toBeUndefined()
  })

  it('does NOT call cleanup when every preloaded map matches the live rotation', async () => {
    rpcResponses.sum_meta_stats_by_map_mode = [
      { map: 'Sunny Soccer', mode: 'brawlBall', total: 400 },
      { map: 'Hyperspace', mode: 'brawlHockey', total: 100 },
    ]
    setGlobalRanking([playerTag(1)])
    addBattle(playerTag(1), { mode: 'brawlBall', map: 'Sunny Soccer', result: 'victory' })
    rotationFixture = [
      { map: 'Sunny Soccer', mode: 'brawlBall' },
      { map: 'Hyperspace', mode: 'brawlHockey', modeId: 45 },
    ]

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    const cleanupCall = rpcCalls.find(c => c.fn === 'cleanup_map_mode_strays')
    expect(cleanupCall).toBeUndefined()
    expect(body.adaptive.stragglersMerged).toEqual([])
  })

  it('calls the three bulk upsert RPCs when data is accumulated', async () => {
    setGlobalRanking([playerTag(1), playerTag(2)])
    for (const tag of [playerTag(1), playerTag(2)]) {
      addBattle(tag, { mode: 'brawlBall', map: 'Sneaky Fields', result: 'victory' })
    }
    rotationFixture = [{ map: 'Sneaky Fields', mode: 'brawlBall' }]

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    expect(res.status).toBe(200)

    const fns = rpcCalls.map(c => c.fn)
    // New RPC for the preload
    expect(fns).toContain('sum_meta_stats_by_map_mode')
    // Existing bulk upserts
    expect(fns).toContain('bulk_upsert_meta_stats')
    expect(fns).toContain('bulk_upsert_meta_matchups')
    expect(fns).toContain('bulk_upsert_meta_trios')
  })
})
