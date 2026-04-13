#!/usr/bin/env node
// Sprint D — Club page mode leaders section i18n batch
// Adds 1 new key to the `club` namespace across all 13 locales.
//
//   club.modeLeadersTitle  — section heading for the per-mode leader grid
//                            that replaced the old worst-player / trophy-
//                            spread cards.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: { modeLeadersTitle: 'Líderes por modo' },
  en: { modeLeadersTitle: 'Mode leaders' },
  fr: { modeLeadersTitle: 'Leaders par mode' },
  pt: { modeLeadersTitle: 'Líderes por modo' },
  it: { modeLeadersTitle: 'Leader per modalità' },
  de: { modeLeadersTitle: 'Modus-Anführer' },
  pl: { modeLeadersTitle: 'Liderzy trybu' },
  tr: { modeLeadersTitle: 'Mod liderleri' },
  ru: { modeLeadersTitle: 'Лидеры по режимам' },
  ar: { modeLeadersTitle: 'قادة الأوضاع' },
  ja: { modeLeadersTitle: 'モードリーダー' },
  ko: { modeLeadersTitle: '모드별 리더' },
  zh: { modeLeadersTitle: '模式领袖' },
}

function updateLocale(locale) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)
  const additions = TRANSLATIONS[locale]

  if (!additions) {
    console.error(`✗ No translations defined for locale "${locale}"`)
    return { added: 0 }
  }

  if (!data.club) data.club = {}
  let addedCount = 0
  for (const [key, value] of Object.entries(additions)) {
    data.club[key] = value
    addedCount++
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  return { added: addedCount }
}

console.log('Sprint D — Club mode leaders i18n batch\n')
let total = 0
for (const locale of LOCALES) {
  const result = updateLocale(locale)
  console.log(`  ${locale.padEnd(3)}  +${result.added} new keys`)
  total += result.added
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated`)
console.log(`  Total: +${total} key-additions`)
