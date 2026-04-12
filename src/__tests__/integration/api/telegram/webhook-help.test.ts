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

function makeRequest(text: string) {
  return new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': SECRET,
    },
    body: JSON.stringify({ message: { text, chat: { id: CHAT_ID, type: 'private' }, message_id: 1, date: 0 }, update_id: 1 }),
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

describe('POST /api/telegram/webhook — /help', () => {
  it('sends the full help message', async () => {
    const res = await POST(makeRequest('/help'))
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.chat_id).toBe(CHAT_ID)
    expect(body.text).toContain('/stats')
    expect(body.text).toContain('/mapa')
    expect(body.parse_mode).toBe('HTML')
  })
})
