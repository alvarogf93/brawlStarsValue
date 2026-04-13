#!/usr/bin/env node
// Sprint C — meta UX remediation i18n batch
// Adds 11 new keys across 4 namespaces to all 13 locales.
// Deletes 2 obsolete metaPro keys. Runs idempotently: existing new
// keys are overwritten with the freshest translations; obsolete keys
// are removed silently if present, left alone if already absent.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: {
    metaPro: {
      sampleSize: '{count} batallas',
      modeFallbackBanner: 'Mostrando datos agregados del modo — este mapa tiene datos escasos.',
      countersLabel: 'Counters',
    },
    brawlerDetail: {
      sampleSize: '{count} batallas',
      matchupsEmptyContextual: 'No hay matchups registrados para este brawler en los últimos 90 días. Esto suele ocurrir con brawlers recién lanzados o poco jugados.',
      bestMapsEmptyContextual: 'No hay datos de mapas para este brawler todavía. Vuelve a revisar en 24-48h.',
      bestTeammatesEmptyContextual: 'No hay teammates registrados todavía.',
    },
    picks: {
      sampleSize: '{count} batallas',
      noDataContextual: 'Mapa nuevo o rotación reciente — recolectando datos.',
      modeFallbackBanner: 'Mostrando top brawlers del modo general — este mapa tiene datos escasos.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'TUS MATCHUPS — Cómo rindes TÚ contra cada oponente',
    },
  },
  en: {
    metaPro: {
      sampleSize: '{count} battles',
      modeFallbackBanner: 'Showing mode-aggregate data — this map has too few battles.',
      countersLabel: 'Counters',
    },
    brawlerDetail: {
      sampleSize: '{count} battles',
      matchupsEmptyContextual: 'No matchups recorded for this brawler in the last 90 days. This usually happens with newly-released or rarely-played brawlers.',
      bestMapsEmptyContextual: 'No map data for this brawler yet. Check back in 24-48h.',
      bestTeammatesEmptyContextual: 'No teammates recorded yet.',
    },
    picks: {
      sampleSize: '{count} battles',
      noDataContextual: 'New map or recent rotation — collecting data.',
      modeFallbackBanner: 'Showing mode-aggregate top brawlers — this map has too few battles.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'YOUR MATCHUPS — How YOU perform against each opponent',
    },
  },
  fr: {
    metaPro: {
      sampleSize: '{count} batailles',
      modeFallbackBanner: 'Affichage des données agrégées du mode — cette carte a peu de données.',
      countersLabel: 'Contre-picks',
    },
    brawlerDetail: {
      sampleSize: '{count} batailles',
      matchupsEmptyContextual: "Aucun matchup enregistré pour ce brawler au cours des 90 derniers jours. Cela arrive pour les brawlers récents ou peu joués.",
      bestMapsEmptyContextual: 'Pas encore de données de cartes pour ce brawler. Revenez dans 24-48h.',
      bestTeammatesEmptyContextual: 'Aucun coéquipier enregistré pour le moment.',
    },
    picks: {
      sampleSize: '{count} batailles',
      noDataContextual: 'Nouvelle carte ou rotation récente — collecte des données en cours.',
      modeFallbackBanner: 'Affichage des top brawlers du mode général — cette carte a peu de données.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'TES MATCHUPS — Comment TU performes contre chaque adversaire',
    },
  },
  pt: {
    metaPro: {
      sampleSize: '{count} batalhas',
      modeFallbackBanner: 'Mostrando dados agregados do modo — este mapa tem poucos dados.',
      countersLabel: 'Counters',
    },
    brawlerDetail: {
      sampleSize: '{count} batalhas',
      matchupsEmptyContextual: 'Nenhum matchup registrado para este brawler nos últimos 90 dias. Isso costuma acontecer com brawlers recém-lançados ou pouco jogados.',
      bestMapsEmptyContextual: 'Ainda não há dados de mapas para este brawler. Volte em 24-48h.',
      bestTeammatesEmptyContextual: 'Nenhum aliado registrado ainda.',
    },
    picks: {
      sampleSize: '{count} batalhas',
      noDataContextual: 'Mapa novo ou rotação recente — coletando dados.',
      modeFallbackBanner: 'Mostrando top brawlers do modo geral — este mapa tem poucos dados.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'SEUS MATCHUPS — Como VOCÊ se sai contra cada oponente',
    },
  },
  de: {
    metaPro: {
      sampleSize: '{count} Kämpfe',
      modeFallbackBanner: 'Modus-Aggregat wird angezeigt — diese Karte hat zu wenig Daten.',
      countersLabel: 'Konter',
    },
    brawlerDetail: {
      sampleSize: '{count} Kämpfe',
      matchupsEmptyContextual: 'Keine Matchups für diesen Brawler in den letzten 90 Tagen. Das passiert oft bei neuen oder selten gespielten Brawlern.',
      bestMapsEmptyContextual: 'Noch keine Kartendaten für diesen Brawler. Schau in 24-48h wieder vorbei.',
      bestTeammatesEmptyContextual: 'Noch keine Teammates erfasst.',
    },
    picks: {
      sampleSize: '{count} Kämpfe',
      noDataContextual: 'Neue Karte oder kürzliche Rotation — Daten werden gesammelt.',
      modeFallbackBanner: 'Top-Brawler aus dem allgemeinen Modus — diese Karte hat zu wenig Daten.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'DEINE MATCHUPS — Wie DU gegen jeden Gegner abschneidest',
    },
  },
  it: {
    metaPro: {
      sampleSize: '{count} battaglie',
      modeFallbackBanner: 'Mostro dati aggregati della modalità — questa mappa ha pochi dati.',
      countersLabel: 'Counter',
    },
    brawlerDetail: {
      sampleSize: '{count} battaglie',
      matchupsEmptyContextual: 'Nessun matchup registrato per questo brawler negli ultimi 90 giorni. Succede spesso con brawler appena usciti o poco giocati.',
      bestMapsEmptyContextual: 'Nessun dato di mappe per questo brawler. Ricontrolla tra 24-48h.',
      bestTeammatesEmptyContextual: 'Nessun compagno registrato ancora.',
    },
    picks: {
      sampleSize: '{count} battaglie',
      noDataContextual: 'Mappa nuova o rotazione recente — raccolta dati in corso.',
      modeFallbackBanner: 'Mostro i top brawler della modalità generale — questa mappa ha pochi dati.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'I TUOI MATCHUP — Come TU vai contro ogni avversario',
    },
  },
  ru: {
    metaPro: {
      sampleSize: '{count} боёв',
      modeFallbackBanner: 'Показаны агрегированные данные режима — на этой карте мало данных.',
      countersLabel: 'Контры',
    },
    brawlerDetail: {
      sampleSize: '{count} боёв',
      matchupsEmptyContextual: 'Нет зарегистрированных матчапов для этого бойца за последние 90 дней. Обычно это бывает с новыми или редко играемыми бойцами.',
      bestMapsEmptyContextual: 'Пока нет данных о картах для этого бойца. Вернитесь через 24-48ч.',
      bestTeammatesEmptyContextual: 'Пока нет зарегистрированных союзников.',
    },
    picks: {
      sampleSize: '{count} боёв',
      noDataContextual: 'Новая карта или недавняя ротация — собираем данные.',
      modeFallbackBanner: 'Показаны лучшие бойцы режима в целом — на этой карте мало данных.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'ТВОИ МАТЧАПЫ — Как ТЫ играешь против каждого противника',
    },
  },
  tr: {
    metaPro: {
      sampleSize: '{count} savaş',
      modeFallbackBanner: 'Mod geneli veriler gösteriliyor — bu haritada yeterli veri yok.',
      countersLabel: 'Karşı seçimler',
    },
    brawlerDetail: {
      sampleSize: '{count} savaş',
      matchupsEmptyContextual: 'Bu brawler için son 90 gün içinde kayıtlı eşleşme yok. Genellikle yeni çıkan veya az oynanan brawlerlarda olur.',
      bestMapsEmptyContextual: 'Bu brawler için henüz harita verisi yok. 24-48 saat sonra tekrar kontrol et.',
      bestTeammatesEmptyContextual: 'Henüz kayıtlı takım arkadaşı yok.',
    },
    picks: {
      sampleSize: '{count} savaş',
      noDataContextual: 'Yeni harita veya yakın zamanda gelen rotasyon — veri toplanıyor.',
      modeFallbackBanner: 'Genel mod için en iyi brawlerlar gösteriliyor — bu haritada yeterli veri yok.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'SENİN EŞLEŞMELERİN — SEN her rakibe karşı nasıl gidiyorsun',
    },
  },
  pl: {
    metaPro: {
      sampleSize: '{count} bitew',
      modeFallbackBanner: 'Pokazuję dane zbiorcze trybu — ta mapa ma zbyt mało danych.',
      countersLabel: 'Kontry',
    },
    brawlerDetail: {
      sampleSize: '{count} bitew',
      matchupsEmptyContextual: 'Brak zarejestrowanych pojedynków dla tego brawlera w ciągu ostatnich 90 dni. Zwykle dotyczy nowych lub rzadko granych brawlerów.',
      bestMapsEmptyContextual: 'Brak danych o mapach dla tego brawlera. Wróć za 24-48 godzin.',
      bestTeammatesEmptyContextual: 'Brak zarejestrowanych sojuszników.',
    },
    picks: {
      sampleSize: '{count} bitew',
      noDataContextual: 'Nowa mapa lub niedawna rotacja — zbieram dane.',
      modeFallbackBanner: 'Pokazuję najlepszych brawlerów trybu ogólnego — ta mapa ma zbyt mało danych.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'TWOJE POJEDYNKI — Jak TY radzisz sobie przeciwko każdemu',
    },
  },
  ar: {
    metaPro: {
      sampleSize: '{count} معركة',
      modeFallbackBanner: 'عرض البيانات المجمعة للوضع — هذه الخريطة لديها بيانات قليلة.',
      countersLabel: 'مضادات',
    },
    brawlerDetail: {
      sampleSize: '{count} معركة',
      matchupsEmptyContextual: 'لا توجد مواجهات مسجلة لهذا المقاتل في آخر 90 يوماً. يحدث هذا عادةً مع المقاتلين الجدد أو غير الشائعين.',
      bestMapsEmptyContextual: 'لا توجد بيانات خرائط لهذا المقاتل حتى الآن. تحقق خلال 24-48 ساعة.',
      bestTeammatesEmptyContextual: 'لا توجد شراكات مسجلة بعد.',
    },
    picks: {
      sampleSize: '{count} معركة',
      noDataContextual: 'خريطة جديدة أو تناوب حديث — جمع البيانات جارٍ.',
      modeFallbackBanner: 'عرض أفضل المقاتلين للوضع العام — هذه الخريطة لديها بيانات قليلة.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'مواجهاتك — كيف تؤدي أنت ضد كل خصم',
    },
  },
  ko: {
    metaPro: {
      sampleSize: '{count}전',
      modeFallbackBanner: '모드 전체 데이터를 표시 중 — 이 맵에는 데이터가 부족합니다.',
      countersLabel: '카운터',
    },
    brawlerDetail: {
      sampleSize: '{count}전',
      matchupsEmptyContextual: '최근 90일 동안 이 브롤러에 대한 매치업 기록이 없습니다. 신규 출시 또는 사용률이 낮은 브롤러에서 자주 발생합니다.',
      bestMapsEmptyContextual: '이 브롤러의 맵 데이터가 아직 없습니다. 24-48시간 후에 다시 확인하세요.',
      bestTeammatesEmptyContextual: '아직 등록된 팀원이 없습니다.',
    },
    picks: {
      sampleSize: '{count}전',
      noDataContextual: '새 맵이거나 최근 로테이션 — 데이터 수집 중.',
      modeFallbackBanner: '전체 모드의 탑 브롤러 표시 중 — 이 맵에는 데이터가 부족합니다.',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: '내 매치업 — 각 상대에 대해 내가 얼마나 잘 싸우는지',
    },
  },
  ja: {
    metaPro: {
      sampleSize: '{count}戦',
      modeFallbackBanner: 'モード全体のデータを表示中 — このマップはデータが不足しています。',
      countersLabel: 'カウンター',
    },
    brawlerDetail: {
      sampleSize: '{count}戦',
      matchupsEmptyContextual: 'このブロウラーの過去90日間のマッチアップ記録がありません。新規リリースや利用率の低いブロウラーでよく起こります。',
      bestMapsEmptyContextual: 'このブロウラーのマップデータはまだありません。24〜48時間後に再度確認してください。',
      bestTeammatesEmptyContextual: '味方の記録はまだありません。',
    },
    picks: {
      sampleSize: '{count}戦',
      noDataContextual: '新しいマップまたは最近のローテーション — データ収集中。',
      modeFallbackBanner: 'モード全体のトップブロウラーを表示中 — このマップはデータが不足しています。',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: 'あなたのマッチアップ — 各相手にどう戦うか',
    },
  },
  zh: {
    metaPro: {
      sampleSize: '{count}场对战',
      modeFallbackBanner: '显示模式汇总数据 — 此地图数据较少。',
      countersLabel: '克制',
    },
    brawlerDetail: {
      sampleSize: '{count}场对战',
      matchupsEmptyContextual: '过去90天没有此英雄的对战记录。通常发生在新上线或很少使用的英雄身上。',
      bestMapsEmptyContextual: '此英雄暂无地图数据。请24-48小时后再来查看。',
      bestTeammatesEmptyContextual: '暂无队友记录。',
    },
    picks: {
      sampleSize: '{count}场对战',
      noDataContextual: '新地图或近期轮换 — 正在收集数据。',
      modeFallbackBanner: '显示综合模式的顶级英雄 — 此地图数据较少。',
    },
    advancedAnalytics: {
      matchupsTitleExplicit: '你的对位 — 你对每个对手的表现',
    },
  },
}

// Keys to DELETE (obsolete after CounterQuickView removal).
const DELETIONS = [
  { namespace: 'metaPro', key: 'counterTitle' },
  { namespace: 'metaPro', key: 'counterHint' },
]

function updateLocale(locale) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)
  const additions = TRANSLATIONS[locale]

  if (!additions) {
    console.error(`✗ No translations defined for locale "${locale}"`)
    return { added: 0, deleted: 0 }
  }

  let addedCount = 0
  let deletedCount = 0

  // Merge new keys
  for (const [namespace, keys] of Object.entries(additions)) {
    if (!data[namespace]) data[namespace] = {}
    for (const [key, value] of Object.entries(keys)) {
      data[namespace][key] = value
      addedCount++
    }
  }

  // Remove obsolete keys
  for (const { namespace, key } of DELETIONS) {
    if (data[namespace] && key in data[namespace]) {
      delete data[namespace][key]
      deletedCount++
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  return { added: addedCount, deleted: deletedCount }
}

console.log('Sprint C — meta UX remediation i18n batch\n')
let total = { added: 0, deleted: 0 }
for (const locale of LOCALES) {
  const result = updateLocale(locale)
  console.log(`  ${locale.padEnd(3)}  +${result.added} new keys  -${result.deleted} deletions`)
  total.added += result.added
  total.deleted += result.deleted
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated`)
console.log(`  Total: +${total.added} key-additions, -${total.deleted} key-deletions`)
