#!/usr/bin/env node
// Sprint D Task 2 — PlayNow vs Meta Pro clarity labels i18n batch
// Adds 4 new keys across 2 namespaces to all 13 locales.
// - advancedAnalytics.playNowSubtitle           (long, subtitle under header)
// - advancedAnalytics.playNowModeAggregateBadge (short, ~5 chars, badge)
// - advancedAnalytics.playNowModeAggregateTooltip (long, tooltip/title)
// - metaPro.topBrawlersSubtitle                 (long, subtitle under header)
//
// Hand-translated for all 13 locales. Spanish is the reference.
// Runs idempotently: overwrites existing keys with the freshest values.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: {
    advancedAnalytics: {
      playNowSubtitle: 'Basado en tu historial personal en los mapas de la rotación actual',
      playNowModeAggregateBadge: 'Modo',
      playNowModeAggregateTooltip: 'No has jugado este mapa específicamente — mostrando tus datos agregados del modo',
    },
    metaPro: {
      topBrawlersSubtitle: 'Basado en los top 200 pro players globales (meta global)',
    },
  },
  en: {
    advancedAnalytics: {
      playNowSubtitle: 'Based on your personal history across the maps in the current rotation',
      playNowModeAggregateBadge: 'Mode',
      playNowModeAggregateTooltip: "You haven't played this specific map — showing your mode-aggregate data",
    },
    metaPro: {
      topBrawlersSubtitle: 'Based on the top 200 global pro players (global meta)',
    },
  },
  fr: {
    advancedAnalytics: {
      playNowSubtitle: 'Basé sur ton historique personnel sur les cartes de la rotation actuelle',
      playNowModeAggregateBadge: 'Mode',
      playNowModeAggregateTooltip: "Tu n'as pas joué cette carte spécifiquement — affichage de tes données agrégées du mode",
    },
    metaPro: {
      topBrawlersSubtitle: 'Basé sur les top 200 pro players mondiaux (méta globale)',
    },
  },
  pt: {
    advancedAnalytics: {
      playNowSubtitle: 'Baseado no seu histórico pessoal nos mapas da rotação atual',
      playNowModeAggregateBadge: 'Modo',
      playNowModeAggregateTooltip: 'Você não jogou este mapa especificamente — mostrando seus dados agregados do modo',
    },
    metaPro: {
      topBrawlersSubtitle: 'Baseado nos top 200 pro players globais (meta global)',
    },
  },
  de: {
    advancedAnalytics: {
      playNowSubtitle: 'Basierend auf deiner persönlichen Historie auf den Karten der aktuellen Rotation',
      playNowModeAggregateBadge: 'Modus',
      playNowModeAggregateTooltip: 'Du hast diese Karte nicht gespielt — deine Modus-Aggregatdaten werden angezeigt',
    },
    metaPro: {
      topBrawlersSubtitle: 'Basierend auf den Top 200 globalen Pro-Spielern (globale Meta)',
    },
  },
  it: {
    advancedAnalytics: {
      playNowSubtitle: 'Basato sulla tua storia personale sulle mappe della rotazione attuale',
      playNowModeAggregateBadge: 'Modalità',
      playNowModeAggregateTooltip: 'Non hai giocato questa mappa nello specifico — mostro i tuoi dati aggregati della modalità',
    },
    metaPro: {
      topBrawlersSubtitle: 'Basato sui top 200 pro player globali (meta globale)',
    },
  },
  ru: {
    advancedAnalytics: {
      playNowSubtitle: 'На основе твоей личной истории на картах текущей ротации',
      playNowModeAggregateBadge: 'Режим',
      playNowModeAggregateTooltip: 'Ты не играл на этой конкретной карте — показываем твои агрегированные данные по режиму',
    },
    metaPro: {
      topBrawlersSubtitle: 'На основе топ-200 мировых про-игроков (глобальная мета)',
    },
  },
  tr: {
    advancedAnalytics: {
      playNowSubtitle: 'Mevcut rotasyondaki haritalarda kendi kişisel geçmişine dayanıyor',
      playNowModeAggregateBadge: 'Mod',
      playNowModeAggregateTooltip: 'Bu haritayı özel olarak oynamadın — mod geneli verilerini gösteriyoruz',
    },
    metaPro: {
      topBrawlersSubtitle: 'Global ilk 200 pro player verilerine dayanıyor (global meta)',
    },
  },
  pl: {
    advancedAnalytics: {
      playNowSubtitle: 'Na podstawie twojej osobistej historii na mapach w aktualnej rotacji',
      playNowModeAggregateBadge: 'Tryb',
      playNowModeAggregateTooltip: 'Nie grałeś konkretnie tej mapy — pokazuję twoje zbiorcze dane z trybu',
    },
    metaPro: {
      topBrawlersSubtitle: 'Na podstawie top 200 globalnych pro playerów (globalna meta)',
    },
  },
  ar: {
    advancedAnalytics: {
      playNowSubtitle: 'استناداً إلى سجلك الشخصي على خرائط التناوب الحالي',
      playNowModeAggregateBadge: 'الوضع',
      playNowModeAggregateTooltip: 'لم تلعب هذه الخريطة تحديداً — نعرض بياناتك المجمعة للوضع',
    },
    metaPro: {
      topBrawlersSubtitle: 'استناداً إلى أفضل 200 لاعب محترف عالمياً (الميتا العالمية)',
    },
  },
  ko: {
    advancedAnalytics: {
      playNowSubtitle: '현재 로테이션 맵에서의 내 개인 기록 기반',
      playNowModeAggregateBadge: '모드',
      playNowModeAggregateTooltip: '이 맵을 특정하여 플레이하지 않았습니다 — 모드 전체 집계 데이터를 표시합니다',
    },
    metaPro: {
      topBrawlersSubtitle: '글로벌 탑 200 프로 플레이어 기반 (글로벌 메타)',
    },
  },
  ja: {
    advancedAnalytics: {
      playNowSubtitle: '現在のローテーションマップでのあなたの個人履歴に基づいています',
      playNowModeAggregateBadge: 'モード',
      playNowModeAggregateTooltip: 'このマップは個別にプレイしていません — モード全体の集計データを表示しています',
    },
    metaPro: {
      topBrawlersSubtitle: 'グローバルトップ200プロプレイヤーに基づいています（グローバルメタ）',
    },
  },
  zh: {
    advancedAnalytics: {
      playNowSubtitle: '基于你在当前轮换地图上的个人战绩',
      playNowModeAggregateBadge: '模式',
      playNowModeAggregateTooltip: '你没有玩过这张具体地图 — 显示的是该模式的汇总数据',
    },
    metaPro: {
      topBrawlersSubtitle: '基于全球顶级 200 职业玩家（全球 meta）',
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

console.log('Sprint D Task 2 — PlayNow vs Meta Pro clarity labels i18n batch\n')
let total = 0
for (const locale of LOCALES) {
  const result = updateLocale(locale)
  console.log(`  ${locale.padEnd(3)}  +${result.added} new keys`)
  total += result.added
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated`)
console.log(`  Total: +${total} key-additions`)
