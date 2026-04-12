import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { StatsData } from '@/lib/telegram/types'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const getStatsMock = vi.fn<() => Promise<StatsData>>()

vi.mock('@/lib/telegram/queries', () => ({
  queries: {
    getStats: () => getStatsMock(),
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
  getStatsMock.mockReset()
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET
  process.env.TELEGRAM_CHAT_ID = CHAT_ID
})

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  delete process.env.TELEGRAM_CHAT_ID
})

describe('POST /api/telegram/webhook — /stats', () => {
  it('renders the stats message with real data', async () => {
    getStatsMock.mockResolvedValue({
      totalUsers: 3,
      premiumCount: 1,
      trialCount: 0,
      anonCount30d: 3,
      anonSparkline: [0, 0, 0, 0, 0, 0, 3],
      totalBattles: 108,
      battlesToday: 14,
      battleSparkline: [2, 2, 3, 4, 4, 4, 14],
      metaRowsToday: 836,
      metaRowsTotal: 3443,
      activeCursors: 183,
      staleCursors: 22,
      latestMetaActivity: new Date(Date.now() - 37 * 60 * 1000).toISOString(),
      top3Maps: [
        { map: 'Sidetrack',             mode: 'brawlBall', battles: 2798 },
        { map: 'Healthy Middle Ground', mode: 'knockout',  battles: 2017 },
        { map: 'Nutmeg',                mode: 'brawlBall', battles: 1848 },
      ],
      top3Brawlers: [{ brawlerId: 1, winRate: 0.62, total: 123 }],
    })

    const res = await POST(req('/stats'))
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('BrawlVision Stats')
    expect(body.text).toContain('Sidetrack')
    expect(body.text).toContain('1,848')
  })

  it('sends an error message when getStats throws', async () => {
    getStatsMock.mockRejectedValue(new Error('db down'))
    await POST(req('/stats'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('Error ejecutando el comando')
    expect(body.text).toContain('db down')
  })

  it('replies with "not recognized" for unknown command', async () => {
    await POST(req('/foo'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('Comando no reconocido')
    expect(body.text).toContain('/help')
  })
})
