import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import Script from 'next/script'
import type { Metadata } from 'next'
import { CookieConsent } from '@/components/ui/CookieConsent'
import { AuthProvider } from '@/components/auth/AuthProvider'
import '../globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://brawlvision.com'),
  title: {
    absolute: 'BrawlVision | Brawl Stars Combat Analytics & Gem Calculator',
    template: '%s | BrawlVision'
  },
  description: 'Brawl Stars combat analytics platform. Calculate gem value, analyze battles, track win rates, and compete on the Global Leaderboard.',
  keywords: ['Brawl Stars', 'BrawlVision', 'Battle Analytics', 'Gem Calculator', 'Brawl Stars Stats', 'Leaderboard', 'Supercell', 'Profile Tracker'],
  authors: [{ name: 'BrawlVision Team' }],
  openGraph: {
    type: 'website',
    url: 'https://brawlvision.com',
    title: 'BrawlVision - Brawl Stars Combat Analytics',
    description: 'Analyze your battles, track win rates, and calculate your gem value.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BrawlVision | Combat Analytics & Gem Calculator',
    description: 'Analyze your battles, track win rates, and calculate your gem value.',
  },
  alternates: {
    languages: {
      es: 'https://brawlvision.com/es',
      en: 'https://brawlvision.com/en',
      fr: 'https://brawlvision.com/fr',
      pt: 'https://brawlvision.com/pt',
      de: 'https://brawlvision.com/de',
      it: 'https://brawlvision.com/it',
      ru: 'https://brawlvision.com/ru',
      tr: 'https://brawlvision.com/tr',
      pl: 'https://brawlvision.com/pl',
      ar: 'https://brawlvision.com/ar',
      ko: 'https://brawlvision.com/ko',
      ja: 'https://brawlvision.com/ja',
      zh: 'https://brawlvision.com/zh',
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
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'BrawlVision',
            url: 'https://brawlvision.com',
            applicationCategory: 'GameApplication',
            operatingSystem: 'Web',
            description: 'Brawl Stars combat analytics platform. Calculate gem value, analyze battles, and track progression.',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            author: { '@type': 'Organization', name: 'BrawlVision' },
            inLanguage: ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh'],
          })}}
        />
      </head>
      <body className="min-h-screen">
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6838192381842255"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            {children}
            <CookieConsent />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
