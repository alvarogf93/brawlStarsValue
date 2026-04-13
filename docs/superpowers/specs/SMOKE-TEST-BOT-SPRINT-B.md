# Smoke Test — Telegram Bot Sprint B

Run this checklist **once** after each production deploy that touches `src/app/api/telegram/webhook/` or `src/lib/telegram/`. Takes ~3 minutes.

## Quick run (automated)

```bash
node scripts/smoke-test-bot.js --confirm prod
```

The script posts the 9 command paths + 3 auth failures to production and prints HTTP results. The happy-path responses arrive in the admin Telegram chat asynchronously — cross-reference visually with the checklist below.

## Prerequisites

- Deploy is live on `brawlvision.com`.
- `TELEGRAM_WEBHOOK_SECRET` is set in Vercel production and matches `.env.local`.
- `node scripts/setup-telegram-webhook.js` has been run at least once after rotating the secret.

## Command happy paths

- [ ] `/help` → receive full command list with all 6 commands.
- [ ] `/stats` → receive message with 5 sections (Usuarios, Actividad, Meta poll, Top 3 mapas, Top 3 brawlers). Sparklines present.
- [ ] `/batallas` → receive message with 4 sections (Volumen, Distribución por modo, Resultado, Top 5 players) + Sync status.
- [ ] `/premium` → receive 3 sections. "Requires integration" placeholder visible for LTV.
- [ ] `/cron` → pg_cron section with 3 jobs + VPS freshness section + healthchecks.io note.
- [ ] `/mapa` → listado with 40+ maps.
- [ ] `/mapa sidetrack` → detailed map response with top/bottom brawlers and comparison.

## Error paths

- [ ] `/mapa xyzxyz` → "No hay mapa que empiece por 'xyzxyz'".
- [ ] `/foo` → "Comando no reconocido. Prueba /help".

## Auth

- [ ] L2 fail: send a message from a secondary Telegram account. You should receive NO response. Check Vercel Function logs for "L2 auth fail" warning.
- [ ] L1 fail: curl the webhook URL without the secret header:

  ```bash
  curl -X POST https://brawlvision.com/api/telegram/webhook \
    -H 'Content-Type: application/json' \
    -d '{"message":{"text":"/stats","chat":{"id":"1","type":"private"},"message_id":1,"date":0},"update_id":1}'
  ```

  Expected: 200 response. No message sent to the admin chat. Check Vercel logs for "L1 auth fail" warning.

## If any step fails

1. Check Vercel Function logs under Deployments → Functions → `/api/telegram/webhook`.
2. Verify `TELEGRAM_WEBHOOK_SECRET` matches between Vercel and the `setWebhook` call (run `scripts/setup-telegram-webhook.js` to sync).
3. Verify `TELEGRAM_CHAT_ID` in Vercel matches your Telegram chat id.
4. Re-run this checklist.
