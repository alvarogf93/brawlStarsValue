#!/usr/bin/env node
// Footer link key for the upcoming /about page. Lives in the
// `landing` namespace next to methodologyLink, battleHistoryLink,
// privacyLink, contact. This script is split from the full /about
// page translations (which add a complete `about` namespace later
// in Fase 3.3) so the site-wide footer can link /about as soon as
// Fase 1.5 ships, without waiting for the article copy.
//
// Idempotent — re-running overwrites with the latest values.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const ABOUT_LINK = {
  es: 'Sobre nosotros',
  en: 'About',
  fr: 'À propos',
  pt: 'Sobre',
  de: 'Über uns',
  it: 'Chi siamo',
  ru: 'О нас',
  tr: 'Hakkımızda',
  pl: 'O nas',
  ar: 'من نحن',
  ko: '소개',
  ja: 'About',
  zh: '关于我们',
}

let updated = 0
for (const locale of LOCALES) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (!data.landing) data.landing = {}
  data.landing.aboutLink = ABOUT_LINK[locale]
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  console.log(`  ${locale.padEnd(3)}  landing.aboutLink = ${JSON.stringify(ABOUT_LINK[locale])}`)
  updated++
}
console.log(`\n✓ ${updated}/${LOCALES.length} locales updated`)
