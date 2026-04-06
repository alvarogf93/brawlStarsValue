import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import type { Metadata } from 'next'
import { CookieConsent } from '@/components/ui/CookieConsent'
import '../globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://brawlvalue.com'),
  title: {
    absolute: 'BrawlValue | Calculate your Brawl Stars Gem Score',
    template: '%s | BrawlValue'
  },
  description: 'Calculate your real Brawl Stars account value in Gems. View your statistics, brawler progression, and compete on the Global Leaderboard.',
  keywords: ['Brawl Stars', 'BrawlValue', 'Gem Calculator', 'Brawl Stars Stats', 'Leaderboard', 'Supercell', 'Profile Tracker'],
  authors: [{ name: 'BrawlValue Team' }],
  openGraph: {
    type: 'website',
    url: 'https://brawlvalue.com',
    title: 'BrawlValue - Brawl Stars Account Calculator',
    description: 'Find out exactly how many Gems your Brawl Stars account is worth right now.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BrawlValue | Gem Score Calculator',
    description: 'Find out exactly how many Gems your Brawl Stars account is worth right now.',
  },
  alternates: {
    languages: {
      es: 'https://brawlvalue.com/es',
      en: 'https://brawlvalue.com/en',
      fr: 'https://brawlvalue.com/fr',
      pt: 'https://brawlvalue.com/pt',
      de: 'https://brawlvalue.com/de',
      it: 'https://brawlvalue.com/it',
      ru: 'https://brawlvalue.com/ru',
      tr: 'https://brawlvalue.com/tr',
      pl: 'https://brawlvalue.com/pl',
      ar: 'https://brawlvalue.com/ar',
      ko: 'https://brawlvalue.com/ko',
      ja: 'https://brawlvalue.com/ja',
      zh: 'https://brawlvalue.com/zh',
    },
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
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6838192381842255"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'BrawlValue',
            url: 'https://brawlvalue.com',
            applicationCategory: 'GameApplication',
            operatingSystem: 'Web',
            description: 'Calculate the real gem value of your Brawl Stars account. View statistics, compare with friends, and track your progression.',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            author: { '@type': 'Organization', name: 'BrawlValue' },
            inLanguage: ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh'],
          })}}
        />
      </head>
      <body className="min-h-screen">
        <NextIntlClientProvider messages={messages}>
          {children}
          <CookieConsent />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
