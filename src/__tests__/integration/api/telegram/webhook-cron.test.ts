import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CronData } from '@/lib/telegram/types'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const getCronStatusMock = vi.fn<() => Promise<CronData>>()

vi.mock('@/lib/telegram/queries', () => ({
  queries: {
    getStats: vi.fn(),
    getBattles: vi.fn(),
    getPremium: vi.fn(),
    getCronStatus: () => getCronStatusMock(),
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

function makeCronData(overrides: Partial<CronData> = {}): CronData {
  const nowIso = new Date().toISOString()
  return {
    pgCronJobs: [
      { jobid: 1, jobname: 'enqueue-premium-syncs',    schedule: '*/15 * * * *', active: true, command: '' },
      { jobid: 2, jobname: 'process-sync-queue',       schedule: '*/5 * * * *',  active: true, command: '' },
      { jobid: 3, jobname: 'cleanup-anonymous-visits', schedule: '0 3 * * *',    active: true, command: '' },
    ],
    cronRuns: [
      { jobid: 1, jobname: 'enqueue-premium-syncs',    status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
      { jobid: 2, jobname: 'process-sync-queue',       status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
      { jobid: 3, jobname: 'cleanup-anonymous-visits', status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
    ],
    runsByJob: new Map([
      ['enqueue-premium-syncs', 96],
      ['process-sync-queue', 288],
      ['cleanup-anonymous-visits', 1],
    ]),
    metaPollFreshness: { ageMs: 10 * 60 * 1000, status: 'fresh' },
    syncFreshness:     { ageMs: 18 * 60 * 1000, status: 'fresh' },
    ...overrides,
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' })
  getCronStatusMock.mockReset()
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET
  process.env.TELEGRAM_CHAT_ID = CHAT_ID
})

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  delete process.env.TELEGRAM_CHAT_ID
})

describe('POST /api/telegram/webhook — /cron', () => {
  it('renders all 3 pg_cron jobs green + VPS fresh', async () => {
    getCronStatusMock.mockResolvedValue(makeCronData())
    await POST(req('/cron'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('PG_CRON JOBS')
    expect(body.text).toContain('96 / 96 expected')
    expect(body.text).toContain('288 / 288 expected')
    expect(body.text).toContain('✅')
  })

  it('marks failed runs with ❌ and shows return_message', async () => {
    const nowIso = new Date().toISOString()
    getCronStatusMock.mockResolvedValue(makeCronData({
      cronRuns: [
        { jobid: 1, jobname: 'enqueue-premium-syncs', status: 'failed', return_message: 'ERROR: duplicate key', start_time: nowIso, end_time: nowIso },
        { jobid: 2, jobname: 'process-sync-queue', status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
        { jobid: 3, jobname: 'cleanup-anonymous-visits', status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
      ],
    }))
    await POST(req('/cron'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('❌')
    expect(body.text).toContain('duplicate key')
  })

  it('renders stale and dead VPS status', async () => {
    getCronStatusMock.mockResolvedValue(makeCronData({
      metaPollFreshness: { ageMs: 45 * 60 * 1000, status: 'stale' },
      syncFreshness:     { ageMs: 90 * 60 * 1000, status: 'dead'  },
    }))
    await POST(req('/cron'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('🟡')
    expect(body.text).toContain('🔴')
  })

  it('renders "(no disponible)" when pgCronJobs is empty', async () => {
    getCronStatusMock.mockResolvedValue(makeCronData({
      pgCronJobs: [], cronRuns: [], runsByJob: new Map(),
    }))
    await POST(req('/cron'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('(no disponible)')
  })
})
