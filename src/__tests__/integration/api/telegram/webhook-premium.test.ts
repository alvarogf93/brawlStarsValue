import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PremiumData } from '@/lib/telegram/types'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const getPremiumMock = vi.fn<() => Promise<PremiumData>>()

vi.mock('@/lib/telegram/queries', () => ({
  queries: {
    getStats: vi.fn(),
    getBattles: vi.fn(),
    getPremium: () => getPremiumMock(),
    getCronStatus: vi.fn(),
    getMapList: vi.fn(),
    findMapByPrefix: vi.fn(),
    getMapData: vi.fn(),
  },
}))

import { POST } from '@/app/api/telegram/webhook/route'

const SECRET = 'test-secret'
const CHAT_ID = '12345'

function req(text: string) {
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
  getPremiumMock.mockReset()
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET
  process.env.TELEGRAM_CHAT_ID = CHAT_ID
})

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  delete process.env.TELEGRAM_CHAT_ID
})

describe('POST /api/telegram/webhook — /premium', () => {
  it('renders sections including the integration placeholder', async () => {
    getPremiumMock.mockResolvedValue({
      premiumActive: 1,
      trialActive: 0,
      freeUsers: 2,
      signupsLast30d: 3,
      trialsActivatedLast30d: 3,
      trialToPremiumLast30d: 1,
      trialsExpiredLast30d: 0,
      upcomingRenewals7d: null,
      ltvTotal: null,
    })
    await POST(req('/premium'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('PREMIUM')
    expect(body.text).toContain('FUNNEL 30 DÍAS')
    expect(body.text).toContain('Requiere integración')
  })

  it('sends error message when getPremium throws', async () => {
    getPremiumMock.mockRejectedValue(new Error('schema missing'))
    await POST(req('/premium'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('Error ejecutando el comando')
    expect(body.text).toContain('schema missing')
  })
})
