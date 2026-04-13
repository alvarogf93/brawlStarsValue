#!/usr/bin/env node
// Sprint D — MatchupMatrix redesign i18n batch
// Adds 3 new keys under advancedAnalytics × 13 locales:
//
//   matchupVs                — short "vs" label for the opponent filter slot
//   clearFilters             — "clear filters" button label
//   matchupsEmptyFiltered    — empty state specific to "filters yield zero rows"

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: {
    matchupVs: 'Contra',
    clearFilters: 'Limpiar filtros',
    matchupsEmptyFiltered: 'No tienes batallas con esta combinación',
  },
  en: {
    matchupVs: 'Vs',
    clearFilters: 'Clear filters',
    matchupsEmptyFiltered: 'No battles found for this combination',
  },
  fr: {
    matchupVs: 'Contre',
    clearFilters: 'Effacer les filtres',
    matchupsEmptyFiltered: 'Aucun combat pour cette combinaison',
  },
  pt: {
    matchupVs: 'Contra',
    clearFilters: 'Limpar filtros',
    matchupsEmptyFiltered: 'Sem batalhas para esta combinação',
  },
  it: {
    matchupVs: 'Contro',
    clearFilters: 'Cancella filtri',
    matchupsEmptyFiltered: 'Nessuna battaglia per questa combinazione',
  },
  de: {
    matchupVs: 'Gegen',
    clearFilters: 'Filter löschen',
    matchupsEmptyFiltered: 'Keine Kämpfe für diese Kombination',
  },
  pl: {
    matchupVs: 'Przeciw',
    clearFilters: 'Wyczyść filtry',
    matchupsEmptyFiltered: 'Brak walk dla tej kombinacji',
  },
  tr: {
    matchupVs: 'Karşı',
    clearFilters: 'Filtreleri temizle',
    matchupsEmptyFiltered: 'Bu kombinasyon için savaş yok',
  },
  ru: {
    matchupVs: 'Против',
    clearFilters: 'Сбросить фильтры',
    matchupsEmptyFiltered: 'Нет боёв для этой комбинации',
  },
  ar: {
    matchupVs: 'ضد',
    clearFilters: 'مسح الفلاتر',
    matchupsEmptyFiltered: 'لا توجد معارك لهذا المزيج',
  },
  ja: {
    matchupVs: '対',
    clearFilters: 'フィルタをクリア',
    matchupsEmptyFiltered: 'この組み合わせの試合がありません',
  },
  ko: {
    matchupVs: '상대',
    clearFilters: '필터 초기화',
    matchupsEmptyFiltered: '이 조합에 해당하는 전투가 없습니다',
  },
  zh: {
    matchupVs: '对',
    clearFilters: '清除筛选',
    matchupsEmptyFiltered: '没有此组合的战斗',
  },
}

let total = 0
for (const locale of LOCALES) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (!data.advancedAnalytics) data.advancedAnalytics = {}
  const additions = TRANSLATIONS[locale]
  for (const [key, value] of Object.entries(additions)) {
    data.advancedAnalytics[key] = value
    total++
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  console.log(`  ${locale.padEnd(3)}  +${Object.keys(additions).length} keys`)
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated`)
console.log(`  Total: +${total} key-additions`)
