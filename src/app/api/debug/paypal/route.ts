import { NextResponse } from 'next/server'

/**
 * GET /api/debug/paypal
 * Temporary diagnostic endpoint — DELETE after fixing PayPal auth.
 * Shows env var state without exposing full secrets.
 */
export async function GET() {
  const clientId = process.env.PAYPAL_CLIENT_ID ?? ''
  const secret = process.env.PAYPAL_SECRET ?? ''
  const mode = process.env.PAYPAL_MODE
  const nodeEnv = process.env.NODE_ENV

  const base = mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'

  // Test actual auth
  let authResult: string
  try {
    const auth = Buffer.from(`${clientId}:${secret}`).toString('base64')
    const res = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    if (res.ok) {
      authResult = 'SUCCESS'
    } else {
      const body = await res.text().catch(() => '')
      authResult = `FAIL ${res.status}: ${body.substring(0, 200)}`
    }
  } catch (e) {
    authResult = `ERROR: ${e instanceof Error ? e.message : 'unknown'}`
  }

  return NextResponse.json({
    PAYPAL_MODE: mode ?? 'NOT SET',
    NODE_ENV: nodeEnv,
    baseUrl: base,
    clientId: clientId ? `${clientId.substring(0, 8)}...${clientId.substring(clientId.length - 4)} (len=${clientId.length})` : 'NOT SET',
    secret: secret ? `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)} (len=${secret.length})` : 'NOT SET',
    planMonthly: process.env.PAYPAL_PLAN_MONTHLY ? 'SET' : 'NOT SET',
    planQuarterly: process.env.PAYPAL_PLAN_QUARTERLY ? 'SET' : 'NOT SET',
    planYearly: process.env.PAYPAL_PLAN_YEARLY ? 'SET' : 'NOT SET',
    webhookId: process.env.PAYPAL_WEBHOOK_ID ? 'SET' : 'NOT SET',
    authResult,
  })
}
