import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/battles/route'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

const MOCK_BATTLES = [
  { id: 1, player_tag: '#TAG', battle_time: '2026-04-05T17:00:00Z', mode: 'brawlBall', result: 'victory' },
  { id: 2, player_tag: '#TAG', battle_time: '2026-04-05T16:00:00Z', mode: 'gemGrab', result: 'defeat' },
]

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/battles')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url)
}

describe('GET /api/battles', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns battles with cursor pagination', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })

    const mockProfileQuery = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { player_tag: '#TAG' }, error: null }),
        }),
      }),
    }
    const mockBattlesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: MOCK_BATTLES, error: null }),
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return mockProfileQuery
      if (table === 'battles') return mockBattlesQuery
      return {}
    })

    const res = await GET(makeRequest({ limit: '50' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.battles).toHaveLength(2)
  })

  it('returns empty array and null cursor when no battles', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { player_tag: '#TAG' }, error: null }),
          }),
        }),
      }
      if (table === 'battles') return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
      return {}
    })

    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.battles).toHaveLength(0)
    expect(data.nextCursor).toBeNull()
  })
})
