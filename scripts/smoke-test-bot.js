#!/usr/bin/env node
// Telegram bot smoke test runner. Posts real updates to the production
// webhook; happy paths trigger real responses in the admin's Telegram
// chat; auth failures are verified from the HTTP response.
//
// Usage:
//   node scripts/smoke-test-bot.js --confirm prod
//
// The --confirm prod flag is REQUIRED. Without it the script aborts.
// This guard exists because the script hits production and sends real
// messages to the admin chat — easy to run accidentally during dev.
//
// Prerequisites:
//   - .env.local must contain TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET,
//     TELEGRAM_CHAT_ID (same values used by Vercel production).
//   - scripts/setup-telegram-webhook.js has been run at least once so
//     Telegram's registered webhook points to brawlvision.com.
//
// Coverage: the 9 command happy/error paths + 3 auth failures documented
// in docs/superpowers/specs/SMOKE-TEST-BOT-SPRINT-B.md.

const fs = require('fs')
const path = require('path')

// ─── Prod confirmation gate ────────────────────────────────────────
const args = process.argv.slice(2)
const confirmIdx = args.indexOf('--confirm')
const confirmed = confirmIdx >= 0 && args[confirmIdx + 1] === 'prod'

if (!confirmed) {
  console.error('✗ Missing --confirm prod flag.')
  console.error('')
  console.error('This script sends real Telegram messages to the admin chat')
  console.error('via the production webhook at brawlvision.com. To prevent')
  console.error('accidental runs during development, you must pass:')
  console.error('')
  console.error('    node scripts/smoke-test-bot.js --confirm prod')
  console.error('')
  process.exit(1)
}

// ─── Load .env.local ───────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env.local')
try {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
} catch (err) {
  console.error('✗ Could not read .env.local:', err.message)
  process.exit(1)
}

const WEBHOOK_URL = 'https://brawlvision.com/api/telegram/webhook'
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

if (!SECRET || !CHAT_ID) {
  console.error('✗ Missing TELEGRAM_WEBHOOK_SECRET or TELEGRAM_CHAT_ID in .env.local')
  process.exit(1)
}

function makeUpdate(text, chatId = CHAT_ID) {
  return {
    update_id: Math.floor(Math.random() * 1e9),
    message: {
      message_id: Math.floor(Math.random() * 1e9),
      date: Math.floor(Date.now() / 1000),
      chat: { id: Number(chatId), type: 'private' },
      from: { id: Number(chatId), username: 'smoke_test' },
      text,
    },
  }
}

async function post(text, opts = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (!opts.omitSecret) {
    headers['x-telegram-bot-api-secret-token'] = opts.wrongSecret ? 'wrong-secret' : SECRET
  }
  const body = JSON.stringify(makeUpdate(text, opts.chatId))
  const start = Date.now()
  const res = await fetch(WEBHOOK_URL, { method: 'POST', headers, body })
  const elapsed = Date.now() - start
  const replyBody = await res.text().catch(() => '(unreadable)')
  return { status: res.status, elapsed, body: replyBody }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log('=== Telegram bot smoke test — ' + new Date().toISOString() + ' ===\n')
  console.log('Webhook URL:', WEBHOOK_URL)
  console.log('Chat ID    :', CHAT_ID.slice(0, 4) + '***')
  console.log('')

  // Happy paths — sequential with 1.2s gap so the admin chat receives
  // the responses in a readable order. Each POST returns immediately,
  // but the response arrives asynchronously.
  const happy = [
    { label: '/help',               text: '/help' },
    { label: '/stats',              text: '/stats' },
    { label: '/batallas',           text: '/batallas' },
    { label: '/premium',            text: '/premium' },
    { label: '/cron',               text: '/cron' },
    { label: '/mapa (list)',        text: '/mapa' },
    { label: '/mapa sidetrack',     text: '/mapa sidetrack' },
    { label: '/mapa xyzxyz (404)',  text: '/mapa xyzxyz' },
    { label: '/foo (unknown)',      text: '/foo' },
  ]

  console.log('── HAPPY PATHS (9) ──')
  for (const t of happy) {
    const r = await post(t.text)
    const ok = r.status === 200 && r.body.includes('"ok":true')
    console.log(`  ${ok ? '✓' : '✗'} ${t.label.padEnd(24)} HTTP ${r.status} (${r.elapsed}ms)`)
    await sleep(1200)
  }

  // Auth failures — both return 200 with { ok: true } and NO message
  // must appear in the admin chat.
  console.log('\n── AUTH FAILURES (3) ──')

  const l1 = await post('/stats', { omitSecret: true })
  const l1Ok = l1.status === 200 && l1.body.includes('"ok":true')
  console.log(`  ${l1Ok ? '✓' : '✗'} L1 fail (no header)       HTTP ${l1.status} (${l1.elapsed}ms)`)

  const l1b = await post('/stats', { wrongSecret: true })
  const l1bOk = l1b.status === 200 && l1b.body.includes('"ok":true')
  console.log(`  ${l1bOk ? '✓' : '✗'} L1 fail (wrong header)    HTTP ${l1b.status} (${l1b.elapsed}ms)`)

  const l2 = await post('/stats', { chatId: '99999999' })
  const l2Ok = l2.status === 200 && l2.body.includes('"ok":true')
  console.log(`  ${l2Ok ? '✓' : '✗'} L2 fail (wrong chat_id)   HTTP ${l2.status} (${l2.elapsed}ms)`)

  console.log('\n=== Done ===')
  console.log('Now check the admin Telegram chat:')
  console.log('  - You should see 9 bot responses (7 commands + 2 error messages)')
  console.log('  - You should NOT see anything from the 3 auth-failure calls')
  console.log('  - Cross-reference against docs/superpowers/specs/SMOKE-TEST-BOT-SPRINT-B.md')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
