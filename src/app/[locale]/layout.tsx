import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import type { Metadata } from 'next'
import { CookieConsent } from '@/components/ui/CookieConsent'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { TagRequiredModal } from '@/components/auth/TagRequiredModal'
import { ReferralToast } from '@/components/premium/ReferralToast'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AdSenseScript } from '@/components/ads/AdSenseScript'
import '../globals.css'

const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh'] as const
type SupportedLocale = typeof LOCALES[number]

/** Per-locale title + description. Single source of truth — fed into
 *  `title`, `description`, `openGraph` and `twitter` metadata. Previously
 *  only 5 locales were populated here and the remaining 8 silently fell
 *  back to English, which hurt CTR on non-Spanish SERPs (Russia at 76
 *  impressions / 2.6% CTR was the most visible offender). OG and Twitter
 *  copy was ALSO hardcoded in English across all locales — fixed to use
 *  this map too, so a user sharing `/ru` now gets a Russian social card. */
const LOCALE_COPY: Record<SupportedLocale, { title: string; description: string }> = {
  es: {
    title: 'BrawlVision | Analíticas de Brawl Stars, Historial de Batallas y Calculadora de Gemas',
    description:
      'Analiza tus batallas de Brawl Stars, consulta tu historial, calcula el valor en gemas de tu cuenta y compite en el ranking global. Stats de todos los brawlers, mejores mapas y counters.',
  },
  en: {
    title: 'BrawlVision | Brawl Stars Analytics, Battle History & Gem Calculator',
    description:
      'Analyze your Brawl Stars battles, check your battle history, calculate your gem value and compete on the global leaderboard. Stats for every brawler, best maps and counters.',
  },
  fr: {
    title: 'BrawlVision | Analytiques Brawl Stars, Historique de Combats et Calculateur de Gemmes',
    description:
      'Analysez vos combats Brawl Stars, consultez votre historique, calculez la valeur en gemmes et participez au classement mondial. Stats de tous les brawlers, meilleures cartes et counters.',
  },
  pt: {
    title: 'BrawlVision | Análises de Brawl Stars, Histórico de Batalhas e Calculadora de Gemas',
    description:
      'Analise suas batalhas de Brawl Stars, consulte seu histórico, calcule o valor em gemas da sua conta e compita no ranking global. Estatísticas de todos os brawlers, melhores mapas e counters.',
  },
  de: {
    title: 'BrawlVision | Brawl Stars Analysen, Kampfverlauf & Edelstein-Rechner',
    description:
      'Analysiere deine Brawl Stars Kämpfe, prüfe deinen Kampfverlauf, berechne den Edelstein-Wert und tritt im globalen Ranking an. Statistiken aller Brawler, beste Maps und Counter.',
  },
  it: {
    title: 'BrawlVision | Analisi di Brawl Stars, Cronologia Battaglie e Calcolatore di Gemme',
    description:
      'Analizza le tue battaglie di Brawl Stars, consulta la cronologia, calcola il valore in gemme del tuo account e competi nella classifica globale. Statistiche di tutti i brawler, migliori mappe e counter.',
  },
  ru: {
    title: 'BrawlVision | Аналитика Brawl Stars, история боёв и калькулятор гемов',
    description:
      'Анализируй свои бои в Brawl Stars, смотри историю, считай ценность аккаунта в гемах и соревнуйся в глобальном рейтинге. Статистика всех бойцов, лучшие карты и контры.',
  },
  tr: {
    title: 'BrawlVision | Brawl Stars Analiz, Savaş Geçmişi ve Elmas Hesaplayıcı',
    description:
      'Brawl Stars savaşlarını analiz et, geçmişini incele, elmas değerini hesapla ve küresel sıralamada yarış. Tüm brawlerların istatistikleri, en iyi haritalar ve counter bilgisi.',
  },
  pl: {
    title: 'BrawlVision | Analityka Brawl Stars, Historia Walk i Kalkulator Gemów',
    description:
      'Analizuj swoje walki w Brawl Stars, sprawdź historię, oblicz wartość konta w gemach i rywalizuj w globalnym rankingu. Statystyki wszystkich brawlerów, najlepsze mapy i countery.',
  },
  ar: {
    title: 'BrawlVision | تحليلات Brawl Stars، سجل المعارك وحاسبة الجواهر',
    description:
      'حلّل معاركك في Brawl Stars، استعرض سجلك، احسب قيمة حسابك بالجواهر وتنافس في التصنيف العالمي. إحصائيات جميع الأبطال، أفضل الخرائط والكاونترز.',
  },
  ko: {
    title: 'BrawlVision | Brawl Stars 분석, 전투 기록 및 젬 계산기',
    description:
      'Brawl Stars 전투를 분석하고, 전투 기록을 확인하며, 계정의 젬 가치를 계산하고 글로벌 랭킹에서 경쟁하세요. 모든 브롤러의 통계, 최적의 맵과 카운터 정보.',
  },
  ja: {
    title: 'BrawlVision | Brawl Stars 分析・バトル履歴・ジェム電卓',
    description:
      'Brawl Stars のバトルを分析し、履歴を確認し、アカウントのジェム価値を計算し、グローバルランキングで競争しよう。全ブロウラーの統計、ベストマップ、カウンター情報。',
  },
  zh: {
    title: 'BrawlVision | Brawl Stars 数据分析、战斗历史与宝石计算器',
    description:
      '分析你的 Brawl Stars 战斗，查看战斗历史，计算账户的宝石价值并在全球排行榜中竞争。所有角色的数据、最佳地图和克制关系。',
  },
}

function buildLanguageAlternates(locale: string) {
  const languages: Record<string, string> = {
    'x-default': 'https://brawlvision.com/es',
  }
  for (const l of LOCALES) {
    languages[l] = `https://brawlvision.com/${l}`
  }
  return {
    canonical: `https://brawlvision.com/${locale}`,
    languages,
  }
}

function resolveCopy(locale: string): { title: string; description: string } {
  return (LOCALE_COPY as Record<string, { title: string; description: string }>)[locale] ?? LOCALE_COPY.en
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const copy = resolveCopy(locale)

  return {
    metadataBase: new URL('https://brawlvision.com'),
    title: {
      absolute: copy.title,
      template: '%s | BrawlVision',
    },
    description: copy.description,
    keywords: ['Brawl Stars', 'BrawlVision', 'Brawl Stars stats', 'historial de batallas', 'battle history', 'calculadora de gemas', 'gem calculator', 'mejores mapas', 'best maps', 'counters', 'win rate', 'brawler stats', 'ranking', 'leaderboard', 'Supercell'],
    authors: [{ name: 'BrawlVision Team' }],
    openGraph: {
      type: 'website',
      siteName: 'BrawlVision',
      url: `https://brawlvision.com/${locale}`,
      title: copy.title,
      description: copy.description,
      locale,
      // `images` intentionally omitted: Next.js auto-injects the
      // opengraph-image.tsx file convention from src/app/ into every
      // route. Declaring images manually here overrides that auto-inject
      // and was pointing at a 404 URL (`/opengraph-image`) in production.
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.title,
      description: copy.description,
      // Same as openGraph.images — let the file convention inject.
    },
    verification: {
      google: '5uwFXu6M3E0O0IOawv8nl-Ae-OKw72tBOblsWHrXQ2Y',
    },
    alternates: buildLanguageAlternates(locale),
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1C5CF1" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'BrawlVision',
              url: 'https://brawlvision.com',
              applicationCategory: 'GameApplication',
              operatingSystem: 'Web',
              description: 'Brawl Stars combat analytics platform. Calculate gem value, analyze battles, track win rates, and get personalized recommendations.',
              offers: [
                { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free tier with ads' },
                { '@type': 'Offer', price: '2.99', priceCurrency: 'USD', description: 'Premium: analytics, battle history, no ads' },
              ],
              author: { '@type': 'Organization', name: 'BrawlVision', url: 'https://brawlvision.com' },
              inLanguage: ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh'],
              screenshot: 'https://brawlvision.com/opengraph-image',
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: `https://brawlvision.com/${locale}` },
              ],
            },
          ])}}
        />
      </head>
      <body className="min-h-screen">
        <AdSenseScript />
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <TooltipProvider delayDuration={300}>
              {children}
              <TagRequiredModal />
              <ReferralToast />
              <CookieConsent />
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
