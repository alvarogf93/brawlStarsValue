import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import type { Metadata } from 'next'
import { CookieConsent } from '@/components/ui/CookieConsent'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { TagRequiredModal } from '@/components/auth/TagRequiredModal'
import { ReferralToast } from '@/components/premium/ReferralToast'
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

  return {
    metadataBase: new URL('https://brawlvision.com'),
    title: {
      absolute: 'BrawlVision | Brawl Stars Combat Analytics & Gem Calculator',
      template: '%s | BrawlVision',
    },
    description: 'Brawl Stars combat analytics platform. Calculate gem value, analyze battles, track win rates, and compete on the Global Leaderboard.',
    keywords: ['Brawl Stars', 'BrawlVision', 'Battle Analytics', 'Gem Calculator', 'Brawl Stars Stats', 'Leaderboard', 'Supercell', 'Profile Tracker'],
    authors: [{ name: 'BrawlVision Team' }],
    openGraph: {
      type: 'website',
      siteName: 'BrawlVision',
      url: `https://brawlvision.com/${locale}`,
      title: 'BrawlVision - Brawl Stars Combat Analytics',
      description: 'Analyze your battles, track win rates, and calculate your gem value.',
      locale,
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'BrawlVision' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'BrawlVision | Combat Analytics & Gem Calculator',
      description: 'Analyze your battles, track win rates, and calculate your gem value.',
      images: ['/opengraph-image'],
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
            {children}
            <TagRequiredModal />
            <ReferralToast />
            <CookieConsent />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
