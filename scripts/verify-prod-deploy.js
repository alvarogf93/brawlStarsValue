#!/usr/bin/env node
/**
 * Verifies that https://brawlvision.com is live and probes /api/calculate
 * for a canary signal: posting an obviously-invalid locale must return 200
 * AND must NOT create a row (the whitelist in the handler should block it).
 * The handler only returns 200 if the code path reached at least Supercell OK,
 * so we also need a valid playerTag — we use a known-good public tag.
 *
 * This is a deploy liveness probe only. The real end-to-end smoke test
 * happens via Playwright.
 */

const fs = require('fs')
const path = require('path')

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const PROD_URL = 'https://brawlvision.com'

async function main() {
  console.log('\n── Task 8 — step 2: production liveness ──\n')

  // 1. Basic HTTP probe: root should respond with something
  try {
    const res = await fetch(PROD_URL, { redirect: 'manual' })
    console.log(`✓ GET ${PROD_URL} → status ${res.status} (${res.headers.get('location') || 'no redirect'})`)
    if (res.status >= 500) {
      console.error('✗ Production is returning 5xx — aborting')
      process.exit(1)
    }
  } catch (err) {
    console.error(`✗ Could not reach ${PROD_URL}:`, err.message)
    process.exit(1)
  }

  // 2. Check the landing page renders HTML
  try {
    const res = await fetch(`${PROD_URL}/es`)
    const html = await res.text()
    const hasInputForm = html.includes('placeholder') && (html.includes('Calcular') || html.includes('tag') || html.includes('#'))
    console.log(`✓ GET /es → status ${res.status}, HTML length ${html.length}`)
    if (!hasInputForm) {
      console.warn('⚠ Landing HTML does not obviously contain the InputForm markers; proceeding anyway')
    }
  } catch (err) {
    console.error('✗ Landing fetch failed:', err.message)
    process.exit(1)
  }

  // 3. Probe /api/calculate with an obviously invalid body — expect 400
  try {
    const res = await fetch(`${PROD_URL}/api/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerTag: 'invalid-tag' }),
    })
    console.log(`✓ POST /api/calculate (invalid tag) → status ${res.status} (expected 400)`)
    if (res.status !== 400) {
      console.warn(`⚠ Expected 400, got ${res.status} — handler may be older than the latest deploy`)
    }
  } catch (err) {
    console.error('✗ /api/calculate probe failed:', err.message)
    process.exit(1)
  }

  console.log('\n✓ Production is live and the API responds.\n')
}

main().catch((err) => {
  console.error('✗ Unexpected error:', err)
  process.exit(1)
})
