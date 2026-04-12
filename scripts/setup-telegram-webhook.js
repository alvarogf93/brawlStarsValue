#!/usr/bin/env node
// Idempotent one-shot script to register the Telegram webhook URL.
// Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from .env.local.
//
// Usage:
//   node scripts/setup-telegram-webhook.js
//
// Re-running is safe — Telegram replaces the existing webhook.

const fs = require('fs')
const path = require('path')

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

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const WEBHOOK_URL = 'https://brawlvision.com/api/telegram/webhook'

async function main() {
  if (!BOT_TOKEN || !WEBHOOK_SECRET) {
    console.error('✗ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET in .env.local')
    process.exit(1)
  }

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      allowed_updates: ['message'],
      secret_token: WEBHOOK_SECRET,
      drop_pending_updates: true,
    }),
  })

  const data = await res.json()
  if (!data.ok) {
    console.error('✗ setWebhook failed:', data)
    process.exit(1)
  }
  console.log('✓ Webhook registered at', WEBHOOK_URL)
  console.log('  description:', data.description)

  const infoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`)
  const info = await infoRes.json()
  console.log('\nCurrent webhook info:')
  console.log('  url:', info.result.url)
  console.log('  pending_updates:', info.result.pending_update_count)
  console.log('  last_error:', info.result.last_error_message ?? '(none)')
  console.log('  allowed_updates:', info.result.allowed_updates)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
