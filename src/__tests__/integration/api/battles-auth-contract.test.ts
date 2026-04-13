import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Auth contract for /api/battles.
 *
 * Locks in that the route uses cookie-based auth via `createClient` from
 * `@/lib/supabase/server` and responds consistently across the three
 * canonical states:
 *
 *  1. Anonymous (no session cookie)       → 401 Not authenticated
 *  2. Authenticated but no profile row    → 404 Profile not found
 *  3. Authenticated with profile + battles → 200 with battles payload
 *
 * If anyone ever switches to a Bearer-token auth path without updating
 * the hook that calls this route, these tests fail.
 */

type QueuedResponse = { data: unknown; error?: unknown }
const queueByTable: Record<string, QueuedResponse[]> = {}

function enqueue(table: string, response: QueuedResponse) {
  if (!queueByTable[table]) queueByTable[table] = []
  queueByTable[table].push(response)
}

function makeBuilder(response: QueuedResponse) {
  const methods = [
    'select', 'eq', 'gte', 'lte', 'lt', 'gt', 'in', 'order', 'limit', 'single', 'maybeSingle',
  ]
  const builder: Record<string, unknown> = {}
  for (const m of methods) builder[m] = () => builder
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

type AuthGetUserResult = { data: { user: { id: string } | null } }
const authGetUserMock = vi.fn(
  async (): Promise<AuthGetUserResult> => ({ data: { user: null } }),
)

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: fromMock,
    auth: { getUser: authGetUserMock },
  }),
}))

import { GET } from '@/app/api/battles/route'

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/battles')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url, { method: 'GET' })
}

beforeEach(() => {
  for (const k of Object.keys(queueByTable)) delete queueByTable[k]
  fromMock.mockClear()
  authGetUserMock.mockClear()
  authGetUserMock.mockResolvedValue({ data: { user: null } })
})

describe('GET /api/battles — auth contract', () => {
  it('returns 401 when no session cookie is present', async () => {
    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/Not authenticated/i)
  })

  it('returns 404 when the cookie session is valid but the profile row is missing', async () => {
    authGetUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    enqueue('profiles', { data: null })

    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/Profile not found/i)
  })

  it('returns 200 with battles when authenticated with a populated profile', async () => {
    authGetUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-2' } } })
    enqueue('profiles', { data: { player_tag: 'YJU282PV' } })
    enqueue('battles', {
      data: [
        { battle_time: '2026-04-13T10:00:00Z', result: 'victory', mode: 'brawlBall', map: 'Sidetrack' },
        { battle_time: '2026-04-13T09:00:00Z', result: 'defeat', mode: 'brawlBall', map: 'Sidetrack' },
      ],
    })

    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.battles).toHaveLength(2)
    expect(body.nextCursor).toBeNull()
  })

  it('returns 200 with an empty battles array when the user has no battles yet', async () => {
    authGetUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-3' } } })
    enqueue('profiles', { data: { player_tag: 'NEW1234' } })
    enqueue('battles', { data: [] })

    const res = await GET(makeRequest() as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.battles).toEqual([])
    expect(body.nextCursor).toBeNull()
  })

  it('responds with aggregate shape when ?aggregate=true is passed', async () => {
    authGetUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-4' } } })
    enqueue('profiles', { data: { player_tag: 'ABCDEFG' } })
    enqueue('battles', {
      data: [
        { mode: 'brawlBall', map: 'Sidetrack', result: 'victory', trophy_change: 8, is_star_player: true, my_brawler: { id: 1 } },
      ],
    })

    const res = await GET(makeRequest({ aggregate: 'true' }) as unknown as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.analytics).toHaveLength(1)
    expect(body.count).toBe(1)
  })

  it('rejects an invalid before cursor with 400', async () => {
    authGetUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-5' } } })
    enqueue('profiles', { data: { player_tag: 'FOO' } })
    // The route constructs the battles query builder before validating
    // the cursor — fromMock still consumes one queue entry even though
    // the query is never awaited on the 400 path.
    enqueue('battles', { data: [] })

    const res = await GET(
      makeRequest({ before: 'not-a-date' }) as unknown as Parameters<typeof GET>[0],
    )
    expect(res.status).toBe(400)
  })
})
