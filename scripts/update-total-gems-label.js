#!/usr/bin/env node
// Sprint D — rename profile.totalGems label from "Total Real Gems"
// (and translations) to "Total Gems" / "Gemas totales" across all
// 13 locales. The "Real" qualifier was redundant since every gem
// shown is a real verified value already.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TOTAL_GEMS = {
  es: 'Gemas totales',
  en: 'Total Gems',
  fr: 'Gemmes totales',
  pt: 'Gemas totais',
  it: 'Gemme totali',
  de: 'Gesamte Edelsteine',
  pl: 'Wszystkie klejnoty',
  tr: 'Toplam Elmas',
  ru: 'Всего кристаллов',
  ar: 'إجمالي الجواهر',
  ja: '合計ジェム',
  ko: '총 보석',
  zh: '总宝石',
}

let total = 0
for (const locale of LOCALES) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (data.profile && data.profile.totalGems) {
    data.profile.totalGems = TOTAL_GEMS[locale]
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
    console.log(`  ${locale.padEnd(3)}  → ${TOTAL_GEMS[locale]}`)
    total++
  }
}
console.log(`\n✓ ${total}/${LOCALES.length} locales updated`)
