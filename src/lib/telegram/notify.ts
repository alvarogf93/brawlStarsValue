import { sendTelegramMessage } from './sender'

/**
 * Send a notification to the admin Telegram chat.
 *
 * ARQ-04 — this is now a thin wrapper around `sendTelegramMessage` so the
 * Telegram surface lives in a single directory. Old contract preserved:
 * fire-and-forget, never throws, no-ops when the env vars are absent.
 *
 * PERF-01 timeout/retry behaviour comes from `sendTelegramMessage`'s
 * `fetchWithRetry` call (5 s timeout + 1 retry, idempotent — sending an
 * admin message twice is acceptable if the first delivered).
 */
export async function notify(message: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) return

  // sendTelegramMessage already swallows its own errors and logs to
  // console.error — calling it bare keeps notify() the silent-by-design
  // entry point its callers expect (paypal webhook, signup notify,
  // anonymous-visits).
  await sendTelegramMessage(chatId, message)
}
