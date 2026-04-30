import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SafeAdSlot } from '@/components/ui/SafeAdSlot'
import { Home, Check, Infinity as InfinityIcon, TrendingUp, BarChart3, RefreshCw } from 'lucide-react'

export const revalidate = 86400 // ISR: 1 day — static marketing content

const BASE_URL = 'https://brawlvision.com'
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'battleHistory' })
  const languages: Record<string, string> = { 'x-default': `${BASE_URL}/es/battle-history` }
  for (const loc of LOCALES) {
    languages[loc] = `${BASE_URL}/${loc}/battle-history`
  }
  return {
    // `absolute` disables the parent layout's `%s | BrawlVision`
    // template — metaTitle already contains the brand suffix, we
    // don't want it appended twice.
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    alternates: {
      canonical: `${BASE_URL}/${locale}/battle-history`,
      languages,
    },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      url: `${BASE_URL}/${locale}/battle-history`,
    },
  }
}

interface Benefit {
  title: string
  body: string
}

interface FaqEntry {
  q: string
  a: string
}

export default async function BattleHistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'battleHistory' })

  const benefits = t.raw('benefits') as Benefit[]
  const steps = t.raw('steps') as string[]
  const faq = t.raw('faq') as FaqEntry[]

  // Icons are matched positionally to the benefits array — kept in
  // code (not i18n) so designers can reorder without touching strings.
  const benefitIcons = [InfinityIcon, BarChart3, TrendingUp, RefreshCw]

  // Structured data: HowTo for the 3-step flow + FAQPage for the
  // Q&A block. Both give Google rich-result eligibility on the
  // page. Kept in-body (not in a layout) so they ship with the
  // statically prerendered HTML.
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: t('metaTitle'),
      description: t('metaDescription'),
      inLanguage: locale,
      step: steps.map((text, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: text,
        text,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((entry) => ({
        '@type': 'Question',
        name: entry.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: entry.a,
        },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'BrawlVision', item: `${BASE_URL}/${locale}` },
        { '@type': 'ListItem', position: 2, name: t('breadcrumbLabel'), item: `${BASE_URL}/${locale}/battle-history` },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-[#0F172A]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Public header */}
      <header className="bg-[#0F172A] border-b-4 border-[#030712] px-6 py-3 flex items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center gap-3">
          <img src="/assets/brand/logo-full.png" alt="BrawlVision" width={200} height={96} className="h-auto w-[100px]" />
        </Link>
        <Link
          href={`/${locale}`}
          className="p-2 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/5"
          aria-label={t('homeAriaLabel')}
        >
          <Home className="w-5 h-5" />
        </Link>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-8 pb-16 space-y-10">
        {/* Hero */}
        <section className="brawl-card p-6 md:p-10 text-center">
          <h1 className="text-3xl md:text-5xl font-['Lilita_One'] text-white text-stroke-brawl leading-[1.1] mb-4">
            {t('heroTitle')}
          </h1>
          <p className="text-sm md:text-base text-[var(--color-brawl-dark)] font-['Inter'] font-semibold max-w-2xl mx-auto leading-relaxed">
            {t('heroLead')}
          </p>
          <div className="mt-6">
            <Link
              href={`/${locale}`}
              className="brawl-button inline-flex items-center gap-2 px-6 py-3 text-base"
            >
              {t('ctaPrimary')}
            </Link>
          </div>
        </section>

        {/* Benefits grid */}
        <section>
          <h2 className="text-2xl md:text-3xl font-['Lilita_One'] text-white text-stroke-brawl text-center mb-6">
            {t('benefitsTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {benefits.map((b, i) => {
              const Icon = benefitIcons[i] ?? Check
              return (
                <div key={i} className="brawl-card-dark p-5 border-[#090E17]">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-[#FFC91B]/15 border border-[#FFC91B]/30 inline-flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#FFC91B]" />
                    </span>
                    <h3 className="font-['Lilita_One'] text-lg text-white">
                      {b.title}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {b.body}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* How it works */}
        <section>
          <h2 className="text-2xl md:text-3xl font-['Lilita_One'] text-white text-stroke-brawl text-center mb-6">
            {t('howTitle')}
          </h2>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="brawl-card-dark p-4 border-[#090E17] flex items-start gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-[#FFC91B] text-[#121A2F] font-['Lilita_One'] text-lg inline-flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm md:text-base text-slate-200 leading-relaxed pt-1">
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Analytical sections — give the page enough editorial
            depth (≥600 words) to clear AdSense's content threshold
            before the slot. Each block addresses a real player
            question (signal vs noise, tilt detection, meta gap)
            with examples grounded in our own data. */}
        <section>
          <h2 className="text-2xl md:text-3xl font-['Lilita_One'] text-white text-stroke-brawl text-center mb-6">
            {t('analysisTitle')}
          </h2>
          <div className="brawl-card-dark p-6 md:p-8 border-[#090E17] space-y-4">
            <p className="text-sm md:text-base text-slate-300 leading-relaxed font-['Inter']">
              {t('analysisParagraph1')}
            </p>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed font-['Inter']">
              {t('analysisParagraph2')}
            </p>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed font-['Inter']">
              {t('analysisParagraph3')}
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl md:text-3xl font-['Lilita_One'] text-white text-stroke-brawl text-center mb-6">
            {t('whyTitle')}
          </h2>
          <div className="brawl-card-dark p-6 md:p-8 border-[#090E17] space-y-4">
            <p className="text-sm md:text-base text-slate-300 leading-relaxed font-['Inter']">
              {t('whyParagraph1')}
            </p>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed font-['Inter']">
              {t('whyParagraph2')}
            </p>
          </div>
        </section>

        {/* In-content ad — sits between the editorial body (≥600
            words above) and the FAQ. Only renders when the
            translated benefits+steps arrays are non-empty (they
            ship in all 13 locales, but the gate is a safety net
            against a locale shipping with empty keys). */}
        <SafeAdSlot hasContent={benefits.length > 0 && steps.length > 0 && faq.length > 0} />

        {/* FAQ */}
        <section>
          <h2 className="text-2xl md:text-3xl font-['Lilita_One'] text-white text-stroke-brawl text-center mb-6">
            {t('faqTitle')}
          </h2>
          <div className="space-y-3">
            {faq.map((entry, i) => (
              <details key={i} className="brawl-card-dark p-5 border-[#090E17] group">
                <summary className="font-['Lilita_One'] text-base md:text-lg text-white cursor-pointer list-none flex justify-between items-center">
                  <span>{entry.q}</span>
                  <span className="text-[#FFC91B] text-xl group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-sm text-slate-400 leading-relaxed mt-3">
                  {entry.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="brawl-card p-6 md:p-8 text-center">
          <h2 className="font-['Lilita_One'] text-2xl md:text-3xl text-white text-stroke-brawl mb-3">
            {t('finalCtaTitle')}
          </h2>
          <p className="text-sm md:text-base text-[var(--color-brawl-dark)] font-['Inter'] font-semibold max-w-xl mx-auto mb-5">
            {t('finalCtaBody')}
          </p>
          <Link
            href={`/${locale}`}
            className="brawl-button inline-flex items-center gap-2 px-6 py-3 text-base"
          >
            {t('ctaPrimary')}
          </Link>
        </section>
      </main>
    </div>
  )
}
