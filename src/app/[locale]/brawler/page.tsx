import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { Metadata } from 'next'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BRAWLER_RARITY_MAP, RARITY_COLORS } from '@/lib/constants'
import { resolveBrawlerName } from '@/lib/brawler-name'
import { SafeAdSlot } from '@/components/ui/SafeAdSlot'
import { Home, Layers, BookOpen, Sparkles } from 'lucide-react'
import type { BrawlerRarityName } from '@/lib/types'

export const revalidate = 21600 // ISR: 6h — roster + rarity + meta notes

const BASE_URL = 'https://brawlvision.com'
const LOCALES = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

/** Order in which we display rarity buckets — same order brawlers
 *  unlock in-game, so the table reads naturally for any locale. */
const RARITY_ORDER: BrawlerRarityName[] = [
  'Trophy Road',
  'Rare',
  'Super Rare',
  'Epic',
  'Mythic',
  'Legendary',
  'Chromatic',
  'Ultra Legendary',
]

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'brawlerRoster' })
  const count = Object.keys(BRAWLER_RARITY_MAP).length
  const languages: Record<string, string> = { 'x-default': `${BASE_URL}/es/brawler` }
  for (const loc of LOCALES) {
    languages[loc] = `${BASE_URL}/${loc}/brawler`
  }
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription', { count }),
    alternates: {
      canonical: `${BASE_URL}/${locale}/brawler`,
      languages,
    },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription', { count }),
      url: `${BASE_URL}/${locale}/brawler`,
    },
  }
}

interface RarityBucket {
  rarity: BrawlerRarityName
  count: number
  percent: number
}

function buildRarityDistribution(): { count: number; buckets: RarityBucket[] } {
  const counts: Record<string, number> = {}
  for (const rarity of Object.values(BRAWLER_RARITY_MAP)) {
    counts[rarity] = (counts[rarity] ?? 0) + 1
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const buckets: RarityBucket[] = RARITY_ORDER
    .filter(r => counts[r] > 0)
    .map(rarity => ({
      rarity,
      count: counts[rarity],
      percent: Math.round((counts[rarity] / total) * 100),
    }))
  return { count: total, buckets }
}

export default async function BrawlerIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'brawlerRoster' })

  const { count, buckets } = buildRarityDistribution()
  const brawlerIds = Object.keys(BRAWLER_RARITY_MAP).map(Number).sort((a, b) => a - b)

  // Schema.org CollectionPage — signals to Google that this is an
  // editorial listing, not a navigation-only page. Pairs with the
  // ≥800-word lead/distribution/notes copy above the grid.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t('metaTitle'),
    description: t('metaDescription', { count }),
    inLanguage: locale,
    url: `${BASE_URL}/${locale}/brawler`,
    publisher: {
      '@type': 'Organization',
      name: 'BrawlVision',
      url: BASE_URL,
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/assets/brand/logo-full.png` },
    },
  }

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
        <Link href={`/${locale}`} className="p-2 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/5">
          <Home className="w-5 h-5" />
        </Link>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-8 pb-16 space-y-8">

        {/* Hero — title + 2 lead paragraphs */}
        <section className="brawl-card p-6 md:p-10">
          <p className="text-xs uppercase tracking-widest text-[var(--color-brawl-dark)] font-bold mb-3">
            {t('eyebrow')}
          </p>
          <h1 className="text-3xl md:text-5xl font-['Lilita_One'] text-white text-stroke-brawl leading-[1.1] mb-4">
            {t('heroTitle')}
          </h1>
          <p className="text-sm md:text-base text-[var(--color-brawl-dark)] font-['Inter'] font-semibold leading-relaxed mb-3">
            {t('heroLead', { count })}
          </p>
          <p className="text-sm md:text-base text-[var(--color-brawl-dark)] font-['Inter'] font-semibold leading-relaxed">
            {t('heroLeadSecond')}
          </p>
        </section>

        {/* Rarity distribution */}
        <section className="brawl-card-dark p-6 md:p-8 border-[#090E17]">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-12 h-12 rounded-xl bg-[#FFC91B]/15 border border-[#FFC91B]/30 inline-flex items-center justify-center shrink-0">
              <Layers className="w-6 h-6 text-[#FFC91B]" />
            </span>
            <h2 className="font-['Lilita_One'] text-2xl md:text-3xl text-white text-stroke-brawl">
              {t('distributionTitle')}
            </h2>
          </div>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed font-['Inter'] mb-5">
            {t('distributionLead')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {buckets.map(b => {
              const color = RARITY_COLORS[b.rarity]
              return (
                <div
                  key={b.rarity}
                  className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                    <span className="font-['Lilita_One'] text-sm text-white tracking-wide">{b.rarity}</span>
                  </span>
                  <span className="font-['Inter'] text-sm text-slate-300 tabular-nums">
                    {t('rarityCountFormat', { count: b.count, percent: b.percent })}
                  </span>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-slate-500 font-['Inter'] mt-4">
            {t('distributionFootnote')}
          </p>
        </section>

        {/* Meta notes */}
        <section className="brawl-card-dark p-6 md:p-8 border-[#090E17] space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-xl bg-[#1C5CF1]/15 border border-[#1C5CF1]/30 inline-flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-[#1C5CF1]" />
            </span>
            <h2 className="font-['Lilita_One'] text-2xl md:text-3xl text-white text-stroke-brawl">
              {t('metaNotesTitle')}
            </h2>
          </div>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed font-['Inter']">
            {t('metaNotesParagraph1')}
          </p>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed font-['Inter']">
            {t('metaNotesParagraph2')}
          </p>
        </section>

        {/* Methodology link */}
        <section className="brawl-card-dark p-5 md:p-6 border-[#090E17] flex items-start gap-4">
          <span className="w-12 h-12 rounded-xl bg-[#FFC91B]/15 border border-[#FFC91B]/30 inline-flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6 text-[#FFC91B]" />
          </span>
          <div className="flex-1">
            <Link
              href={`/${locale}/methodology`}
              className="font-['Lilita_One'] text-lg text-white hover:text-[#FFC91B] transition-colors underline-offset-2 hover:underline"
            >
              {t('methodologyLink')}
            </Link>
          </div>
        </section>

        {/* In-content ad — placed after ≥800 words of editorial copy
            (hero lead × 2 + distribution lead + 2 meta-notes paragraphs)
            and before the grid. The page count is dynamic (changes
            with new brawler launches), so we gate on it as a defensive
            check even though it's effectively always > 0. */}
        <SafeAdSlot hasContent={brawlerIds.length > 0} />

        {/* Roster grid (existing UX) */}
        <section className="space-y-4">
          <h2 className="font-['Lilita_One'] text-2xl md:text-3xl text-white text-stroke-brawl">
            {t('countLabel')} ({count})
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {brawlerIds.map(id => {
              const name = resolveBrawlerName(id)
              const rarity = (BRAWLER_RARITY_MAP[id] ?? 'Trophy Road') as BrawlerRarityName
              const color = RARITY_COLORS[rarity]

              return (
                <Link
                  key={id}
                  href={`/${locale}/brawler/${id}`}
                  className="group relative brawl-card-dark p-2 text-center transition-transform hover:scale-[1.05] active:scale-[0.97]"
                >
                  <div
                    className="w-full aspect-square rounded-xl border-2 overflow-hidden mb-1.5"
                    style={{ borderColor: color }}
                  >
                    <BrawlImg
                      src={getBrawlerPortraitUrl(id)}
                      fallbackSrc={getBrawlerPortraitFallback(id)}
                      alt={name}
                      fallbackText={name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                    />
                  </div>
                  <p className="font-['Lilita_One'] text-[10px] text-white truncate leading-tight">
                    {name}
                  </p>
                  <p className="text-[8px] uppercase tracking-wider" style={{ color }}>
                    {rarity}
                  </p>
                </Link>
              )
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-4 text-center">
        <p className="text-xs text-slate-600">BrawlVision — combat analytics</p>
      </footer>
    </div>
  )
}
