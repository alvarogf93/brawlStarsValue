#!/usr/bin/env node
// /[locale]/profile/[tag]/analytics#team — adds the "Maps in rotation"
// filter option to the trio-synergy map selector. Sits in the existing
// `advancedAnalytics` namespace next to `allMaps`.
//
// Idempotent: re-running overwrites the keys.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: { rotationMaps: 'Mapas en Rotación', rotationMapsEmpty: 'No hay datos para los mapas en rotación. Cambia el filtro o juega más con esos mapas.' },
  en: { rotationMaps: 'Maps in Rotation', rotationMapsEmpty: 'No data for the maps in the current rotation. Change the filter or play those maps more.' },
  fr: { rotationMaps: 'Cartes en Rotation', rotationMapsEmpty: 'Pas de données pour les cartes en rotation. Change le filtre ou joue plus sur ces cartes.' },
  pt: { rotationMaps: 'Mapas em Rotação', rotationMapsEmpty: 'Sem dados para os mapas em rotação. Troca o filtro ou joga mais esses mapas.' },
  de: { rotationMaps: 'Karten in Rotation', rotationMapsEmpty: 'Keine Daten für die Karten in Rotation. Filter ändern oder diese Karten mehr spielen.' },
  it: { rotationMaps: 'Mappe in Rotazione', rotationMapsEmpty: 'Nessun dato per le mappe in rotazione. Cambia filtro o gioca di più su quelle mappe.' },
  ru: { rotationMaps: 'Карты в ротации', rotationMapsEmpty: 'Нет данных по картам в ротации. Поменяй фильтр или играй больше на этих картах.' },
  tr: { rotationMaps: 'Rotasyondaki Haritalar', rotationMapsEmpty: 'Rotasyondaki haritalar için veri yok. Filtreyi değiştir veya o haritalarda daha çok oyna.' },
  pl: { rotationMaps: 'Mapy w Rotacji', rotationMapsEmpty: 'Brak danych dla map w rotacji. Zmień filtr lub graj więcej na tych mapach.' },
  ar: { rotationMaps: 'الخرائط في الدوران', rotationMapsEmpty: 'لا توجد بيانات لخرائط الدوران. غيّر الفلتر أو العب أكثر على تلك الخرائط.' },
  ko: { rotationMaps: '로테이션 맵', rotationMapsEmpty: '로테이션 맵에 데이터가 없습니다. 필터를 변경하거나 해당 맵에서 더 플레이하세요.' },
  ja: { rotationMaps: 'ローテーション中のマップ', rotationMapsEmpty: 'ローテーション中のマップのデータがありません。フィルターを変えるか、それらのマップでもっとプレイしてください。' },
  zh: { rotationMaps: '轮换中的地图', rotationMapsEmpty: '没有轮换中地图的数据。更改过滤器或在这些地图上多玩。' },
}

let totalAdditions = 0
for (const locale of LOCALES) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (!data.advancedAnalytics) data.advancedAnalytics = {}
  const ns = TRANSLATIONS[locale]
  if (!ns) continue
  Object.assign(data.advancedAnalytics, ns)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  totalAdditions += Object.keys(ns).length
  console.log(`  ${locale.padEnd(3)}  advancedAnalytics rotation keys (${Object.keys(ns).length})`)
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated`)
console.log(`  Total: ${totalAdditions} key-additions`)
