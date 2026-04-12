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

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params

  const titles: Record<string, string> = {
    es: 'BrawlVision | Analíticas de Brawl Stars, Historial de Batallas y Calculadora de Gemas',
    en: 'BrawlVision | Brawl Stars Analytics, Battle History & Gem Calculator',
    fr: 'BrawlVision | Analytiques Brawl Stars, Historique de Combats et Calculateur de Gemmes',
    pt: 'BrawlVision | Análises de Brawl Stars, Histórico de Batalhas e Calculadora de Gemas',
    de: 'BrawlVision | Brawl Stars Analysen, Kampfverlauf & Edelstein-Rechner',
  }
  const descriptions: Record<string, string> = {
    es: 'Analiza tus batallas de Brawl Stars, consulta tu historial, calcula el valor en gemas de tu cuenta y compite en el ranking global. Stats de todos los brawlers, mejores mapas y counters.',
    en: 'Analyze your Brawl Stars battles, check your battle history, calculate your gem value and compete on the global leaderboard. Stats for every brawler, best maps and counters.',
    fr: 'Analysez vos combats Brawl Stars, consultez votre historique, calculez la valeur en gemmes et participez au classement mondial.',
    pt: 'Analise suas batalhas de Brawl Stars, consulte seu histórico, calcule o valor em gemas da sua conta e compita no ranking global.',
    de: 'Analysiere deine Brawl Stars Kämpfe, prüfe deinen Kampfverlauf, berechne den Edelstein-Wert und tritt im globalen Ranking an.',
  }

  return {
    metadataBase: new URL('https://brawlvision.com'),
    title: {
      absolute: titles[locale] ?? titles.en,
      template: '%s | BrawlVision',
    },
    description: descriptions[locale] ?? descriptions.en,
    keywords: ['Brawl Stars', 'BrawlVision', 'Brawl Stars stats', 'historial de batallas', 'battle history', 'calculadora de gemas', 'gem calculator', 'mejores mapas', 'best maps', 'counters', 'win rate', 'brawler stats', 'ranking', 'leaderboard', 'Supercell'],
    authors: [{ name: 'BrawlVision Team' }],
    openGraph: {
      type: 'website',
      siteName: 'BrawlVision',
      url: `https://brawlvision.com/${locale}`,
      title: 'BrawlVision - Brawl Stars Combat Analytics',
      description: 'Analyze your battles, track win rates, and calculate your gem value.',
      locale,
      // `images` intentionally omitted: Next.js auto-injects the
      // opengraph-image.tsx file convention from src/app/ into every
      // route. Declaring images manually here overrides that auto-inject
      // and was pointing at a 404 URL (`/opengraph-image`) in production.
    },
    twitter: {
      card: 'summary_large_image',
      title: 'BrawlVision | Combat Analytics & Gem Calculator',
      description: 'Analyze your battles, track win rates, and calculate your gem value.',
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
