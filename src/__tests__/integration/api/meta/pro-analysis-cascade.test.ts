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
    // meta_trios (Sprint D — topBrawlerTeammates queries this for all users)
    enqueue('meta_trios', { data: [] })

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
    enqueue('meta_trios', { data: [] })                  // meta_trios (Sprint D)

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
    enqueue('meta_trios', { data: [] })                  // meta_trios (Sprint D)

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

  it('computes topBrawlerTeammates with anchor excluded, sorted by total descending', async () => {
    // Tier 1: two top brawlers with enough battles to pass display threshold
    enqueue('meta_stats', {
      data: [
        { brawler_id: 1, wins: 80, losses: 20, total: 100, date: '2026-04-13' },
        { brawler_id: 2, wins: 60, losses: 40, total: 100, date: '2026-04-13' },
      ],
    })
    enqueue('meta_stats', { data: [] })
    enqueue('meta_stats', { data: [] })
    enqueue('meta_matchups', { data: [] })

    // Trios:
    //  - 1+2+3 played 10 times (most frequent trio with CROW anchor)
    //  - 1+2+4 played  6 times (second)  — brawler 4 is unknown → "#4"
    //  - 1+3+4 played  2 times (below TEAMMATE_MIN_BATTLES=3 → filtered)
    //  - 2+3+4 played  4 times (trio containing PIPER but NOT CROW)
    enqueue('meta_trios', {
      data: [
        { brawler1_id: 1, brawler2_id: 2, brawler3_id: 3, wins: 6, losses: 4, total: 10 },
        { brawler1_id: 1, brawler2_id: 2, brawler3_id: 4, wins: 4, losses: 2, total: 6 },
        { brawler1_id: 1, brawler2_id: 3, brawler3_id: 4, wins: 1, losses: 1, total: 2 },
        { brawler1_id: 2, brawler2_id: 3, brawler3_id: 4, wins: 2, losses: 2, total: 4 },
      ],
    })

    const req = makeRequest({ map: 'Sidetrack', mode: 'brawlBall' })
    const res = await GET(req as unknown as Parameters<typeof GET>[0])
    const body = await res.json()

    expect(res.status).toBe(200)
    // Each top brawler has its own entry with trios sorted by total desc
    const crowEntry = body.topBrawlerTeammates.find((e: { brawlerId: number }) => e.brawlerId === 1)
    expect(crowEntry).toBeDefined()
    expect(crowEntry.trios.length).toBe(2) // 2+3 and 2+4 — the 3+4 one is filtered (<3 battles)
    // First trio is the most-frequent (total=10): teammates 2 and 3, anchor 1 excluded
    expect(crowEntry.trios[0].total).toBe(10)
    const firstTrioIds = crowEntry.trios[0].teammates.map((t: { id: number }) => t.id).sort((a: number, b: number) => a - b)
    expect(firstTrioIds).toEqual([2, 3])
    // Second trio has total=6
    expect(crowEntry.trios[1].total).toBe(6)

    const piperEntry = body.topBrawlerTeammates.find((e: { brawlerId: number }) => e.brawlerId === 2)
    expect(piperEntry).toBeDefined()
    // PIPER appears in 3 trios total, all 3 pass the min-battles threshold
    // (1+2+3 with 10, 1+2+4 with 6, 2+3+4 with 4)
    expect(piperEntry.trios.length).toBe(3)
    // First trio for PIPER is 1+2+3 (total=10): teammates are 1 and 3
    expect(piperEntry.trios[0].total).toBe(10)
    const piperFirstTrioIds = piperEntry.trios[0].teammates.map((t: { id: number }) => t.id).sort((a: number, b: number) => a - b)
    expect(piperFirstTrioIds).toEqual([1, 3])
  })

  it('returns empty topBrawlerTeammates when no pro trio data exists', async () => {
    enqueue('meta_stats', {
      data: [
        { brawler_id: 1, wins: 80, losses: 20, total: 100, date: '2026-04-13' },
      ],
    })
    enqueue('meta_stats', { data: [] })
    enqueue('meta_stats', { data: [] })
    enqueue('meta_matchups', { data: [] })
    enqueue('meta_trios', { data: [] })

    const req = makeRequest({ map: 'Sidetrack', mode: 'brawlBall' })
    const res = await GET(req as unknown as Parameters<typeof GET>[0])
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.topBrawlerTeammates).toEqual([])
  })
})
