const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

/**
 * Send a notification to the admin Telegram chat.
 * Fire-and-forget — never throws, never blocks.
 */
export async function notify(message: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    })
  } catch {
    // Silent fail — notifications should never break the app
  }
}
