import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Supabase mock: a chainable builder that we configure per-query. ──
// Each `from()` call returns a fresh builder. The test sets up the
// sequence of responses via `fromQueue`.
type Response = { data: unknown; count?: number; error?: unknown }
const fromQueue: Response[] = []
const rpcQueue: Response[] = []

function makeBuilder(response: Response) {
  // Returns a proxy that resolves to `response` on await and ignores
  // every intermediate method call (select, eq, gte, gt, lt, in,
  // order, limit, maybeSingle).
  const builder: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'gte', 'gt', 'lt', 'in', 'is', 'order', 'limit', 'maybeSingle', 'ilike']
  for (const m of methods) {
    builder[m] = () => builder
  }
  builder.then = (resolve: (v: Response) => unknown) => resolve(response)
  return builder
}

const fromMock = vi.fn(() => {
  const next = fromQueue.shift()
  if (!next) throw new Error('fromQueue exhausted — add more fixtures in the test')
  return makeBuilder(next)
})

const rpcMock = vi.fn(() => {
  const next = rpcQueue.shift()
  if (!next) throw new Error('rpcQueue exhausted — add more fixtures in the test')
  return Promise.resolve(next)
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: fromMock, rpc: rpcMock })),
}))

// Import AFTER mocks are in place.
import { queries } from '@/lib/telegram/queries'

beforeEach(() => {
  fromQueue.length = 0
  rpcQueue.length = 0
  fromMock.mockClear()
  rpcMock.mockClear()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
})

describe('queries.getStats', () => {
  it('returns an aggregated StatsData shape from 14 parallel responses', async () => {
    // Order matches the Promise.all in getStats (see queries.ts).
    const nowIso = '2026-04-12T18:30:00Z'
    fromQueue.push(
      { data: null, count: 3 },  // profiles count
      { data: null, count: 1 },  // premium count
      { data: null, count: 0 },  // trial count
      { data: null, count: 3 },  // anon 30d count
      { data: [{ first_visit_at: nowIso }, { first_visit_at: nowIso }, { first_visit_at: nowIso }] },  // anon 7d
      { data: null, count: 108 },  // battles total
      { data: null, count: 14 },   // battles today
      { data: [{ battle_time: nowIso }] },  // battles 7d rows
      { data: null, count: 836 },  // meta rows today
      { data: null, count: 3443 }, // meta rows total
      { data: null, count: 183 },  // active cursors
      { data: null, count: 22 },   // stale cursors
      { data: { last_battle_time: nowIso } },  // latest cursor
      {
        data: [
          { brawler_id: 1, map: 'Sidetrack', mode: 'brawlBall', total: 100, wins: 60, losses: 40 },
          { brawler_id: 2, map: 'Sidetrack', mode: 'brawlBall', total: 80,  wins: 42, losses: 38 },
          { brawler_id: 1, map: 'Nutmeg',    mode: 'brawlBall', total: 60,  wins: 32, losses: 28 },
        ],
      },  // today meta rows for top aggregation
    )

    const result = await queries.getStats()

    expect(result.totalUsers).toBe(3)
    expect(result.premiumCount).toBe(1)
    expect(result.trialCount).toBe(0)
    expect(result.anonCount30d).toBe(3)
    expect(result.totalBattles).toBe(108)
    expect(result.battlesToday).toBe(14)
    expect(result.metaRowsToday).toBe(836)
    expect(result.metaRowsTotal).toBe(3443)
    expect(result.activeCursors).toBe(183)
    expect(result.staleCursors).toBe(22)
    expect(result.latestMetaActivity).toBe(nowIso)
    expect(result.top3Maps).toEqual([
      { map: 'Sidetrack', mode: 'brawlBall', battles: 180 },
      { map: 'Nutmeg',    mode: 'brawlBall', battles: 60  },
    ])
    // top3Brawlers sorted by win rate desc, min one row
    expect(result.top3Brawlers.length).toBeGreaterThanOrEqual(1)
    expect(result.anonSparkline).toHaveLength(7)
    expect(result.battleSparkline).toHaveLength(7)
  })

  it('returns zeros when tables are empty', async () => {
    fromQueue.push(
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: [] },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: [] },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null },
      { data: [] },
    )

    const result = await queries.getStats()

    expect(result.totalUsers).toBe(0)
    expect(result.top3Maps).toEqual([])
    expect(result.top3Brawlers).toEqual([])
    expect(result.latestMetaActivity).toBeNull()
  })
})

describe('queries.getBattles', () => {
  it('aggregates counts and 14d sparkline', async () => {
    const nowIso = '2026-04-12T18:30:00Z'
    fromQueue.push(
      { data: null, count: 108 },  // total
      { data: null, count: 14 },   // today
      { data: null, count: 0 },    // yesterday
      { data: null, count: 108 },  // last7d
      { data: null, count: 108 },  // last30d
      { data: [{ battle_time: nowIso }, { battle_time: nowIso }] },  // 14d rows
      {
        data: [
          { mode: 'brawlBall', result: 'victory', player_tag: '#A' },
          { mode: 'brawlBall', result: 'defeat',  player_tag: '#A' },
          { mode: 'gemGrab',   result: 'draw',    player_tag: '#B' },
        ],
      },  // distributions
      { data: { last_sync: nowIso } },  // latest sync
      { data: null, count: 0 },  // queue pending
    )

    const result = await queries.getBattles()

    expect(result.total).toBe(108)
    expect(result.today).toBe(14)
    expect(result.yesterday).toBe(0)
    expect(result.last7d).toBe(108)
    expect(result.last30d).toBe(108)
    expect(result.sparkline14d).toHaveLength(14)
    expect(result.modeDistribution.length).toBeGreaterThan(0)
    expect(result.resultDistribution.map((r) => r.result)).toEqual(
      expect.arrayContaining(['victory', 'defeat', 'draw']),
    )
    expect(result.topPlayers.length).toBeGreaterThan(0)
    expect(result.lastSuccessfulSyncAt).toBe(nowIso)
    expect(result.queuePending).toBe(0)
  })

  it('returns zeros when battles table empty', async () => {
    fromQueue.push(
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: [] },
      { data: [] },
      { data: null },
      { data: null, count: 0 },
    )

    const result = await queries.getBattles()
    expect(result.total).toBe(0)
    expect(result.topPlayers).toEqual([])
    expect(result.lastSuccessfulSyncAt).toBeNull()
  })
})

describe('queries.getPremium', () => {
  it('returns funnel counts with nullable v2 fields', async () => {
    fromQueue.push(
      { data: null, count: 1 },  // premium active
      { data: null, count: 0 },  // trial active
      { data: null, count: 2 },  // free
      { data: null, count: 3 },  // signups 30d
      { data: null, count: 3 },  // trials activated 30d
      { data: null, count: 1 },  // trial→premium 30d
      { data: null, count: 0 },  // trials expired 30d
    )

    const result = await queries.getPremium()
    expect(result.premiumActive).toBe(1)
    expect(result.trialActive).toBe(0)
    expect(result.freeUsers).toBe(2)
    expect(result.signupsLast30d).toBe(3)
    expect(result.trialsActivatedLast30d).toBe(3)
    expect(result.trialToPremiumLast30d).toBe(1)
    expect(result.upcomingRenewals7d).toBeNull()
    expect(result.ltvTotal).toBeNull()
  })
})

describe('queries.getCronStatus', () => {
  it('counts runs per job in last 24h and infers VPS freshness', async () => {
    const nowIso = new Date().toISOString()
    const old   = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

    rpcQueue.push(
      {
        data: [
          { jobid: 1, jobname: 'enqueue-premium-syncs', schedule: '*/15 * * * *', active: true, command: '' },
          { jobid: 2, jobname: 'process-sync-queue',    schedule: '*/5 * * * *',  active: true, command: '' },
        ],
      },
      {
        data: [
          { jobid: 1, jobname: 'enqueue-premium-syncs', status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
          { jobid: 1, jobname: 'enqueue-premium-syncs', status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
          { jobid: 2, jobname: 'process-sync-queue',    status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
          { jobid: 2, jobname: 'process-sync-queue',    status: 'succeeded', return_message: null, start_time: old,    end_time: old },  // outside 24h
        ],
      },
    )

    // Latest meta cursor: fresh (10 min ago)
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    // Latest sync: stale (65 min ago)
    const sixtyFiveMinAgo = new Date(Date.now() - 65 * 60 * 1000).toISOString()
    fromQueue.push(
      { data: { last_battle_time: tenMinAgo } },
      { data: { last_sync: sixtyFiveMinAgo } },
    )

    const result = await queries.getCronStatus()

    expect(result.pgCronJobs).toHaveLength(2)
    expect(result.runsByJob.get('enqueue-premium-syncs')).toBe(2)
    expect(result.runsByJob.get('process-sync-queue')).toBe(1)  // 1 inside 24h
    expect(result.metaPollFreshness.status).toBe('fresh')
    expect(result.syncFreshness.status).toBe('dead')  // 65 min > 20 + 5, and > 20 × 3 → dead
  })

  it('returns unknown freshness when proxy data is missing', async () => {
    rpcQueue.push({ data: [] }, { data: [] })
    fromQueue.push({ data: null }, { data: null })

    const result = await queries.getCronStatus()
    expect(result.metaPollFreshness.status).toBe('unknown')
    expect(result.syncFreshness.status).toBe('unknown')
  })
})

describe('queries.getMapList', () => {
  it('aggregates meta_stats rows into (map, mode) entries sorted by battles', async () => {
    fromQueue.push({
      data: [
        { map: 'Sidetrack', mode: 'brawlBall', total: 1000, brawler_id: 1 },
        { map: 'Sidetrack', mode: 'brawlBall', total:  800, brawler_id: 2 },
        { map: 'Nutmeg',    mode: 'brawlBall', total:  500, brawler_id: 1 },
      ],
    })

    const result = await queries.getMapList()
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ map: 'Sidetrack', mode: 'brawlBall', battles: 1800, brawlerCount: 2 })
    expect(result[1]).toEqual({ map: 'Nutmeg',    mode: 'brawlBall', battles: 500,  brawlerCount: 1 })
  })

  it('returns empty array when no data', async () => {
    fromQueue.push({ data: [] })
    const result = await queries.getMapList()
    expect(result).toEqual([])
  })
})

describe('queries.findMapByPrefix', () => {
  it('returns "found" with the single match', async () => {
    fromQueue.push({
      data: [{ map: 'Sidetrack', mode: 'brawlBall' }],
    })
    const result = await queries.findMapByPrefix('side')
    expect(result).toEqual({ kind: 'found', map: 'Sidetrack', mode: 'brawlBall' })
  })

  it('returns "none" when no matches', async () => {
    fromQueue.push({ data: [] })
    const result = await queries.findMapByPrefix('xyz')
    expect(result).toEqual({ kind: 'none' })
  })

  it('returns "ambiguous" with candidates when multiple distinct pairs match', async () => {
    fromQueue.push({
      data: [
        { map: 'Beach Ball',  mode: 'brawlBall' },
        { map: 'Bea Stadium', mode: 'knockout'  },
      ],
    })
    const result = await queries.findMapByPrefix('bea')
    expect(result.kind).toBe('ambiguous')
    if (result.kind === 'ambiguous') {
      expect(result.candidates).toHaveLength(2)
    }
  })
})

describe('queries.getMapData', () => {
  it('returns coverage + rankings for an existing map', async () => {
    const nowIso = new Date().toISOString()
    const today = new Date().toISOString().slice(0, 10)
    fromQueue.push(
      { data: [{ total: 2798 }] },                                                                // today total rows
      { data: [{ total: 19586 }] },                                                               // 7d total rows
      { data: [{ brawler_id: 1 }, { brawler_id: 2 }, { brawler_id: 3 }] },                        // brawler coverage
      {
        data: [
          { brawler_id: 1, wins: 60, losses: 40, total: 100 },
          { brawler_id: 2, wins: 45, losses: 55, total: 100 },
        ],
      },                                                                                          // WR rows
      { data: [{ date: today, total: 19586 }] },                                                  // 7d sparkline rows (bucketed by date)
      {
        data: [
          { map: 'Sidetrack', mode: 'brawlBall', total: 2798 },
          { map: 'Nutmeg',    mode: 'brawlBall', total: 1848 },
        ],
      },                                                                                          // same-mode comparison
      { data: { last_battle_time: nowIso } },                                                     // last cursor update
    )

    const result = await queries.getMapData('Sidetrack', 'brawlBall')
    expect(result.map).toBe('Sidetrack')
    expect(result.mode).toBe('brawlBall')
    expect(result.battlesToday).toBe(2798)
    expect(result.battlesLast7d).toBe(19586)
    expect(result.brawlerCovered).toBe(3)
    expect(result.topWinRates.length).toBeGreaterThan(0)
    expect(result.sameModeComparison.length).toBe(2)
    expect(result.lastCursorUpdate).toBe(nowIso)
  })
})
