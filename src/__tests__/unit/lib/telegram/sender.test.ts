import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// Import AFTER the global is stubbed.
import { sendTelegramMessage } from '@/lib/telegram/sender'

describe('sendTelegramMessage', () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN

  beforeEach(() => {
    fetchMock.mockReset()
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
  })

  afterEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = originalToken
  })

  it('posts to the Telegram sendMessage endpoint with HTML parse mode', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })

    await sendTelegramMessage(123, '<b>hola</b>')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.telegram.org/bottest-bot-token/sendMessage')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body as string)
    expect(body).toEqual({
      chat_id: 123,
      text: '<b>hola</b>',
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })
  })

  it('logs a warning when fetch throws but never rethrows', async () => {
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValue(new Error('network fail'))

    await expect(sendTelegramMessage(123, 'x')).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('returns early without fetching when TELEGRAM_BOT_TOKEN is missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await sendTelegramMessage(123, 'x')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
