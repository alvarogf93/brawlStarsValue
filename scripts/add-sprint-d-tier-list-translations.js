#!/usr/bin/env node
// Sprint D Task 3 — BrawlerTierList redesign i18n batch
// Adds 7 new keys to the advancedAnalytics namespace × 13 locales.
// Runs idempotently: existing keys are overwritten with the freshest
// translations.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: {
    advancedAnalytics: {
      brawlers: 'brawlers',
      tierListSubtitle: 'Tus brawlers agrupados por tier según tu win rate personal',
      tierListSelectHint: 'Selecciona un brawler para ver detalles',
      tierListDetailGames: '{total} partidas ({wins}W / {losses}L)',
      tierListDetailStarRate: 'Star player: {rate}%',
      tierListDetailTrophyChange: 'Trofeos: {delta} promedio',
      tierListEmptyTier: '—',
    },
  },
  en: {
    advancedAnalytics: {
      brawlers: 'brawlers',
      tierListSubtitle: 'Your brawlers grouped by tier based on your personal win rate',
      tierListSelectHint: 'Select a brawler to see details',
      tierListDetailGames: '{total} games ({wins}W / {losses}L)',
      tierListDetailStarRate: 'Star player: {rate}%',
      tierListDetailTrophyChange: 'Trophies: {delta} avg',
      tierListEmptyTier: '—',
    },
  },
  fr: {
    advancedAnalytics: {
      brawlers: 'brawlers',
      tierListSubtitle: 'Tes brawlers regroupés par tier selon ton taux de victoire personnel',
      tierListSelectHint: 'Sélectionne un brawler pour voir les détails',
      tierListDetailGames: '{total} parties ({wins}V / {losses}D)',
      tierListDetailStarRate: 'Star player : {rate}%',
      tierListDetailTrophyChange: 'Trophées : {delta} en moyenne',
      tierListEmptyTier: '—',
    },
  },
  pt: {
    advancedAnalytics: {
      brawlers: 'brawlers',
      tierListSubtitle: 'Seus brawlers agrupados por tier com base na sua taxa de vitória pessoal',
      tierListSelectHint: 'Selecione um brawler para ver detalhes',
      tierListDetailGames: '{total} partidas ({wins}V / {losses}D)',
      tierListDetailStarRate: 'Star player: {rate}%',
      tierListDetailTrophyChange: 'Troféus: {delta} em média',
      tierListEmptyTier: '—',
    },
  },
  de: {
    advancedAnalytics: {
      brawlers: 'Brawler',
      tierListSubtitle: 'Deine Brawler nach Tier gruppiert auf Basis deiner persönlichen Siegrate',
      tierListSelectHint: 'Wähle einen Brawler, um Details zu sehen',
      tierListDetailGames: '{total} Spiele ({wins}S / {losses}N)',
      tierListDetailStarRate: 'Star-Spieler: {rate}%',
      tierListDetailTrophyChange: 'Trophäen: {delta} Durchschnitt',
      tierListEmptyTier: '—',
    },
  },
  it: {
    advancedAnalytics: {
      brawlers: 'brawler',
      tierListSubtitle: 'I tuoi brawler raggruppati per tier in base alla tua percentuale di vittorie personale',
      tierListSelectHint: 'Seleziona un brawler per vedere i dettagli',
      tierListDetailGames: '{total} partite ({wins}V / {losses}S)',
      tierListDetailStarRate: 'Star player: {rate}%',
      tierListDetailTrophyChange: 'Trofei: {delta} medi',
      tierListEmptyTier: '—',
    },
  },
  ru: {
    advancedAnalytics: {
      brawlers: 'бойцов',
      tierListSubtitle: 'Твои бойцы, сгруппированные по тирам на основе твоего личного винрейта',
      tierListSelectHint: 'Выбери бойца, чтобы увидеть детали',
      tierListDetailGames: '{total} боёв ({wins}П / {losses}П)',
      tierListDetailStarRate: 'Звезда матча: {rate}%',
      tierListDetailTrophyChange: 'Трофеи: {delta} в среднем',
      tierListEmptyTier: '—',
    },
  },
  tr: {
    advancedAnalytics: {
      brawlers: 'brawler',
      tierListSubtitle: 'Kişisel kazanma oranına göre tier bazında gruplandırılmış brawlerların',
      tierListSelectHint: 'Detayları görmek için bir brawler seç',
      tierListDetailGames: '{total} maç ({wins}G / {losses}M)',
      tierListDetailStarRate: 'Maçın yıldızı: {rate}%',
      tierListDetailTrophyChange: 'Kupa: ortalama {delta}',
      tierListEmptyTier: '—',
    },
  },
  pl: {
    advancedAnalytics: {
      brawlers: 'brawlerów',
      tierListSubtitle: 'Twoi brawlerzy pogrupowani według tieru na podstawie twojego osobistego współczynnika zwycięstw',
      tierListSelectHint: 'Wybierz brawlera, aby zobaczyć szczegóły',
      tierListDetailGames: '{total} gier ({wins}W / {losses}P)',
      tierListDetailStarRate: 'Gwiazda meczu: {rate}%',
      tierListDetailTrophyChange: 'Trofea: średnio {delta}',
      tierListEmptyTier: '—',
    },
  },
  ar: {
    advancedAnalytics: {
      brawlers: 'مقاتلين',
      tierListSubtitle: 'مقاتلوك مجمعون حسب الفئة بناءً على معدل فوزك الشخصي',
      tierListSelectHint: 'اختر مقاتلاً لرؤية التفاصيل',
      tierListDetailGames: '{total} مباراة ({wins} فوز / {losses} خسارة)',
      tierListDetailStarRate: 'نجم المباراة: {rate}%',
      tierListDetailTrophyChange: 'الكؤوس: {delta} في المتوسط',
      tierListEmptyTier: '—',
    },
  },
  ko: {
    advancedAnalytics: {
      brawlers: '브롤러',
      tierListSubtitle: '개인 승률에 따라 티어별로 그룹화된 브롤러',
      tierListSelectHint: '브롤러를 선택하여 상세 정보 보기',
      tierListDetailGames: '{total}전 ({wins}승 / {losses}패)',
      tierListDetailStarRate: '스타 플레이어: {rate}%',
      tierListDetailTrophyChange: '트로피: 평균 {delta}',
      tierListEmptyTier: '—',
    },
  },
  ja: {
    advancedAnalytics: {
      brawlers: 'ブロウラー',
      tierListSubtitle: '個人勝率に基づきティアごとにグループ化されたブロウラー',
      tierListSelectHint: 'ブロウラーを選択して詳細を表示',
      tierListDetailGames: '{total}戦 ({wins}勝 / {losses}敗)',
      tierListDetailStarRate: 'スタープレイヤー: {rate}%',
      tierListDetailTrophyChange: 'トロフィー: 平均 {delta}',
      tierListEmptyTier: '—',
    },
  },
  zh: {
    advancedAnalytics: {
      brawlers: '英雄',
      tierListSubtitle: '根据你的个人胜率按等级分组的英雄',
      tierListSelectHint: '选择一个英雄查看详情',
      tierListDetailGames: '{total}场 ({wins}胜 / {losses}负)',
      tierListDetailStarRate: 'MVP: {rate}%',
      tierListDetailTrophyChange: '奖杯: 平均 {delta}',
      tierListEmptyTier: '—',
    },
  },
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

  let addedCount = 0

  for (const [namespace, keys] of Object.entries(additions)) {
    if (!data[namespace]) data[namespace] = {}
    for (const [key, value] of Object.entries(keys)) {
      data[namespace][key] = value
      addedCount++
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  return { added: addedCount }
}

console.log('Sprint D Task 3 — BrawlerTierList redesign i18n batch\n')
let total = { added: 0 }
for (const locale of LOCALES) {
  const result = updateLocale(locale)
  console.log(`  ${locale.padEnd(3)}  +${result.added} keys`)
  total.added += result.added
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated`)
console.log(`  Total: +${total.added} key-additions`)
