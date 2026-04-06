import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/sync/route'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
  createServiceClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null, count: 0 }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
  }),
}))

vi.mock('@/lib/api', () => ({
  fetchBattlelog: vi.fn().mockResolvedValue({ items: [], paging: { cursors: {} } }),
}))

vi.mock('@/lib/battle-sync', () => ({
  syncBattles: vi.fn().mockResolvedValue({ playerTag: '#TAG', fetched: 5, inserted: 3, error: null }),
}))

describe('POST /api/sync', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is free tier', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'uid1', player_tag: '#TAG', tier: 'free', ls_subscription_status: null, last_sync: null },
            error: null,
          }),
        }),
      }),
    })
    const res = await POST()
    expect(res.status).toBe(403)
  })

  it('returns 200 and sync result for premium user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'uid1', player_tag: '#TAG', tier: 'premium', ls_subscription_status: 'active', last_sync: null },
            error: null,
          }),
        }),
      }),
    })

    const res = await POST()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.inserted).toBe(3)
  })

  it('returns 429 when last_sync was less than 2 minutes ago', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'uid1', player_tag: '#TAG', tier: 'premium', ls_subscription_status: 'active',
              last_sync: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
    })

    const res = await POST()
    expect(res.status).toBe(429)
  })
})
