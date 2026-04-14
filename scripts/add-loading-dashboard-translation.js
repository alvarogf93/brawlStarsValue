#!/usr/bin/env node
// Adds the `landing.loadingDashboard` i18n key in 13 locales.
// Shown in InputForm as a loading placeholder while the post-OAuth
// redirect is resolving (the brief window between "AuthProvider has
// a profile" and "router.replace has navigated away"), so the user
// doesn't see the search form flash before the redirect fires.
//
// Idempotent: re-running overwrites the existing key with the same value.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: 'Cargando tu panel...',
  en: 'Loading your dashboard...',
  fr: 'Chargement de ton tableau de bord...',
  pt: 'Carregando seu painel...',
  de: 'Dein Dashboard wird geladen...',
  it: 'Caricamento del tuo pannello...',
  ru: 'Загружаем твою панель...',
  tr: 'Panelin yükleniyor...',
  pl: 'Ładowanie panelu...',
  ar: 'جاري تحميل لوحتك...',
  ko: '대시보드 불러오는 중...',
  ja: 'ダッシュボードを読み込み中...',
  zh: '正在加载你的面板...',
}

let total = 0
for (const locale of LOCALES) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (!data.landing) data.landing = {}
  data.landing.loadingDashboard = TRANSLATIONS[locale]
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  console.log(`  ${locale.padEnd(3)}  + landing.loadingDashboard`)
  total++
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated, +${total} keys`)
