import { fetchWithRetry } from './http'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

/**
 * Send a notification to the admin Telegram chat.
 * Fire-and-forget — never throws, never blocks.
 *
 * PERF-01: 5 s timeout + 1 retry. Sending an admin message twice is harmless
 * if the first attempt actually delivered, so retries are safe. No circuit
 * breaker — call rate is too low to justify per-domain state.
 */
export async function notify(message: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return

  try {
    await fetchWithRetry(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      },
      { retries: 1, timeoutMs: 5_000 },
    )
  } catch {
    // Silent fail — notifications should never break the app
  }
}
