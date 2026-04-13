#!/usr/bin/env node
// Sprint D — Meta PRO teammates inline UX i18n batch
// Adds 3 new keys under the metaPro namespace to all 13 locales:
// - metaPro.teammatesLabel    (short UPPERCASE label, ~11 chars)
// - metaPro.teammatesSeeMore  (button label, param: { count } = remaining trios, e.g. "Ver más (2)")
// - metaPro.teammatesSeeLess  (button label, static)
// Also removes the obsolete metaPro.proTriosTitle key (the standalone
// ProTrioGrid section was removed — only the TeamSynergyView cross-reference
// data remains, which does not render a title).

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: {
    metaPro: {
      teammatesLabel: 'COMPAÑEROS',
      teammatesSeeMore: 'Ver más ({count})',
      teammatesSeeLess: 'Ver menos',
    },
  },
  en: {
    metaPro: {
      teammatesLabel: 'TEAMMATES',
      teammatesSeeMore: 'See more ({count})',
      teammatesSeeLess: 'See less',
    },
  },
  fr: {
    metaPro: {
      teammatesLabel: 'COÉQUIPIERS',
      teammatesSeeMore: 'Voir plus ({count})',
      teammatesSeeLess: 'Voir moins',
    },
  },
  pt: {
    metaPro: {
      teammatesLabel: 'COMPANHEIROS',
      teammatesSeeMore: 'Ver mais ({count})',
      teammatesSeeLess: 'Ver menos',
    },
  },
  it: {
    metaPro: {
      teammatesLabel: 'COMPAGNI',
      teammatesSeeMore: 'Vedi altri ({count})',
      teammatesSeeLess: 'Vedi meno',
    },
  },
  de: {
    metaPro: {
      teammatesLabel: 'TEAMKOLLEGEN',
      teammatesSeeMore: 'Mehr anzeigen ({count})',
      teammatesSeeLess: 'Weniger anzeigen',
    },
  },
  pl: {
    metaPro: {
      teammatesLabel: 'SOJUSZNICY',
      teammatesSeeMore: 'Pokaż więcej ({count})',
      teammatesSeeLess: 'Pokaż mniej',
    },
  },
  tr: {
    metaPro: {
      teammatesLabel: 'TAKIM ARKADAŞLARI',
      teammatesSeeMore: 'Daha fazla ({count})',
      teammatesSeeLess: 'Daha az göster',
    },
  },
  ru: {
    metaPro: {
      teammatesLabel: 'СОЮЗНИКИ',
      teammatesSeeMore: 'Показать ещё ({count})',
      teammatesSeeLess: 'Скрыть',
    },
  },
  ar: {
    metaPro: {
      teammatesLabel: 'الحلفاء',
      teammatesSeeMore: 'عرض المزيد ({count})',
      teammatesSeeLess: 'عرض أقل',
    },
  },
  ja: {
    metaPro: {
      teammatesLabel: 'チームメイト',
      teammatesSeeMore: 'もっと見る ({count})',
      teammatesSeeLess: '閉じる',
    },
  },
  ko: {
    metaPro: {
      teammatesLabel: '팀원',
      teammatesSeeMore: '더 보기 ({count})',
      teammatesSeeLess: '접기',
    },
  },
  zh: {
    metaPro: {
      teammatesLabel: '队友',
      teammatesSeeMore: '查看更多 ({count})',
      teammatesSeeLess: '收起',
    },
  },
}

// The standalone ProTrioGrid section was removed — its title key is obsolete.
const KEYS_TO_DELETE = {
  metaPro: ['proTriosTitle'],
}

function updateLocale(locale) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)
  const additions = TRANSLATIONS[locale]

  if (!additions) {
    console.error(`✗ No translations defined for locale "${locale}"`)
    return { added: 0, removed: 0 }
  }

  let addedCount = 0
  for (const [namespace, keys] of Object.entries(additions)) {
    if (!data[namespace]) data[namespace] = {}
    for (const [key, value] of Object.entries(keys)) {
      data[namespace][key] = value
      addedCount++
    }
  }

  let removedCount = 0
  for (const [namespace, keys] of Object.entries(KEYS_TO_DELETE)) {
    if (!data[namespace]) continue
    for (const key of keys) {
      if (key in data[namespace]) {
        delete data[namespace][key]
        removedCount++
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  return { added: addedCount, removed: removedCount }
}

console.log('Sprint D — Meta PRO teammates inline UX i18n batch\n')
let totalAdded = 0
let totalRemoved = 0
for (const locale of LOCALES) {
  const result = updateLocale(locale)
  console.log(`  ${locale.padEnd(3)}  +${result.added} new  -${result.removed} obsolete`)
  totalAdded += result.added
  totalRemoved += result.removed
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated`)
console.log(`  Total: +${totalAdded} additions, -${totalRemoved} deletions`)
