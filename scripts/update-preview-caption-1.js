#!/usr/bin/env node
/**
 * Re-align `subscribe.previewCaption1` with the new overview-style
 * screenshot in the premium carousel. The old copy ("Detecta tu
 * tilt y mejora tu juego") targeted a tilt-detector preview that
 * no longer exists in the carousel — the tilt card moved into the
 * new performance slide (previewCaption2) instead.
 *
 * Idempotent.
 */

const fs = require('fs')
const path = require('path')

const MESSAGES_DIR = path.join(__dirname, '..', 'messages')

const COPY = {
  es: 'Todos tus datos en un solo vistazo',
  en: 'All your stats at a glance',
  fr: "Toutes tes stats d'un coup d'œil",
  pt: 'Todos os teus dados à vista',
  de: 'Alle Stats auf einen Blick',
  it: 'Tutte le tue statistiche a colpo d\'occhio',
  ru: 'Все твои данные в одном месте',
  tr: 'Tüm verilerin tek bakışta',
  pl: 'Wszystkie dane w jednym rzucie oka',
  ar: 'كل بياناتك في لمحة',
  ko: '한눈에 보는 모든 데이터',
  ja: 'すべてのデータを一目で',
  zh: '一览全部数据',
}

let changed = 0
for (const [locale, value] of Object.entries(COPY)) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)
  if (!data.subscribe) {
    console.error(`[${locale}] subscribe namespace missing`)
    process.exit(1)
  }
  if (data.subscribe.previewCaption1 !== value) {
    data.subscribe.previewCaption1 = value
    const trailing = raw.endsWith('\n') ? '\n' : ''
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + trailing, 'utf-8')
    changed++
    console.log(`[${locale}] updated`)
  } else {
    console.log(`[${locale}] unchanged`)
  }
}
console.log(`\n${changed} locale(s) updated.`)
