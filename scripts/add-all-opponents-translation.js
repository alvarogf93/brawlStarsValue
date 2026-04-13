#!/usr/bin/env node
// Sprint D — add advancedAnalytics.allOpponents × 13 locales
//
// Used by the MatchupMatrix opponent filter added alongside the
// existing "all brawlers" filter. Both selects share the same
// styling; the strings differ only semantically (my brawler vs
// opponent).

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const ALL_OPPONENTS = {
  es: 'Todos los oponentes',
  en: 'All opponents',
  fr: 'Tous les adversaires',
  pt: 'Todos os oponentes',
  it: 'Tutti gli avversari',
  de: 'Alle Gegner',
  pl: 'Wszyscy przeciwnicy',
  tr: 'Tüm rakipler',
  ru: 'Все противники',
  ar: 'جميع الخصوم',
  ja: '全ての相手',
  ko: '모든 상대',
  zh: '所有对手',
}

let total = 0
for (const locale of LOCALES) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (!data.advancedAnalytics) data.advancedAnalytics = {}
  data.advancedAnalytics.allOpponents = ALL_OPPONENTS[locale]
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  console.log(`  ${locale.padEnd(3)}  → ${ALL_OPPONENTS[locale]}`)
  total++
}
console.log(`\n✓ ${total}/${LOCALES.length} locales updated`)
