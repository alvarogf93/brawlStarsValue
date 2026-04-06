import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/checkout/route'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

vi.mock('@/lib/lemonsqueezy', () => ({
  createCheckoutUrl: vi.fn().mockResolvedValue('https://checkout.lemonsqueezy.com/test'),
}))

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/checkout', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeRequest({ interval: 'monthly' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid interval', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1', email: 'a@b.com' } }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'uid1', player_tag: '#TAG', tier: 'free', ls_subscription_status: null }, error: null }),
        }),
      }),
    })
    const res = await POST(makeRequest({ interval: 'weekly' }))
    expect(res.status).toBe(400)
  })

  it('returns checkout URL for valid request', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1', email: 'a@b.com' } }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'uid1', player_tag: '#TAG', tier: 'free', ls_subscription_status: null }, error: null }),
        }),
      }),
    })

    const res = await POST(makeRequest({ interval: 'monthly' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.url).toBe('https://checkout.lemonsqueezy.com/test')
  })

  it('returns 409 when already premium', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1', email: 'a@b.com' } }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'uid1', player_tag: '#TAG', tier: 'premium', ls_subscription_status: 'active' }, error: null }),
        }),
      }),
    })

    const res = await POST(makeRequest({ interval: 'monthly' }))
    expect(res.status).toBe(409)
  })
})
