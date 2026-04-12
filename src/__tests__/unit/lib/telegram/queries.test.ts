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
