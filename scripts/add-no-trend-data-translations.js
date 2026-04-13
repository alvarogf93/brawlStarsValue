#!/usr/bin/env node
// Sprint D — add brawlerDetail.noTrendData key across 13 locales
//
// Used by the brawler detail page when the 7-day trend can't be
// computed (cron has no historical data in one of the windows).
// Replaces the false "Estable" label that pre-Sprint D was shown
// for every brawler simply because the cron lacked old data.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const NO_TREND_DATA = {
  es: 'Sin datos',
  en: 'No data',
  fr: 'Pas de données',
  pt: 'Sem dados',
  it: 'Senza dati',
  de: 'Keine Daten',
  pl: 'Brak danych',
  tr: 'Veri yok',
  ru: 'Нет данных',
  ar: 'لا توجد بيانات',
  ja: 'データなし',
  ko: '데이터 없음',
  zh: '无数据',
}

let total = 0
for (const locale of LOCALES) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (!data.brawlerDetail) data.brawlerDetail = {}
  data.brawlerDetail.noTrendData = NO_TREND_DATA[locale]
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  console.log(`  ${locale.padEnd(3)}  → ${NO_TREND_DATA[locale]}`)
  total++
}
console.log(`\n✓ ${total}/${LOCALES.length} locales updated`)
