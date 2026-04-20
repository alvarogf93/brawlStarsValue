import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Chainable mock builder ──────────────────────────────────────
// Supabase method chains. Terminal methods `.range()` and `.gte()`
// both resolve via `.then`, so the chain is awaitable at any
// point. Each call to `.from(table)` is recorded so the assertions
// can reason about which table was hit and in what order.

type ResolvedValue = { data: unknown; error: unknown }

function chainable(resolvedValue: ResolvedValue) {
  const self: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['select', 'eq', 'gte', 'range']) {
    self[method] = vi.fn().mockReturnValue(self)
  }
  self.then = vi.fn((resolve: (v: unknown) => void) => resolve(resolvedValue))
  return self
}

/**
 * Per-table, per-call response queue. Each `.from('X')` call shifts
 * one response off the queue for that table. Mimics the route's
 * paginated flow over `meta_stats` where a single test can enqueue
 * "page 1 full, page 2 short, stop".
 */
const queue: Record<string, ResolvedValue[]> = {}
function enqueue(table: string, ...values: ResolvedValue[]) {
  queue[table] = [...(queue[table] ?? []), ...values]
}

const mockFrom = vi.fn((table: string) => {
  const next = queue[table]?.shift() ?? { data: [], error: null }
  return chainable(next)
})

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({ from: mockFrom })),
}))

import { GET } from '@/app/api/meta/brawler-trends/route'

describe('GET /api/meta/brawler-trends', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(queue)) delete queue[key]
  })

  it('fast path: returns source=precomputed with fresh rows + computedAt', async () => {
    const now = new Date().toISOString()
    enqueue('brawler_trends', {
      data: [
        { brawler_id: 16000001, trend_7d: -8.3, computed_at: now },
        { brawler_id: 16000002, trend_7d: 2.1, computed_at: now },
        { brawler_id: 16000003, trend_7d: null, computed_at: now },
      ],
      error: null,
    })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.source).toBe('precomputed')
    expect(body.trends).toEqual({
      '16000001': -8.3,
      '16000002': 2.1,
      '16000003': null,
    })
    expect(body.computedAt).toBe(now)
  })

  it('fast path: stale rows filtered out → falls through to inline (zero rows)', async () => {
    // brawler_trends returns empty because the freshness filter
    // (.gte('computed_at', cutoff)) excluded everything.
    enqueue('brawler_trends', { data: [], error: null })
    // First meta_stats pagination page is already short (<1000) so
    // the loop exits after one request.
    enqueue('meta_stats', {
      data: [
        { brawler_id: 16000001, date: todayStr(), wins: 5, total: 10 },
        // 10 days ago → falls into the prev window (8..14d).
        // `date >= d7ago` in compute7dTrend is the inclusive split:
        // exactly 7 days ago lands in recent, so use 10 to be safe.
        { brawler_id: 16000001, date: tenDaysAgoStr(), wins: 3, total: 10 },
      ],
      error: null,
    })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.source).toBe('inline')
    // Both windows have 10 battles each (>= 3 threshold), so trend is computable.
    expect(body.trends['16000001']).toBeCloseTo(20.0, 1) // 50% - 30% = 20pp
  })

  it('fallback path: paginates over meta_stats until a short page arrives', async () => {
    enqueue('brawler_trends', { data: [], error: null })
    // Page 1: 1000 rows → loop continues
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      brawler_id: 16000001,
      date: todayStr(),
      wins: 1,
      total: 2,
    }))
    // Page 2: 50 rows → loop exits
    const page2 = Array.from({ length: 50 }, (_, i) => ({
      brawler_id: 16000001,
      date: todayStr(),
      wins: 1,
      total: 2,
    }))
    enqueue('meta_stats', { data: page1, error: null })
    enqueue('meta_stats', { data: page2, error: null })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.source).toBe('inline')
    // All rows are in the recent window → prev window is empty (<3),
    // so trend is null.
    expect(body.trends['16000001']).toBeNull()
    // The route should have queried meta_stats exactly twice.
    const metaCalls = mockFrom.mock.calls.filter(([t]) => t === 'meta_stats').length
    expect(metaCalls).toBe(2)
  })

  it('fallback path: surfaces 500 when meta_stats query errors', async () => {
    enqueue('brawler_trends', { data: [], error: null })
    enqueue('meta_stats', {
      data: null,
      error: { message: 'connection reset', code: 'XX000' },
    })

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

// ── Test helpers ───────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function tenDaysAgoStr(): string {
  return new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10)
}
