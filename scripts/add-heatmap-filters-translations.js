#!/usr/bin/env node
/**
 * Add search/filter/pagination copy for the `BrawlerMapHeatmap`
 * widget across all 13 locales under the `advancedAnalytics`
 * namespace.
 *
 * Context (2026-04-20): the heatmap renders the full (brawler × map)
 * matrix as a big grid. For players with long battle history (400+),
 * this easily renders 100+ tiles with per-tile `<img>` loads, gradient
 * backgrounds, shadows, and hover transitions — a clear jank source.
 * Adding a search box, a mode-chip filter, and a "show more"
 * paginator keeps the initial render small while preserving full
 * access to the data.
 *
 * Keys added:
 *   - heatmapSearchPlaceholder — placeholder for the search input
 *   - heatmapAllModes          — label for the "all modes" chip
 *   - heatmapShowingOf         — "Showing {shown} of {total}"
 *   - heatmapLoadMore          — CTA to reveal the next batch
 *
 * Idempotent: re-running overwrites with the same values, no new
 * keys removed.
 */

const fs = require('fs')
const path = require('path')

const MESSAGES_DIR = path.join(__dirname, '..', 'messages')

const COPY = {
  es: {
    heatmapSearchPlaceholder: 'Buscar brawler o mapa...',
    heatmapAllModes: 'Todos los modos',
    heatmapShowingOf: 'Mostrando {shown} de {total}',
    heatmapLoadMore: 'Ver más',
  },
  en: {
    heatmapSearchPlaceholder: 'Search brawler or map...',
    heatmapAllModes: 'All modes',
    heatmapShowingOf: 'Showing {shown} of {total}',
    heatmapLoadMore: 'Show more',
  },
  fr: {
    heatmapSearchPlaceholder: 'Chercher brawler ou map...',
    heatmapAllModes: 'Tous les modes',
    heatmapShowingOf: 'Affichage {shown} sur {total}',
    heatmapLoadMore: 'Voir plus',
  },
  pt: {
    heatmapSearchPlaceholder: 'Buscar brawler ou mapa...',
    heatmapAllModes: 'Todos os modos',
    heatmapShowingOf: 'Mostrando {shown} de {total}',
    heatmapLoadMore: 'Ver mais',
  },
  de: {
    heatmapSearchPlaceholder: 'Brawler oder Map suchen...',
    heatmapAllModes: 'Alle Modi',
    heatmapShowingOf: '{shown} von {total} angezeigt',
    heatmapLoadMore: 'Mehr anzeigen',
  },
  it: {
    heatmapSearchPlaceholder: 'Cerca brawler o mappa...',
    heatmapAllModes: 'Tutte le modalità',
    heatmapShowingOf: 'Mostrando {shown} di {total}',
    heatmapLoadMore: 'Mostra altro',
  },
  ru: {
    heatmapSearchPlaceholder: 'Поиск бравлера или карты...',
    heatmapAllModes: 'Все режимы',
    heatmapShowingOf: 'Показано {shown} из {total}',
    heatmapLoadMore: 'Показать еще',
  },
  tr: {
    heatmapSearchPlaceholder: 'Brawler veya harita ara...',
    heatmapAllModes: 'Tüm modlar',
    heatmapShowingOf: '{shown} / {total} gösteriliyor',
    heatmapLoadMore: 'Daha fazla göster',
  },
  pl: {
    heatmapSearchPlaceholder: 'Szukaj brawlera lub mapy...',
    heatmapAllModes: 'Wszystkie tryby',
    heatmapShowingOf: 'Wyświetlono {shown} z {total}',
    heatmapLoadMore: 'Pokaż więcej',
  },
  ar: {
    heatmapSearchPlaceholder: 'ابحث عن brawler أو خريطة...',
    heatmapAllModes: 'كل الأوضاع',
    heatmapShowingOf: 'عرض {shown} من {total}',
    heatmapLoadMore: 'عرض المزيد',
  },
  ko: {
    heatmapSearchPlaceholder: '브롤러 또는 맵 검색...',
    heatmapAllModes: '모든 모드',
    heatmapShowingOf: '{total}개 중 {shown}개 표시',
    heatmapLoadMore: '더 보기',
  },
  ja: {
    heatmapSearchPlaceholder: 'ブロウラーまたはマップを検索...',
    heatmapAllModes: 'すべてのモード',
    heatmapShowingOf: '{total}件中{shown}件表示',
    heatmapLoadMore: 'もっと見る',
  },
  zh: {
    heatmapSearchPlaceholder: '搜索 Brawler 或地图...',
    heatmapAllModes: '所有模式',
    heatmapShowingOf: '显示 {shown} / {total}',
    heatmapLoadMore: '查看更多',
  },
}

let totalChanged = 0

for (const [locale, copy] of Object.entries(COPY)) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
  if (!fs.existsSync(filePath)) {
    console.error(`[${locale}] file missing — skipping`)
    continue
  }
  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)
  if (!data.advancedAnalytics || typeof data.advancedAnalytics !== 'object') {
    console.error(`[${locale}] advancedAnalytics namespace missing — aborting`)
    process.exit(1)
  }
  let changed = 0
  for (const [key, value] of Object.entries(copy)) {
    if (data.advancedAnalytics[key] !== value) {
      data.advancedAnalytics[key] = value
      changed++
    }
  }
  if (changed > 0) {
    const trailingNewline = raw.endsWith('\n') ? '\n' : ''
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + trailingNewline, 'utf-8')
  }
  console.log(`[${locale}] ${changed} keys updated (of 4)`)
  totalChanged += changed
}

console.log(`\nTotal: ${totalChanged} keys across 13 locales.`)
