#!/usr/bin/env node
/**
 * P1 2026-04-24: replace landing hero copy across all 13 locales with
 * the "historial ilimitado" angle — the actual differentiator vs
 * Brawlify/BrawlTime (they only show what the API returns, 25 battles
 * rolling; BrawlVision persists everything to Supabase). SC data from
 * 2026-04-07..22 showed the home ranking for brand typos but zero
 * impressions on "historial batallas" money queries because the copy
 * doesn't contain the keyword the Google AI identified as the market
 * gap (*"there isn't truly an unlimited battle history feature"*).
 *
 * Idempotent: overwrites the same keys with the same values every run.
 */

const fs = require('fs')
const path = require('path')

const MESSAGES_DIR = path.join(__dirname, '..', 'messages')

const COPY = {
  es: {
    title: 'Tu historial ilimitado de Brawl Stars',
    subtitle:
      'Brawl Stars borra tus batallas tras las 25 más recientes. BrawlVision las guarda todas desde que vinculas tu cuenta — con analíticas avanzadas, counters y meta pro.',
  },
  en: {
    title: 'Your Unlimited Brawl Stars Battle History',
    subtitle:
      "Brawl Stars deletes your battles past the last 25. BrawlVision saves every single one from the moment you link your account — with advanced analytics, counters and pro meta.",
  },
  fr: {
    title: 'Ton historique illimité de Brawl Stars',
    subtitle:
      "Brawl Stars efface tes parties au-delà des 25 dernières. BrawlVision les conserve toutes dès que tu lies ton compte — avec analyses avancées, counters et meta pro.",
  },
  pt: {
    title: 'Seu histórico ilimitado de Brawl Stars',
    subtitle:
      'O Brawl Stars apaga suas batalhas além das 25 mais recentes. O BrawlVision salva todas a partir do momento em que você vincula sua conta — com análises avançadas, counters e meta pro.',
  },
  de: {
    title: 'Dein unbegrenzter Brawl Stars Kampfverlauf',
    subtitle:
      'Brawl Stars löscht deine Kämpfe nach den letzten 25. BrawlVision speichert jeden einzelnen ab dem Moment, in dem du dein Konto verknüpfst — mit erweiterter Analyse, Countern und Pro-Meta.',
  },
  it: {
    title: 'La tua cronologia illimitata di Brawl Stars',
    subtitle:
      'Brawl Stars cancella le tue battaglie oltre le ultime 25. BrawlVision le salva tutte dal momento in cui colleghi il tuo account — con analisi avanzate, counter e meta pro.',
  },
  ja: {
    title: 'Brawl Stars の無制限バトル履歴',
    subtitle:
      'Brawl Stars は直近25戦を超えた履歴を削除します。BrawlVision はアカウント連携の瞬間からすべてのバトルを保存します — 高度な分析、カウンター、プロメタ付き。',
  },
  ko: {
    title: '무제한 Brawl Stars 전투 기록',
    subtitle:
      'Brawl Stars는 최근 25경기 이전의 전투를 삭제합니다. BrawlVision은 계정을 연동한 순간부터 모든 전투를 저장합니다 — 고급 분석, 카운터, 프로 메타 포함.',
  },
  zh: {
    title: 'Brawl Stars 无限战斗历史记录',
    subtitle:
      'Brawl Stars 会删除最近 25 场之前的战斗记录。BrawlVision 从你绑定账号那一刻起保存每一场 — 高级分析、克制关系和职业 meta 一应俱全。',
  },
  ar: {
    title: 'سجل معاركك غير المحدود في Brawl Stars',
    subtitle:
      'يحذف Brawl Stars معاركك بعد آخر 25 معركة. يحفظها BrawlVision كلها من لحظة ربط حسابك — مع تحليلات متقدمة، كاونترز وميتا احترافية.',
  },
  ru: {
    title: 'Безлимитная история боёв Brawl Stars',
    subtitle:
      'Brawl Stars удаляет бои дальше последних 25. BrawlVision сохраняет каждый бой с момента привязки аккаунта — продвинутая аналитика, контры и про-мета.',
  },
  tr: {
    title: 'Sınırsız Brawl Stars Savaş Geçmişin',
    subtitle:
      "Brawl Stars son 25 savaşının öncesini siler. BrawlVision, hesabını bağladığın andan itibaren hepsini saklar — gelişmiş analizler, counter ve pro meta.",
  },
  pl: {
    title: 'Twoja nielimitowana historia walk Brawl Stars',
    subtitle:
      'Brawl Stars usuwa walki spoza 25 ostatnich. BrawlVision zapisuje każdą walkę od momentu powiązania konta — zaawansowane analizy, countery i pro meta.',
  },
}

let updatedCount = 0
let unchangedCount = 0
const missingFiles = []

for (const [locale, copy] of Object.entries(COPY)) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
  if (!fs.existsSync(filePath)) {
    missingFiles.push(locale)
    continue
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)

  if (!data.landing) {
    console.error(`${locale}.json: missing "landing" key — aborting to avoid corruption`)
    process.exit(1)
  }

  const before = {
    title: data.landing.title,
    subtitle: data.landing.subtitle,
  }
  data.landing.title = copy.title
  data.landing.subtitle = copy.subtitle

  if (before.title === copy.title && before.subtitle === copy.subtitle) {
    unchangedCount++
    console.log(`  ${locale}: no change`)
    continue
  }

  const hadTrailingNewline = raw.endsWith('\n')
  const serialized = JSON.stringify(data, null, 2) + (hadTrailingNewline ? '\n' : '')
  fs.writeFileSync(filePath, serialized, 'utf-8')
  updatedCount++
  console.log(`  ${locale}: updated`)
}

console.log('')
console.log(`Updated:   ${updatedCount}`)
console.log(`Unchanged: ${unchangedCount}`)
if (missingFiles.length > 0) {
  console.log(`Missing files: ${missingFiles.join(', ')}`)
  process.exit(1)
}
