import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Home, Database, Calculator, Activity, Clock, Shield, BookOpen } from 'lucide-react'

export const revalidate = 86400 // ISR: 1 day — methodology rarely changes

const BASE_URL = 'https://brawlvision.com'
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'methodology' })
  const languages: Record<string, string> = { 'x-default': `${BASE_URL}/es/methodology` }
  for (const loc of LOCALES) {
    languages[loc] = `${BASE_URL}/${loc}/methodology`
  }
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    alternates: {
      canonical: `${BASE_URL}/${locale}/methodology`,
      languages,
    },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      url: `${BASE_URL}/${locale}/methodology`,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('metaTitle'),
      description: t('metaDescription'),
    },
  }
}

interface Section {
  id: string
  title: string
  paragraphs: string[]
  bullets?: string[]
}

interface FaqEntry {
  q: string
  a: string
}

const SECTION_ICONS = [Database, Activity, Calculator, BookOpen, Clock, Shield]

export default async function MethodologyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'methodology' })

  const sections = t.raw('sections') as Section[]
  const faq = t.raw('faq') as FaqEntry[]

  // Schema.org Article + FAQPage + BreadcrumbList. Article in particular
  // is the signal Google reads for "this is editorial content with an
  // author and a date" — the framework that keeps reviewers from
  // classifying the page as a thin landing.
  const datePublished = '2026-04-30'
  const dateModified = '2026-04-30'
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: t('metaTitle'),
      description: t('metaDescription'),
      inLanguage: locale,
      datePublished,
      dateModified,
      author: { '@type': 'Organization', name: 'BrawlVision', url: BASE_URL },
      publisher: {
        '@type': 'Organization',
        name: 'BrawlVision',
        url: BASE_URL,
        logo: { '@type': 'ImageObject', url: `${BASE_URL}/assets/brand/logo-full.png` },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${BASE_URL}/${locale}/methodology` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((entry) => ({
        '@type': 'Question',
        name: entry.q,
        acceptedAnswer: { '@type': 'Answer', text: entry.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'BrawlVision', item: `${BASE_URL}/${locale}` },
        { '@type': 'ListItem', position: 2, name: t('breadcrumbLabel'), item: `${BASE_URL}/${locale}/methodology` },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-[#0F172A]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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

        <section className="brawl-card p-6 md:p-10">
          <p className="text-xs uppercase tracking-widest text-[var(--color-brawl-dark)] font-bold mb-3">
            {t('eyebrow')}
          </p>
          <h1 className="text-3xl md:text-5xl font-['Lilita_One'] text-white text-stroke-brawl leading-[1.1] mb-4">
            {t('heroTitle')}
          </h1>
          <p className="text-sm md:text-base text-[var(--color-brawl-dark)] font-['Inter'] font-semibold leading-relaxed">
            {t('heroLead')}
          </p>
          <p className="text-xs text-slate-700 font-['Inter'] mt-4">
            {t('lastUpdated', { date: dateModified })}
          </p>
        </section>

        {/* Table of Contents — accessibility + E-E-A-T signal */}
        <nav aria-labelledby="toc-heading" className="brawl-card-dark p-5 border-[#090E17]">
          <h2 id="toc-heading" className="font-['Lilita_One'] text-lg text-[var(--color-brawl-gold)] mb-3">
            {t('tocTitle')}
          </h2>
          <ol className="space-y-1 text-sm text-slate-300 font-['Inter'] list-decimal list-inside">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="hover:text-white underline-offset-2 hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((section, i) => {
          const Icon = SECTION_ICONS[i % SECTION_ICONS.length]
          return (
            <section key={section.id} id={section.id} className="brawl-card-dark p-6 md:p-8 border-[#090E17] scroll-mt-20">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-12 h-12 rounded-xl bg-[#FFC91B]/15 border border-[#FFC91B]/30 inline-flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-[#FFC91B]" />
                </span>
                <h2 className="font-['Lilita_One'] text-2xl md:text-3xl text-white text-stroke-brawl">
                  {section.title}
                </h2>
              </div>
              <div className="space-y-4">
                {section.paragraphs.map((p, pi) => (
                  <p key={pi} className="text-sm md:text-base text-slate-300 leading-relaxed font-['Inter']">
                    {p}
                  </p>
                ))}
                {section.bullets && section.bullets.length > 0 && (
                  <ul className="list-disc list-inside space-y-2 text-sm md:text-base text-slate-300 font-['Inter']">
                    {section.bullets.map((b, bi) => (
                      <li key={bi} className="leading-relaxed">{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )
        })}

        {/* FAQ */}
        <section id="faq" className="brawl-card-dark p-6 md:p-8 border-[#090E17] scroll-mt-20">
          <h2 className="text-2xl md:text-3xl font-['Lilita_One'] text-white text-stroke-brawl mb-6">
            {t('faqTitle')}
          </h2>
          <div className="space-y-3">
            {faq.map((entry, i) => (
              <details key={i} className="brawl-card p-5 group">
                <summary className="font-['Lilita_One'] text-base md:text-lg text-[var(--color-brawl-dark)] cursor-pointer list-none flex justify-between items-center">
                  <span>{entry.q}</span>
                  <span className="text-[var(--color-brawl-gold)] text-xl group-open:rotate-45 transition-transform shrink-0 ml-3">+</span>
                </summary>
                <p className="text-sm text-slate-700 leading-relaxed mt-3 font-['Inter']">
                  {entry.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Authority + contact */}
        <section className="brawl-card p-6 md:p-8 text-center">
          <h2 className="font-['Lilita_One'] text-2xl md:text-3xl text-white text-stroke-brawl mb-3">
            {t('contactTitle')}
          </h2>
          <p className="text-sm md:text-base text-[var(--color-brawl-dark)] font-['Inter'] font-semibold max-w-xl mx-auto mb-5">
            {t('contactBody')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/${locale}/about`}
              className="brawl-button inline-flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              {t('aboutLink')}
            </Link>
            <Link
              href={`/${locale}/privacy`}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm text-[var(--color-brawl-dark)] hover:text-[#1C5CF1] transition-colors font-['Inter'] font-bold"
            >
              {t('privacyLink')}
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
