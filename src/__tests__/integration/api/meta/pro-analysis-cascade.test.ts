import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Supabase mock ─────────────────────────────────────────────
// Each query's response is queued in `queueByTable` keyed by the
// table name. The `from()` mock returns a chainable builder that
// resolves to the next response for that table.

type QueuedResponse = { data: unknown; error?: unknown }
const queueByTable: Record<string, QueuedResponse[]> = {}

function enqueue(table: string, response: QueuedResponse) {
  if (!queueByTable[table]) queueByTable[table] = []
  queueByTable[table].push(response)
}

function makeBuilder(response: QueuedResponse) {
  const methods = ['select', 'eq', 'gte', 'lte', 'in', 'order', 'limit', 'maybeSingle']
  const builder: Record<string, unknown> = {}
  for (const m of methods) builder[m] = () => builder
  // thenable — `await builder` resolves to response
  builder.then = (resolve: (v: QueuedResponse) => unknown) => resolve(response)
  return builder
}

const fromMock = vi.fn((table: string) => {
  const queue = queueByTable[table]
  if (!queue || queue.length === 0) {
    throw new Error(`No queued response for table "${table}"`)
  }
  return makeBuilder(queue.shift()!)
})

const authGetUserMock = vi.fn(async () => ({ data: { user: null } }))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    from: fromMock,
    auth: { getUser: authGetUserMock },
  }),
}))

vi.mock('@/lib/draft/brawler-names', () => ({
  loadBrawlerNames: vi.fn(async () => new Map<number, string>([
    [1, 'CROW'],
    [2, 'PIPER'],
    [3, 'BULL'],
  ])),
  getBrawlerName: (names: Map<number, string>, id: number) =>
    names.get(id) ?? `#${id}`,
}))

// Import AFTER mocks
import { GET } from '@/app/api/meta/pro-analysis/route'

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/meta/pro-analysis')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url, { method: 'GET' })
}

beforeEach(() => {
  for (const k of Object.keys(queueByTable)) delete queueByTable[k]
  fromMock.mockClear()
  authGetUserMock.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/meta/pro-analysis — cascade behaviour', () => {
  it('returns topBrawlersSource="map-mode" when the map has data', async () => {
    // Tier 1: current window stats with real data
    enqueue('meta_stats', {
      data: [
        { brawler_id: 1, wins: 80, losses: 20, total: 100, date: '2026-04-13' },
        { brawler_id: 2, wins: 60, losses: 40, total: 100, date: '2026-04-13' },
      ],
    })
    // 7d trend stats
    enqueue('meta_stats', { data: [] })
    // 30d trend stats
    enqueue('meta_stats', { data: [] })
    // matchups
    enqueue('meta_matchups', { data: [] })

    const req = makeRequest({ map: 'Sidetrack', mode: 'brawlBall' })
    const res = await GET(req as unknown as Parameters<typeof GET>[0])
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.topBrawlersSource).toBe('map-mode')
    expect(body.topBrawlers.length).toBeGreaterThan(0)
  })

  it('falls back to topBrawlersSource="mode-fallback" when map is sparse', async () => {
    // Tier 1 query sequence (see route.ts): current, 7d, 30d, matchups
    enqueue('meta_stats', { data: [] })                  // Tier 1 current window (empty → triggers fallback)
    enqueue('meta_stats', { data: [] })                  // Tier 1 7d trend
    enqueue('meta_stats', { data: [] })                  // Tier 1 30d trend
    enqueue('meta_matchups', { data: [] })               // matchups (still queried even if map is sparse)
    // Tier 2 runs 3 queries in Promise.all: current, 7d, 30d (all mode-only)
    enqueue('meta_stats', {
      data: [
        { brawler_id: 1, wins: 600, losses: 400, total: 1000, date: '2026-04-13' },
        { brawler_id: 2, wins: 540, losses: 460, total: 1000, date: '2026-04-13' },
        { brawler_id: 3, wins: 520, losses: 480, total: 1000, date: '2026-04-13' },
      ],
    })                                                    // Tier 2 current window
    enqueue('meta_stats', { data: [] })                  // Tier 2 7d trend (empty is fine)
    enqueue('meta_stats', { data: [] })                  // Tier 2 30d trend

    const req = makeRequest({ map: 'Pit Stop', mode: 'heist' })
    const res = await GET(req as unknown as Parameters<typeof GET>[0])
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.topBrawlersSource).toBe('mode-fallback')
    expect(body.topBrawlers.length).toBeGreaterThan(0)
    expect(body.topBrawlers[0].name).toBe('CROW')
  })

  it('returns topBrawlersSource="map-mode" with empty topBrawlers when both tiers are empty', async () => {
    // Tier 1: all empty
    enqueue('meta_stats', { data: [] })                  // Tier 1 current
    enqueue('meta_stats', { data: [] })                  // Tier 1 7d
    enqueue('meta_stats', { data: [] })                  // Tier 1 30d
    enqueue('meta_matchups', { data: [] })               // matchups
    // Tier 2: also empty (genuinely no data for this mode either)
    enqueue('meta_stats', { data: [] })                  // Tier 2 current (still issued, empty result)
    enqueue('meta_stats', { data: [] })                  // Tier 2 7d
    enqueue('meta_stats', { data: [] })                  // Tier 2 30d

    const req = makeRequest({ map: 'NewMap', mode: 'brandNewMode' })
    const res = await GET(req as unknown as Parameters<typeof GET>[0])
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.topBrawlersSource).toBe('map-mode')
    expect(body.topBrawlers).toEqual([])
  })

  it('returns 400 when map or mode is missing', async () => {
    const req = makeRequest({ map: 'Sidetrack' })
    const res = await GET(req as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(400)
  })
})
