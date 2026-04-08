#!/usr/bin/env node
/**
 * Setup PayPal subscription plans for BrawlVision Premium.
 * Run ONCE: node scripts/setup-paypal-plans.js
 *
 * Requires: PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_MODE in .env.local
 *
 * Output: Plan IDs to add to .env.local as:
 *   PAYPAL_PLAN_MONTHLY=P-xxx
 *   PAYPAL_PLAN_QUARTERLY=P-xxx
 *   PAYPAL_PLAN_YEARLY=P-xxx
 */

require('dotenv').config({ path: '.env.local' })

const BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

async function getToken() {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64')
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`)
  return (await res.json()).access_token
}

async function createProduct(token) {
  const res = await fetch(`${BASE}/v1/catalogs/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'BrawlVision Premium',
      description: 'Brawl Stars combat analytics subscription',
      type: 'SERVICE',
      category: 'SOFTWARE',
    }),
  })
  if (!res.ok) throw new Error(`Create product failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  console.log(`✓ Product created: ${data.id}`)
  return data.id
}

async function createPlan(token, productId, name, price, intervalUnit, intervalCount) {
  const res = await fetch(`${BASE}/v1/billing/plans`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: productId,
      name,
      billing_cycles: [{
        frequency: { interval_unit: intervalUnit, interval_count: intervalCount },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: price, currency_code: 'EUR' } },
      }],
      payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 },
    }),
  })
  if (!res.ok) throw new Error(`Create plan failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  console.log(`✓ Plan "${name}" created: ${data.id} (€${price})`)
  return data.id
}

async function main() {
  console.log(`\nPayPal ${process.env.PAYPAL_MODE === 'live' ? 'LIVE' : 'SANDBOX'} Setup\n`)

  const token = await getToken()
  console.log('✓ Authenticated\n')

  const productId = await createProduct(token)

  const monthly = await createPlan(token, productId, 'BrawlVision Monthly', '2.99', 'MONTH', 1)
  const quarterly = await createPlan(token, productId, 'BrawlVision Quarterly', '5.99', 'MONTH', 3)
  const yearly = await createPlan(token, productId, 'BrawlVision Yearly', '19.99', 'YEAR', 1)

  console.log('\n── Add these to .env.local ──')
  console.log(`PAYPAL_PLAN_MONTHLY=${monthly}`)
  console.log(`PAYPAL_PLAN_QUARTERLY=${quarterly}`)
  console.log(`PAYPAL_PLAN_YEARLY=${yearly}`)
  console.log(`PAYPAL_PRODUCT_ID=${productId}`)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
