import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MapData, MapListItem, MapMatchResult } from '@/lib/telegram/types'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const getMapListMock = vi.fn<() => Promise<MapListItem[]>>()
const findMapByPrefixMock = vi.fn<(prefix: string) => Promise<MapMatchResult>>()
const getMapDataMock = vi.fn<(map: string, mode: string) => Promise<MapData>>()

vi.mock('@/lib/telegram/queries', () => ({
  queries: {
    getStats: vi.fn(),
    getBattles: vi.fn(),
    getPremium: vi.fn(),
    getCronStatus: vi.fn(),
    getMapList: () => getMapListMock(),
    findMapByPrefix: (prefix: string) => findMapByPrefixMock(prefix),
    getMapData: (map: string, mode: string) => getMapDataMock(map, mode),
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

function makeMapData(overrides: Partial<MapData> = {}): MapData {
  return {
    map: 'Sidetrack',
    mode: 'brawlBall',
    battlesToday: 2798,
    battlesLast7d: 19586,
    brawlerCovered: 81,
    brawlerTotal: 82,
    sparkline7d: [2000, 2100, 1900, 2200, 2100, 2000, 2798],
    topWinRates: [
      { brawlerId: 1, winRate: 0.624, total: 123 },
      { brawlerId: 2, winRate: 0.581, total:  89 },
      { brawlerId: 3, winRate: 0.578, total: 156 },
      { brawlerId: 4, winRate: 0.569, total: 102 },
      { brawlerId: 5, winRate: 0.562, total:  78 },
    ],
    bottomWinRates: [
      { brawlerId: 6, winRate: 0.382, total: 41 },
      { brawlerId: 7, winRate: 0.391, total: 35 },
      { brawlerId: 8, winRate: 0.405, total: 52 },
    ],
    sameModeComparison: [
      { map: 'Sidetrack', battles: 2798 },
      { map: 'Nutmeg',    battles: 1848 },
    ],
    lastCursorUpdate: new Date(Date.now() - 37 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' })
  getMapListMock.mockReset()
  findMapByPrefixMock.mockReset()
  getMapDataMock.mockReset()
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET
  process.env.TELEGRAM_CHAT_ID = CHAT_ID
})

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  delete process.env.TELEGRAM_CHAT_ID
})

describe('POST /api/telegram/webhook — /mapa', () => {
  it('/mapa (no args) renders the list', async () => {
    getMapListMock.mockResolvedValue([
      { map: 'Sidetrack', mode: 'brawlBall', battles: 2798, brawlerCount: 81 },
      { map: 'Nutmeg',    mode: 'brawlBall', battles: 1848, brawlerCount: 61 },
    ])
    await POST(req('/mapa'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('MAPAS CON DATOS HOY')
    expect(body.text).toContain('Sidetrack')
    expect(body.text).toContain('Nutmeg')
  })

  it('/mapa sidetrack renders detailed map response', async () => {
    findMapByPrefixMock.mockResolvedValue({ kind: 'found', map: 'Sidetrack', mode: 'brawlBall' })
    getMapDataMock.mockResolvedValue(makeMapData())
    await POST(req('/mapa sidetrack'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('SIDETRACK')
    expect(body.text).toContain('TOP 5 BRAWLERS')
    expect(body.text).toContain('81 / 82')
  })

  it('/mapa xyzxyz replies with not-found', async () => {
    findMapByPrefixMock.mockResolvedValue({ kind: 'none' })
    await POST(req('/mapa xyzxyz'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain("No hay mapa que empiece por 'xyzxyz'")
  })

  it('/mapa bea replies with ambiguous list', async () => {
    findMapByPrefixMock.mockResolvedValue({
      kind: 'ambiguous',
      candidates: [
        { map: 'Beach Ball',  mode: 'brawlBall' },
        { map: 'Bea Stadium', mode: 'knockout'  },
      ],
    })
    await POST(req('/mapa bea'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('Ambiguo')
    expect(body.text).toContain('Beach Ball')
    expect(body.text).toContain('Bea Stadium')
  })

  it('/mapa pit omits rankings when below MIN_BATTLES_FOR_RANKING', async () => {
    findMapByPrefixMock.mockResolvedValue({ kind: 'found', map: 'Pit Stop', mode: 'heist' })
    getMapDataMock.mockResolvedValue(makeMapData({
      map: 'Pit Stop', mode: 'heist', battlesToday: 2,
      topWinRates: [], bottomWinRates: [],
    }))
    await POST(req('/mapa pit'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('Datos insuficientes para ranking fiable')
    expect(body.text).not.toContain('TOP 5 BRAWLERS')
  })

  it('/mapa SIDE (uppercase) still resolves and renders', async () => {
    findMapByPrefixMock.mockResolvedValue({ kind: 'found', map: 'Sidetrack', mode: 'brawlBall' })
    getMapDataMock.mockResolvedValue(makeMapData())
    await POST(req('/mapa SIDE'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('SIDETRACK')
    // findMapByPrefix should receive the raw arg (normalisation is its job via ilike)
    expect(findMapByPrefixMock).toHaveBeenCalledWith('SIDE')
  })
})
