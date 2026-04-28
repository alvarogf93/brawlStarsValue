import { fetchWithRetry } from '../http'

/**
 * Send a message to a specific Telegram chat via the Bot API.
 *
 * Distinct from `notify()` in `src/lib/telegram.ts`:
 *   - Takes `chatId` as a parameter (future-proof for multi-chat / digest).
 *   - Logs failures loudly — the bot webhook NEEDS to see these in Vercel logs
 *     to diagnose production issues.
 *
 * PERF-01: 5 s timeout + 1 retry. Same idempotency rationale as `notify`.
 *
 * Never throws. Callers can `await` it but do not need to try/catch.
 */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.error('[telegram/sender] TELEGRAM_BOT_TOKEN is not set')
    return
  }

  try {
    const res = await fetchWithRetry(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      },
      { retries: 1, timeoutMs: 5_000 },
    )
    if (!res.ok) {
      const errBody = await res.text().catch(() => '(unreadable)')
      console.error('[telegram/sender] sendMessage returned non-ok', {
        status: res.status,
        body: errBody.slice(0, 500),
      })
    }
  } catch (err) {
    console.error('[telegram/sender] fetch threw', err)
  }
}
