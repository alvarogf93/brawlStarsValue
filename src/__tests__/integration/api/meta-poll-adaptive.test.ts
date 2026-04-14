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
    // META_POLL_PRELOAD_DAYS kept from real value (28)
    // META_POLL_RANKING_COUNTRIES kept from real list so mock covers them all
  }
})

// ── Supabase mock ───────────────────────────────────────────────
type QueuedResponse = { data: unknown; error?: unknown }
const queueByTable: Record<string, QueuedResponse[]> = {}
const rpcCalls: Array<{ fn: string; payload: unknown }> = []
const rpcResponses: Record<string, unknown> = {}
// Per-table capture of `.upsert()` arguments so integration tests can
// assert on the row/options shape, not just that the call happened.
const upsertCalls: Record<string, Array<{ row: unknown; options: unknown }>> = {}

function enqueue(table: string, response: QueuedResponse) {
  if (!queueByTable[table]) queueByTable[table] = []
  queueByTable[table].push(response)
}

function makeBuilder(response: QueuedResponse, table: string) {
  const readMethods = [
    'select', 'eq', 'gte', 'lte', 'lt', 'gt', 'in', 'order', 'limit', 'single', 'maybeSingle',
  ]
  const builder: Record<string, unknown> = {}
  for (const m of readMethods) builder[m] = () => builder
  builder.upsert = (row: unknown, options: unknown) => {
    if (!upsertCalls[table]) upsertCalls[table] = []
    upsertCalls[table].push({ row, options })
    return builder
  }
  builder.then = (resolve: (v: QueuedResponse) => unknown) => resolve(response)
  return builder
}

const fromMock = vi.fn((table: string) => {
  const queue = queueByTable[table]
  if (!queue || queue.length === 0) {
    return makeBuilder({ data: [] }, table)
  }
  return makeBuilder(queue.shift()!, table)
})

// Optional per-RPC error injection. Set `rpcErrors.bulk_upsert_meta_stats
// = { message: '...' }` in a test to force that RPC to return an error
// instead of data. Used to lock in the defensive-error-check behavior.
const rpcErrors: Record<string, { message: string } | undefined> = {}

const rpcMock = vi.fn(async (fn: string, payload: unknown) => {
  rpcCalls.push({ fn, payload })
  if (rpcErrors[fn]) {
    return { data: null, error: rpcErrors[fn] }
  }
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
  for (const k of Object.keys(rpcErrors)) delete rpcErrors[k]
  for (const k of Object.keys(upsertCalls)) delete upsertCalls[k]
  rotationFixture = []
  rpcCalls.length = 0
  battleSeq = 0
  fromMock.mockClear()
  rpcMock.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
  // Restore any vi.spyOn on globals (Math.random, etc.) so the next
  // test starts from a clean slate. Without this, a rng mock in one
  // test would leak into the next test's sampler and produce ghost
  // failures.
  vi.restoreAllMocks()
})

/** Install a deterministic Math.random that always returns the same
 *  value. Use `value = 0` to make every sampler call ACCEPT (because
 *  `rng() < rate` is always true for any rate > 0), or `value = 0.999`
 *  to make every sampler call REJECT except when rate = 1 exactly. */
function mockRandom(value: number) {
  vi.spyOn(Math, 'random').mockReturnValue(value)
}

// ── Tests ───────────────────────────────────────────────────────

describe('GET /api/cron/meta-poll — cumulative per-(map, mode) balancing', () => {
  it('returns 401 when the cron secret header is missing or wrong', async () => {
    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(401)

    const res2 = await GET(makeRequest('Bearer wrong-secret') as unknown as Parameters<typeof GET>[0])
    expect(res2.status).toBe(401)
  })

  it('accepts every battle when rng ≤ every sampler rate (rng=0 forces accept)', async () => {
    // 5 players in global, each plays 1 brawlBall battle on Sneaky Fields.
    // Rotation: Sneaky Fields brawlBall + Hyperspace brawlHockey.
    // With a pinned rng of 0, every `rng() < rate` check passes (for any
    // rate > 0), so the sampler accepts everything under the Sprint F
    // probabilistic model. This locks in the "rate > 0 ⇒ acceptable"
    // invariant that replaces the old binary under-target filter.
    mockRandom(0)
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
    // All 5 players polled (no early exit in the probabilistic model)
    expect(body.adaptive.playersPolled).toBe(5)
  })

  it('attenuates oversampled maps via low accept rate (rate ≈ 0.001 against rng=0.5)', async () => {
    // Preload says Sneaky Fields has 1000 cumulative battles and Hyperspace
    // has 0. For any sampler call on Sneaky Fields, minLive=0 (Hyperspace)
    // and rate = (0+1)/(1000+1) ≈ 0.001. With the rng pinned to 0.5, the
    // check `rng() < rate` is false → every Sneaky Fields battle is
    // attenuated away, same net effect as the old "over-target drop" path
    // but without a hard gate.
    mockRandom(0.5)
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
    // Every brawlBall battle was attenuated — 0 kept this run
    expect(body.battlesProcessed).toBe(0)
    // Cumulative total stays at 1000 (preload) — no this-run additions,
    // no deletions either (attenuation is a write-side decision).
    expect(body.adaptive.finalCountsByMapMode['Sneaky Fields|brawlBall']).toBe(1000)
    // All 3 players still polled — no early-exit by saturation
    expect(body.adaptive.playersPolled).toBe(3)
  })

  it('always accepts the scarcest live map (rate = 1) even when another is oversampled', async () => {
    // Mixed scenario: Sneaky Fields has 1000 preloaded, Hyperspace is 0.
    // Under the sampler: Hyperspace rate = (0+1)/(0+1) = 1.0 exactly,
    // so `rng() < 1` is true for any rng < 1 — always accepts. Sneaky
    // Fields rate = 1/1001 ≈ 0.001, so with rng=0.5 the check fails
    // and its battles are attenuated.
    mockRandom(0.5)
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
    // All 3 Hyperspace battles pass (rate = 1 for the scarce live map)
    expect(body.battlesProcessed).toBe(3)
    expect(body.adaptive.finalCountsByMapMode['Hyperspace|brawlHockey']).toBe(3)
    // brawlBall cumulative stays at the preload value, untouched
    expect(body.adaptive.finalCountsByMapMode['Sneaky Fields|brawlBall']).toBe(1000)
  })

  it('processes the entire pool — no early-exit in the probabilistic model', async () => {
    // Sprint F model has no "target reached → stop" short-circuit. When
    // the only live pair is Sneaky Fields and its count grows, the rate
    // stays 1 (minLive rises with it, so numerator == denominator). All
    // 10 players are polled, all 10 battles accepted with rng=0.
    mockRandom(0)
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
    // Every incoming battle accepted
    expect(body.battlesProcessed).toBe(10)
    expect(body.adaptive.finalCountsByMapMode['Sneaky Fields|brawlBall']).toBe(10)
    // All 10 players polled — the loop only stops by pool exhaustion
    // or wall-clock budget, never by "all pairs balanced"
    expect(body.adaptive.playersPolled).toBe(10)
    // finalMinLive reflects the raised floor after this run
    expect(body.adaptive.finalMinLive).toBe(10)
  })

  it('stops at META_POLL_MAX_DEPTH (pool cap), not before', async () => {
    // 40 players all playing Hyperspace brawlHockey. Preloaded Sneaky
    // Fields at 10000 is oversampled but Hyperspace stays the min
    // (rate=1 always), so every incoming hockey battle is accepted.
    // The ONLY stop condition (short of wall-clock) is the depth cap
    // at META_POLL_MAX_DEPTH=30 in the shrunken test constants.
    mockRandom(0)
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
    // Timebudget did NOT fire — we stopped at depth, not at wall-clock
    expect(body.adaptive.timeBudgetExit).toBe(false)
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

  it('DOES NOT call cleanup when the events rotation fetch fails', async () => {
    // Safety: the `effectiveLiveKeys` fallback (when rotationKeys is
    // empty) contains every preloaded key. If findMapModeStragglers
    // ran against that fallback, it could non-deterministically flag
    // Hyperspace|brawlBall OR Hyperspace|brawlHockey as the "wrong"
    // side depending on insertion order, and merge in the wrong
    // direction. The cron route must short-circuit straggler cleanup
    // when rotationKeys is empty.
    rpcResponses.sum_meta_stats_by_map_mode = [
      { map: 'Hyperspace', mode: 'brawlBall', total: 596 },
      { map: 'Hyperspace', mode: 'brawlHockey', total: 5 },
    ]
    setGlobalRanking([playerTag(1)])
    addBattle(playerTag(1), { mode: 'brawlBall', map: 'Some Map', result: 'victory' })
    rotationFixture = [] // rotation empty → cron must fall back + skip cleanup

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    // rotationAvailable must be false — surfaces the failure in the log
    expect(body.adaptive.rotationAvailable).toBe(false)
    // Cleanup MUST NOT have been called — the mis-classified rows
    // stay mis-classified until the rotation endpoint is healthy again
    expect(rpcCalls.find(c => c.fn === 'cleanup_map_mode_strays')).toBeUndefined()
    expect(body.adaptive.stragglersMerged).toEqual([])
    // Both rows still visible in the in-memory state
    expect(body.adaptive.finalCountsByMapMode['Hyperspace|brawlBall']).toBe(596)
    expect(body.adaptive.finalCountsByMapMode['Hyperspace|brawlHockey']).toBe(5)
  })

  it('exposes poolByCountry diagnostics in the response', async () => {
    rankingByCountry.global = [playerTag(1), playerTag(2)]
    rankingByCountry.US = [playerTag(3)] // 1 new unique
    rankingByCountry.BR = [playerTag(2)] // duplicate of global — 0 new unique
    for (let i = 1; i <= 3; i++) {
      addBattle(playerTag(i), { mode: 'brawlBall', map: 'Sneaky Fields', result: 'victory' })
    }
    rotationFixture = [{ map: 'Sneaky Fields', mode: 'brawlBall' }]

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.adaptive.poolByCountry).toEqual(
      expect.objectContaining({
        global: 2,
        US: 1,
        BR: 0, // dedup collapsed it
      }),
    )
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

  it('throws + skips heartbeat when bulk_upsert_meta_stats returns an error (defensive check)', async () => {
    // Regression test for the defensive error-check added in commit dc19059.
    // Supabase JS client does NOT throw on PostgREST errors — it returns
    // { data, error }. A handler that ignores `error` would silently lose
    // the write AND still write a phantom-success heartbeat. The fix
    // destructures `error` and throws, so the outer try/catch catches
    // the throw, returns 500, and the heartbeat (which lives AFTER the
    // try block) is skipped. A missing heartbeat is detectable by the
    // staleness check; a phantom-success is not.
    mockRandom(0)
    rpcErrors.bulk_upsert_meta_stats = { message: 'simulated: deadlock detected' }
    setGlobalRanking([playerTag(1)])
    addBattle(playerTag(1), { mode: 'brawlBall', map: 'Sneaky Fields', result: 'victory' })
    rotationFixture = [{ map: 'Sneaky Fields', mode: 'brawlBall' }]

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()

    // Route returned 500, with a message that surfaces the RPC name
    // AND the underlying error — easy to find in logs.
    expect(res.status).toBe(500)
    expect(String(body.error)).toContain('bulk_upsert_meta_stats failed')
    expect(String(body.error)).toContain('simulated: deadlock detected')

    // Heartbeat was NOT written (upsert of cron_heartbeats never got
    // called). Staleness alert will fire on the next check cycle.
    const heartbeatCalls = upsertCalls['cron_heartbeats'] ?? []
    expect(heartbeatCalls).toHaveLength(0)
  })

  it('throws + skips heartbeat when meta_poll_cursors upsert returns an error (defensive check)', async () => {
    // Symmetric regression for the cursor upsert — if the cursor write
    // fails silently, the next run re-processes the same battlelogs and
    // re-inflates counts. Destructure + throw ensures a missing heartbeat.
    //
    // This path exercises the `.from().upsert()` builder (not `.rpc()`)
    // so the error must come from the makeBuilder mock. The handler
    // makes TWO calls to from('meta_poll_cursors'): a SELECT at the
    // start of runBalancedPoll (to load existing cursors) and an UPSERT
    // at the end. The queue is FIFO, so we enqueue two responses: a
    // benign success for the SELECT, and the error for the UPSERT.
    mockRandom(0)
    enqueue('meta_poll_cursors', { data: [] }) // SELECT at start of run
    enqueue('meta_poll_cursors', {              // UPSERT at end of run
      data: null,
      error: { message: 'simulated: unique constraint violation' },
    })
    setGlobalRanking([playerTag(1)])
    addBattle(playerTag(1), { mode: 'brawlBall', map: 'Sneaky Fields', result: 'victory' })
    rotationFixture = [{ map: 'Sneaky Fields', mode: 'brawlBall' }]

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(String(body.error)).toContain('meta_poll_cursors.upsert failed')

    // Heartbeat was NOT written.
    const heartbeatCalls = upsertCalls['cron_heartbeats'] ?? []
    expect(heartbeatCalls).toHaveLength(0)
  })

  it('writes a success heartbeat to cron_heartbeats at the end of the run', async () => {
    // Regression lock: the heartbeat must be written after all other
    // side-effects complete. Asserts on the upsert payload shape, not
    // just "the call happened" — catches both a deleted call AND a
    // call with the wrong job_name / wrong date field / missing summary.
    setGlobalRanking([playerTag(1)])
    addBattle(playerTag(1), { mode: 'brawlBall', map: 'Sneaky Fields', result: 'victory' })
    rotationFixture = [{ map: 'Sneaky Fields', mode: 'brawlBall' }]

    const res = await GET(
      makeRequest('Bearer test-cron-secret') as unknown as Parameters<typeof GET>[0],
    )
    expect(res.status).toBe(200)

    const heartbeatCalls = upsertCalls['cron_heartbeats'] ?? []
    expect(heartbeatCalls).toHaveLength(1)
    const { row, options } = heartbeatCalls[0]
    const typedRow = row as Record<string, unknown>
    expect(typedRow.job_name).toBe('meta-poll')
    expect(typeof typedRow.last_duration_ms).toBe('number')
    // last_success_at must parse back to a valid Date
    expect(Number.isFinite(new Date(typedRow.last_success_at as string).getTime())).toBe(true)
    // Summary should carry the run diagnostics
    const summary = typedRow.last_summary as Record<string, unknown>
    expect(summary).toHaveProperty('battlesProcessed')
    expect(summary).toHaveProperty('poolSize')
    expect(summary).toHaveProperty('rotationAvailable')
    // And the upsert uses the right conflict key
    expect(options).toEqual({ onConflict: 'job_name' })
  })
})
