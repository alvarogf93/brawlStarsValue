import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/webhooks/lemonsqueezy/route'
import crypto from 'crypto'

const WEBHOOK_SECRET = 'test-secret'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

vi.stubEnv('LEMONSQUEEZY_WEBHOOK_SECRET', WEBHOOK_SECRET)

function makeSignedRequest(body: Record<string, unknown>) {
  const raw = JSON.stringify(body)
  const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex')
  return new Request('http://localhost:3000/api/webhooks/lemonsqueezy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': sig,
      'X-Event-Id': 'evt_' + Date.now(),
    },
    body: raw,
  })
}

function makeUnsignedRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/webhooks/lemonsqueezy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Signature': 'invalid', 'X-Event-Id': 'evt_1' },
    body: JSON.stringify(body),
  })
}

const VALID_PAYLOAD = {
  meta: { event_name: 'subscription_created', custom_data: { profile_id: 'uid1' } },
  data: { id: 'sub_123', attributes: { customer_id: 456, status: 'active', variant_id: 789 } },
}

describe('POST /api/webhooks/lemonsqueezy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'webhook_events') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      if (table === 'profiles') {
        return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
      }
      return {}
    })
  })

  it('rejects invalid HMAC signature', async () => {
    const res = await POST(makeUnsignedRequest(VALID_PAYLOAD))
    expect(res.status).toBe(401)
  })

  it('processes subscription_created and returns 200', async () => {
    const res = await POST(makeSignedRequest(VALID_PAYLOAD))
    expect(res.status).toBe(200)
  })

  it('returns 200 for duplicate event_id (idempotent)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'webhook_events') {
        return { insert: vi.fn().mockResolvedValue({ error: { code: '23505' } }) }
      }
      return {}
    })

    const res = await POST(makeSignedRequest(VALID_PAYLOAD))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.skipped).toBe(true)
  })
})
