#!/usr/bin/env node
/**
 * Update landing page hero copy across all 13 locales.
 *
 * 2026-04-15: user requested new copy that shifts the landing from
 * "gem power calculator" framing to "complete history + advanced
 * stats" framing. Four keys touched:
 *
 *   - landing.title      (main hero headline)
 *   - landing.subtitle   (hero paragraph)
 *   - landing.cta        ("Calcular Poder" → short "Enter"/"Access")
 *   - landing.calculating (loading state next to the CTA — had to
 *                          move off "Calculando..." because the
 *                          new CTA does not calculate anything)
 *
 * Idempotent: re-running is safe because we overwrite the same keys
 * with the same values. No new keys are added, no old keys are
 * removed.
 */

const fs = require('fs')
const path = require('path')

const MESSAGES_DIR = path.join(__dirname, '..', 'messages')

const COPY = {
  es: {
    title: 'Tu historial completo con estadísticas avanzadas',
    subtitle: 'Ingresa tu Player Tag y descubre cuáles son tus fortalezas y debilidades con la estadística más avanzada',
    cta: 'Entrar',
    calculating: 'Cargando...',
  },
  en: {
    title: 'Your complete history with advanced statistics',
    subtitle: 'Enter your Player Tag and discover your strengths and weaknesses with the most advanced statistics',
    cta: 'Enter',
    calculating: 'Loading...',
  },
  de: {
    title: 'Dein vollständiger Verlauf mit erweiterten Statistiken',
    subtitle: 'Gib dein Player Tag ein und entdecke deine Stärken und Schwächen mit der fortschrittlichsten Statistik',
    cta: 'Loslegen',
    calculating: 'Lädt...',
  },
  fr: {
    title: 'Ton historique complet avec des statistiques avancées',
    subtitle: 'Entre ton Player Tag et découvre tes forces et faiblesses avec les statistiques les plus avancées',
    cta: 'Entrer',
    calculating: 'Chargement...',
  },
  it: {
    title: 'La tua cronologia completa con statistiche avanzate',
    subtitle: 'Inserisci il tuo Player Tag e scopri i tuoi punti di forza e debolezza con le statistiche più avanzate',
    cta: 'Entra',
    calculating: 'Caricamento...',
  },
  pt: {
    title: 'Seu histórico completo com estatísticas avançadas',
    subtitle: 'Digite sua Player Tag e descubra seus pontos fortes e fracos com as estatísticas mais avançadas',
    cta: 'Entrar',
    calculating: 'Carregando...',
  },
  ja: {
    title: '詳細な統計データで見るあなたの完全な対戦履歴',
    subtitle: 'プレイヤータグを入力して、最も高度な統計データであなたの強みと弱みを発見しよう',
    cta: 'アクセス',
    calculating: '読み込み中...',
  },
  ko: {
    title: '고급 통계와 함께 보는 당신의 완전한 전투 기록',
    subtitle: '플레이어 태그를 입력하고 가장 발전된 통계로 당신의 강점과 약점을 발견하세요',
    cta: '접속',
    calculating: '불러오는 중...',
  },
  zh: {
    title: '你的完整对战历史与进阶统计数据',
    subtitle: '输入你的玩家标签，用最先进的统计数据发现你的优势与劣势',
    cta: '进入',
    calculating: '加载中...',
  },
  ar: {
    title: 'سجلك الكامل مع إحصائيات متقدمة',
    subtitle: 'أدخل Player Tag الخاص بك واكتشف نقاط قوتك وضعفك مع أكثر الإحصائيات تقدمًا',
    cta: 'دخول',
    calculating: 'جاري التحميل...',
  },
  ru: {
    title: 'Твоя полная история с продвинутой статистикой',
    subtitle: 'Введи свой Player Tag и узнай свои сильные и слабые стороны с самой продвинутой статистикой',
    cta: 'Войти',
    calculating: 'Загрузка...',
  },
  tr: {
    title: 'Gelişmiş istatistiklerle tüm geçmişin',
    subtitle: "Player Tag'ini gir ve en gelişmiş istatistiklerle güçlü ve zayıf yönlerini keşfet",
    cta: 'Giriş',
    calculating: 'Yükleniyor...',
  },
  pl: {
    title: 'Twoja pełna historia z zaawansowanymi statystykami',
    subtitle: 'Wpisz swój Player Tag i odkryj swoje mocne i słabe strony dzięki najnowocześniejszej statystyce',
    cta: 'Wejdź',
    calculating: 'Ładowanie...',
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
    cta: data.landing.cta,
    calculating: data.landing.calculating,
  }
  data.landing.title = copy.title
  data.landing.subtitle = copy.subtitle
  data.landing.cta = copy.cta
  data.landing.calculating = copy.calculating

  if (
    before.title === copy.title &&
    before.subtitle === copy.subtitle &&
    before.cta === copy.cta &&
    before.calculating === copy.calculating
  ) {
    unchangedCount++
    console.log(`  ${locale}: no change`)
    continue
  }

  // Preserve the final trailing newline if the original file had one.
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
