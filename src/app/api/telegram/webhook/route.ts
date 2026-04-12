import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { commandRegistry, parseCommand } from '@/lib/telegram/dispatcher'
import { clampToTelegramLimit, escapeHtml } from '@/lib/telegram/formatters'
import { queries } from '@/lib/telegram/queries'
import { sendTelegramMessage } from '@/lib/telegram/sender'
import type { TelegramUpdate } from '@/lib/telegram/types'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

/**
 * Constant-time comparison of the L1 auth header against the expected secret.
 * Prevents byte-by-byte timing oracle on the secret value. The length check
 * exits early if the buffers differ — this reveals the secret's length, which
 * is acceptable: the entropy lives in the 256 bits of the hex value, not in
 * its length (which is a fixed 64-char convention).
 */
function safeCompareHeader(
  header: string | null,
  expected: string | undefined,
): boolean {
  if (!header || !expected) return false
  const a = Buffer.from(header, 'utf-8')
  const b = Buffer.from(expected, 'utf-8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * POST /api/telegram/webhook
 *
 * Receives Telegram Bot API updates. 2-layer auth:
 *   1. `X-Telegram-Bot-Api-Secret-Token` header must equal TELEGRAM_WEBHOOK_SECRET.
 *   2. `message.chat.id` must equal TELEGRAM_CHAT_ID.
 *
 * Both failures return 200 OK silently (no fingerprinting for scanners,
 * no retries from Telegram). The webhook ALWAYS returns 200 — Telegram
 * retries aggressively on any non-2xx.
 */
export async function POST(request: Request) {
  try {
    // ── L1: secret header ────────────────────────────────────
    const headerSecret = request.headers.get('x-telegram-bot-api-secret-token')
    if (!safeCompareHeader(headerSecret, process.env.TELEGRAM_WEBHOOK_SECRET)) {
      console.warn('[telegram/webhook] L1 auth fail')
      return NextResponse.json({ ok: true })
    }

    // ── Body parse ───────────────────────────────────────────
    let body: TelegramUpdate
    try {
      body = (await request.json()) as TelegramUpdate
    } catch (parseErr) {
      console.error('[telegram/webhook] malformed body', parseErr)
      return NextResponse.json({ ok: true })
    }

    const message = body.message
    if (!message?.text) return NextResponse.json({ ok: true })

    // ── L2: chat_id match (String compare, not parseInt) ────
    if (String(message.chat.id) !== String(process.env.TELEGRAM_CHAT_ID)) {
      console.warn('[telegram/webhook] L2 auth fail', { chatId: message.chat.id })
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id

    // ── Dispatch ─────────────────────────────────────────────
    try {
      const { commandName, args } = parseCommand(message.text)
      if (!commandName) {
        // Non-command text — ignore. Replying would be noisy.
        return NextResponse.json({ ok: true })
      }
      const handler = commandRegistry.get(commandName)
      if (!handler) {
        await sendTelegramMessage(
          chatId,
          `❓ Comando no reconocido: <code>${escapeHtml(commandName)}</code>\n\nPrueba /help`,
        )
        return NextResponse.json({ ok: true })
      }
      const response = await handler({ args, queries })
      await sendTelegramMessage(chatId, clampToTelegramLimit(response))
    } catch (commandErr) {
      console.error('[telegram/webhook] command failed', {
        text: message.text,
        err: commandErr,
      })
      try {
        await sendTelegramMessage(
          chatId,
          [
            '💥 Error ejecutando el comando.',
            '',
            `<code>${escapeHtml(commandErr instanceof Error ? commandErr.message : 'unknown')}</code>`,
            '',
            'Revisa los logs de Vercel para el stack completo.',
          ].join('\n'),
        )
      } catch (sendErr) {
        console.error('[telegram/webhook] failed to send error message', sendErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (fatalErr) {
    console.error('[telegram/webhook] FATAL', fatalErr)
    return NextResponse.json({ ok: true })
  }
}
