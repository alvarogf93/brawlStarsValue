import type { Metadata } from 'next'

const BASE_URL = 'https://brawlvision.com'
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const languages: Record<string, string> = { 'x-default': `${BASE_URL}/es/privacy` }
  for (const loc of LOCALES) {
    languages[loc] = `${BASE_URL}/${loc}/privacy`
  }

  return {
    title: 'Privacy Policy',
    description: 'BrawlVision privacy policy. Learn how we collect, use, and protect your Brawl Stars data, GDPR rights, and cookie usage.',
    // Legal pages are noindex to avoid 13 locale duplicates competing
    // with real content in Google. Still crawlable (follow: true) so
    // link equity from footer links flows correctly.
    robots: { index: false, follow: true },
    alternates: {
      canonical: `${BASE_URL}/${locale}/privacy`,
      languages,
    },
    openGraph: {
      title: 'Privacy Policy | BrawlVision',
      description: 'How BrawlVision handles your data, cookies, and GDPR rights.',
      url: `${BASE_URL}/${locale}/privacy`,
    },
  }
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children
}
