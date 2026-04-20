#!/usr/bin/env node
/**
 * Adds the `brawlers.sortTrend` translation key across all 13
 * locales — one string, used by the new "Sort by trend" option on
 * /profile/[tag]/brawlers. Idempotent.
 */

const fs = require('fs')
const path = require('path')

const MESSAGES_DIR = path.join(__dirname, '..', 'messages')

const COPY = {
  es: 'Tendencia',
  en: 'Trend',
  fr: 'Tendance',
  pt: 'Tendência',
  de: 'Trend',
  it: 'Andamento',
  ru: 'Тренд',
  tr: 'Trend',
  pl: 'Trend',
  ar: 'الاتجاه',
  ko: '추세',
  ja: 'トレンド',
  zh: '趋势',
}

let changed = 0
for (const [locale, value] of Object.entries(COPY)) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)
  if (!data.brawlers) {
    console.error(`[${locale}] brawlers namespace missing`)
    process.exit(1)
  }
  if (data.brawlers.sortTrend !== value) {
    data.brawlers.sortTrend = value
    const trailing = raw.endsWith('\n') ? '\n' : ''
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + trailing, 'utf-8')
    changed++
    console.log(`[${locale}] updated`)
  } else {
    console.log(`[${locale}] unchanged`)
  }
}
console.log(`\n${changed} locale(s) updated.`)
