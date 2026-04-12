import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

vi.mock('@/lib/telegram/queries', () => ({
  queries: {
    getStats: vi.fn(),
    getBattles: vi.fn(),
    getPremium: vi.fn(),
    getCronStatus: vi.fn(),
    getMapList: vi.fn(),
    findMapByPrefix: vi.fn(),
    getMapData: vi.fn(),
  },
}))

import { POST } from '@/app/api/telegram/webhook/route'

const SECRET = 'test-secret'
const CHAT_ID = '12345'

function makeRequest(body: unknown, headerSecret: string | null = SECRET) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (headerSecret) headers['x-telegram-bot-api-secret-token'] = headerSecret
  return new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' })
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET
  process.env.TELEGRAM_CHAT_ID = CHAT_ID
})

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  delete process.env.TELEGRAM_CHAT_ID
})

describe('POST /api/telegram/webhook — auth', () => {
  it('returns 200 and does not send anything on L1 fail (bad/missing header)', async () => {
    const res = await POST(makeRequest({ message: { text: '/stats', chat: { id: CHAT_ID, type: 'private' } } }, 'wrong-secret'))
    expect(res.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 200 and does not send anything on L2 fail (wrong chat_id)', async () => {
    const res = await POST(makeRequest({ message: { text: '/stats', chat: { id: '99999', type: 'private' }, message_id: 1, date: 0 } }))
    expect(res.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 200 on malformed body', async () => {
    const res = await POST(makeRequest('not-json'))
    expect(res.status).toBe(200)
  })
})
