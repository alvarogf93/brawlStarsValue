#!/usr/bin/env node
/**
 * Adds the `brawlers.lockedLabel` key to all 13 locale files.
 *
 * Used by /profile/[tag]/brawlers/page.tsx to label locked brawler cards
 * in the FAIL-NEW-BRAWLERS fix. Idempotent — re-running is a no-op.
 *
 * Run: node scripts/add-locked-translations.js
 */
const fs = require('fs')
const path = require('path')

const LOCALES = {
  es: 'Bloqueado',
  en: 'Locked',
  fr: 'Verrouillé',
  pt: 'Bloqueado',
  de: 'Gesperrt',
  it: 'Bloccato',
  ru: 'Заблокировано',
  tr: 'Kilitli',
  pl: 'Zablokowane',
  ar: 'مقفل',
  ko: '잠김',
  ja: 'ロック中',
  zh: '已锁定',
}

const messagesDir = path.join(__dirname, '..', 'messages')
let added = 0
let skipped = 0

for (const [locale, label] of Object.entries(LOCALES)) {
  const file = path.join(messagesDir, `${locale}.json`)
  if (!fs.existsSync(file)) {
    console.error(`  ✗ ${locale}: file missing`)
    continue
  }
  const json = JSON.parse(fs.readFileSync(file, 'utf-8'))
  if (!json.brawlers) {
    console.error(`  ✗ ${locale}: brawlers namespace missing`)
    continue
  }
  if (json.brawlers.lockedLabel) {
    skipped++
    continue
  }
  json.brawlers.lockedLabel = label
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf-8')
  console.log(`  ✓ ${locale}: added "${label}"`)
  added++
}

console.log(`\nDone. Added ${added}, skipped ${skipped}.`)
