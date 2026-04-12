import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { BattlesData } from '@/lib/telegram/types'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const getBattlesMock = vi.fn<() => Promise<BattlesData>>()

vi.mock('@/lib/telegram/queries', () => ({
  queries: {
    getStats: vi.fn(),
    getBattles: () => getBattlesMock(),
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

function makeBattlesData(overrides: Partial<BattlesData> = {}): BattlesData {
  return {
    total: 108,
    today: 14,
    yesterday: 0,
    last7d: 108,
    last30d: 108,
    sparkline14d: [1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 4, 4, 4, 14],
    modeDistribution: [
      { mode: 'lastStand', count: 7, pct: 0.50 },
      { mode: 'brawlBall', count: 3, pct: 0.21 },
    ],
    resultDistribution: [
      { result: 'victory', count: 48, pct: 0.44 },
      { result: 'defeat',  count: 55, pct: 0.51 },
      { result: 'draw',    count:  5, pct: 0.05 },
    ],
    topPlayers: [{ tag: '#YJU282PV', count: 108 }],
    lastSuccessfulSyncAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    queuePending: 0,
    ...overrides,
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' })
  getBattlesMock.mockReset()
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET
  process.env.TELEGRAM_CHAT_ID = CHAT_ID
})

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  delete process.env.TELEGRAM_CHAT_ID
})

describe('POST /api/telegram/webhook — /batallas', () => {
  it('renders all sections with real data', async () => {
    getBattlesMock.mockResolvedValue(makeBattlesData())
    await POST(req('/batallas'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('BATTLES SYNC')
    expect(body.text).toContain('VOLUMEN')
    expect(body.text).toContain('#YJU282PV')
  })

  it('says "No hay batallas registradas aún" when total is 0', async () => {
    getBattlesMock.mockResolvedValue(makeBattlesData({
      total: 0, today: 0, yesterday: 0, last7d: 0, last30d: 0,
      sparkline14d: new Array(14).fill(0),
      modeDistribution: [],
      resultDistribution: [
        { result: 'victory', count: 0, pct: 0 },
        { result: 'defeat',  count: 0, pct: 0 },
        { result: 'draw',    count: 0, pct: 0 },
      ],
      topPlayers: [],
      lastSuccessfulSyncAt: null,
    }))
    await POST(req('/batallas'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('No hay batallas registradas aún')
  })

  it('sends error message when getBattles throws', async () => {
    getBattlesMock.mockRejectedValue(new Error('db down'))
    await POST(req('/batallas'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('Error ejecutando el comando')
    expect(body.text).toContain('db down')
  })
})
