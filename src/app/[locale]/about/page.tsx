import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Home, Mail, Users } from 'lucide-react'

export const revalidate = 86400 // ISR: 1 day — about page rarely changes

const BASE_URL = 'https://brawlvision.com'
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'about' })
  const languages: Record<string, string> = { 'x-default': `${BASE_URL}/es/about` }
  for (const loc of LOCALES) {
    languages[loc] = `${BASE_URL}/${loc}/about`
  }
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    alternates: {
      canonical: `${BASE_URL}/${locale}/about`,
      languages,
    },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      url: `${BASE_URL}/${locale}/about`,
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
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'about' })

  const sections = t.raw('sections') as Section[]
  const datePublished = '2026-04-30'

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: t('metaTitle'),
      description: t('metaDescription'),
      inLanguage: locale,
      url: `${BASE_URL}/${locale}/about`,
      datePublished,
      publisher: {
        '@type': 'Organization',
        name: 'BrawlVision',
        url: BASE_URL,
        logo: { '@type': 'ImageObject', url: `${BASE_URL}/assets/brand/logo-full.png` },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'BrawlVision', item: `${BASE_URL}/${locale}` },
        { '@type': 'ListItem', position: 2, name: t('breadcrumbLabel'), item: `${BASE_URL}/${locale}/about` },
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

      <main className="max-w-3xl mx-auto p-4 sm:p-8 pb-16 space-y-8">

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
        </section>

        {sections.map((section) => (
          <section key={section.id} id={section.id} className="brawl-card-dark p-6 md:p-8 border-[#090E17] scroll-mt-20">
            <h2 className="font-['Lilita_One'] text-2xl md:text-3xl text-white text-stroke-brawl mb-4">
              {section.title}
            </h2>
            <div className="space-y-3">
              {section.paragraphs.map((p, pi) => (
                <p key={pi} className="text-sm md:text-base text-slate-300 leading-relaxed font-['Inter']">
                  {p}
                </p>
              ))}
            </div>
          </section>
        ))}

        {/* Contact + transparency */}
        <section id="contact" className="brawl-card p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-12 h-12 rounded-xl bg-[#1C5CF1]/15 border border-[#1C5CF1]/30 inline-flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-[#1C5CF1]" />
            </span>
            <h2 className="font-['Lilita_One'] text-2xl md:text-3xl text-white text-stroke-brawl">
              {t('contactTitle')}
            </h2>
          </div>
          <p className="text-sm md:text-base text-[var(--color-brawl-dark)] font-['Inter'] font-semibold leading-relaxed mb-5">
            {t('contactBody')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="mailto:contact@brawlvision.com"
              className="brawl-button inline-flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              <Mail className="w-4 h-4" />
              contact@brawlvision.com
            </a>
            <Link
              href={`/${locale}/methodology`}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm text-[var(--color-brawl-dark)] hover:text-[#1C5CF1] transition-colors font-['Inter'] font-bold"
            >
              {t('methodologyLink')}
            </Link>
            <Link
              href={`/${locale}/privacy`}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm text-[var(--color-brawl-dark)] hover:text-[#1C5CF1] transition-colors font-['Inter'] font-bold"
            >
              {t('privacyLink')}
            </Link>
          </div>
          <p className="text-[11px] text-slate-700 font-['Inter'] mt-5">
            {t('disclaimer')}
          </p>
        </section>
      </main>
    </div>
  )
}
