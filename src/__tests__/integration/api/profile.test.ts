import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/profile/route'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

function makeRequest(method: string, body?: unknown) {
  return new Request('http://localhost:3000/api/profile', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe('Profile API', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('GET /api/profile', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
      const res = await GET(makeRequest('GET'))
      expect(res.status).toBe(401)
    })

    it('returns profile when authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'uid1', player_tag: '#TAG', tier: 'free' },
              error: null,
            }),
          }),
        }),
      })

      const res = await GET(makeRequest('GET'))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.player_tag).toBe('#TAG')
    })

    it('returns 404 when profile does not exist', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      })

      const res = await GET(makeRequest('GET'))
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/profile', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
      const res = await POST(makeRequest('POST', { player_tag: '#TAG' }))
      expect(res.status).toBe(401)
    })

    it('creates profile with valid tag', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })
      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'uid1', player_tag: '#TAG', tier: 'free' },
              error: null,
            }),
          }),
        }),
      })

      const res = await POST(makeRequest('POST', { player_tag: '#TAG' }))
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.player_tag).toBe('#TAG')
    })

    it('returns 400 for invalid tag format', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } }, error: null })
      const res = await POST(makeRequest('POST', { player_tag: 'invalid' }))
      expect(res.status).toBe(400)
    })
  })
})
