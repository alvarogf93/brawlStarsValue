'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/routing'
import { useBrawlerMeta } from '@/hooks/useBrawlerMeta'
import { getCachedRegistry } from '@/lib/brawler-registry'
import { resolveBrawlerName } from '@/lib/brawler-name'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BRAWLER_RARITY_MAP, RARITY_COLORS } from '@/lib/constants'
import { MetaIntelligence } from '@/components/brawler-detail/MetaIntelligence'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { SafeAdSlot } from '@/components/ui/SafeAdSlot'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { Home, ArrowLeft, BookOpen } from 'lucide-react'
import { buildBrawlerArticle } from '@/lib/brawler-detail/article'
import type { BrawlerRarityName } from '@/lib/types'
import type { BrawlerEntry } from '@/lib/brawler-registry'

const BASE_URL = 'https://brawlvision.com'

function PublicBrawlerSkeleton() {
  return (
    <div className="animate-fade-in max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      <div className="brawl-card p-5 md:p-8">
        <Skeleton className="h-4 w-24 mb-4" />
        <div className="flex flex-col md:flex-row items-center gap-6">
          <Skeleton className="w-[120px] h-[120px] rounded-2xl shrink-0" />
          <div className="space-y-3 flex-1 w-full">
            <Skeleton className="h-10 w-48 mx-auto md:mx-0" />
            <Skeleton className="h-6 w-32 mx-auto md:mx-0" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  )
}

export default function PublicBrawlerPage() {
  const params = useParams<{ brawlerId: string }>()
  const t = useTranslations('brawlerDetail')
  const locale = useLocale()
  const brawlerId = parseInt(params.brawlerId, 10)

  const { data: metaData, isLoading, error } = useBrawlerMeta(brawlerId, 90)

  // Resolve brawler info from cached registry. Synchronous read — if
  // the registry hasn't been hydrated yet, the article falls into its
  // "no rarity / no class" template variants, which is the right
  // behavior on cold load.
  const registry = getCachedRegistry()
  const brawlerInfo: BrawlerEntry | null = registry?.find(b => b.id === brawlerId) ?? null
  const rarity: BrawlerRarityName | null = BRAWLER_RARITY_MAP[brawlerId] ?? null
  const rarityColor = rarity ? RARITY_COLORS[rarity] : '#94A3B8'
  const name = resolveBrawlerName(brawlerId)

  // Resolve opponent / teammate names so the article copy can name
  // them inline. The article.ts builder accepts these as optional
  // inputs and falls back to a placeholder otherwise.
  const opponentName = useMemo(() => {
    const id = metaData?.strongAgainst[0]?.opponentId
    return id != null ? resolveBrawlerName(id) : null
  }, [metaData])
  const weakOpponentName = useMemo(() => {
    const id = metaData?.weakAgainst[0]?.opponentId
    return id != null ? resolveBrawlerName(id) : null
  }, [metaData])
  const bestTeammateName = useMemo(() => {
    const id = metaData?.bestTeammates[0]?.teammateId
    return id != null ? resolveBrawlerName(id) : null
  }, [metaData])

  // Editorial article — interpolated against real meta data so each
  // brawler × locale produces uniquely-worded copy. ~6 sections of
  // 1-3 paragraphs each, ~700-1000 dynamic words on a populated page.
  const article = useMemo(() => {
    return buildBrawlerArticle({
      name,
      rarity,
      brawlerClass: brawlerInfo?.class || null,
      meta: metaData ?? null,
      opponentName,
      weakOpponentName,
      bestTeammateName,
      t: (key, vars) => t(key, vars),
    })
  }, [name, rarity, brawlerInfo, metaData, opponentName, weakOpponentName, bestTeammateName, t])

  if (isNaN(brawlerId)) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="glass p-8 rounded-2xl text-center border-red-500/30">
          <p className="text-red-400">Invalid brawler ID</p>
        </div>
      </div>
    )
  }

  if (isLoading) return <PublicBrawlerSkeleton />

  // Guards for ad gating: only render slots when we have real data
  // (>=30 battles is the same threshold the article uses to switch
  // away from "thin sample" template variants).
  const hasMeaningfulData =
    !!metaData && metaData.globalStats.totalBattles >= 30 && !error
  const hasCounters =
    !!metaData && (metaData.strongAgainst.length > 0 || metaData.weakAgainst.length > 0)

  // Schema.org Article JSON-LD. Marks the page as editorial content
  // for Google + AdSense reviewers; the headline / description /
  // body are all locale-specific so /es and /en don't share metadata.
  const datePublished = '2026-04-30'
  const dateModified = '2026-04-30'
  const jsonLd = metaData
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: t('article.sectionLeadTitle', { name }),
        description: article.leadParagraphs[0],
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
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `${BASE_URL}/${locale}/brawler/${brawlerId}`,
        },
      }
    : null

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <header className="bg-[#0F172A] border-b-4 border-[#030712] px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <img src="/assets/brand/logo-full.png" alt="BrawlVision" width={200} height={96} className="h-auto w-[100px]" />
        </Link>
        <Link
          href="/"
          className="p-2 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/5"
        >
          <Home className="w-5 h-5" />
        </Link>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-8 pb-16">
        <article className="space-y-8 animate-fade-in">

          {/* Hero — brawler portrait + rarity + class */}
          <header
            className="brawl-card p-5 md:p-8 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${rarityColor}20 0%, transparent 60%)` }}
          >
            <Link
              href="/"
              className="text-sm text-slate-400 hover:text-white transition-colors font-['Lilita_One'] inline-block mb-4"
            >
              <ArrowLeft className="w-4 h-4 inline mr-1" />
              BrawlVision
            </Link>

            <div className="flex flex-col sm:flex-row gap-5 md:gap-8 items-start sm:items-center">
              <div
                className="w-[120px] h-[120px] md:w-[160px] md:h-[160px] rounded-2xl border-4 overflow-hidden shrink-0"
                style={{ borderColor: rarityColor }}
              >
                <BrawlImg
                  src={getBrawlerPortraitUrl(brawlerId)}
                  fallbackSrc={getBrawlerPortraitFallback(brawlerId)}
                  alt={name}
                  fallbackText={name}
                  className="w-full h-full object-cover rounded-xl"
                />
              </div>

              <div className="flex flex-col gap-3">
                <h1 className="text-3xl md:text-4xl text-white font-['Lilita_One'] leading-tight">
                  {name}
                </h1>
                {brawlerInfo?.class && (
                  <p className="text-sm text-slate-400">{brawlerInfo.class}</p>
                )}
                {rarity && (
                  <span
                    className="inline-block self-start rounded-full px-3 py-1 text-xs font-['Lilita_One'] text-white border-2"
                    style={{ backgroundColor: `${rarityColor}66`, borderColor: rarityColor }}
                  >
                    {rarity}
                  </span>
                )}
              </div>
            </div>
          </header>

          {/* ── Section 1: Lead — who is this brawler ── */}
          <section className="brawl-card-dark p-5 md:p-8 border-[#090E17] space-y-4">
            <h2 className="font-['Lilita_One'] text-2xl md:text-3xl text-white text-stroke-brawl">
              {t('article.sectionLeadTitle', { name })}
            </h2>
            {article.leadParagraphs.map((p, i) => (
              <p key={i} className="text-sm md:text-base text-slate-300 leading-relaxed font-['Inter']">
                {p}
              </p>
            ))}
          </section>

          {/* ── Stats overview + Best Maps grid (existing component) ── */}
          {metaData && <MetaIntelligence data={metaData} />}

          {error && (
            <div className="brawl-card-dark p-5 border-[#090E17] text-center">
              <p className="text-sm text-slate-500">{t('insufficientData')}</p>
            </div>
          )}

          {/* ── Ad slot 1 — between stats overview and the maps deep dive.
                Gated by `hasMeaningfulData`: ≥30 battles in the meta + no
                error. The article above is full editorial content (≥3
                paragraphs) by the time we reach this slot. ── */}
          <SafeAdSlot hasContent={hasMeaningfulData} />

          {/* ── Section 2: Maps deep dive ── */}
          <section className="brawl-card-dark p-5 md:p-8 border-[#090E17] space-y-4">
            <h2 className="font-['Lilita_One'] text-2xl md:text-3xl text-white text-stroke-brawl">
              {t('article.sectionMapsTitle', { name })}
            </h2>
            {article.mapsParagraphs.map((p, i) => (
              <p key={i} className="text-sm md:text-base text-slate-300 leading-relaxed font-['Inter']">
                {p}
              </p>
            ))}
          </section>

          {/* ── Section 3: Counters deep dive ── */}
          <section className="brawl-card-dark p-5 md:p-8 border-[#090E17] space-y-4">
            <h2 className="font-['Lilita_One'] text-2xl md:text-3xl text-white text-stroke-brawl">
              {t('article.sectionCountersTitle')}
            </h2>
            {article.countersParagraphs.map((p, i) => (
              <p key={i} className="text-sm md:text-base text-slate-300 leading-relaxed font-['Inter']">
                {p}
              </p>
            ))}
          </section>

          {/* ── Ad slot 2 — between counters and upgrades. Gated by
                hasCounters so we never render this slot when the
                counters section above is empty. ── */}
          <SafeAdSlot hasContent={hasMeaningfulData && hasCounters} />

          {/* ── Section 4: Upgrades ── */}
          <section className="brawl-card-dark p-5 md:p-8 border-[#090E17] space-y-4">
            <h2 className="font-['Lilita_One'] text-2xl md:text-3xl text-white text-stroke-brawl">
              {t('article.sectionUpgradesTitle')}
            </h2>
            {article.upgradesParagraphs.map((p, i) => (
              <p key={i} className="text-sm md:text-base text-slate-300 leading-relaxed font-['Inter']">
                {p}
              </p>
            ))}
          </section>

          {/* ── Section 5: Weekly trend ── */}
          <section className="brawl-card-dark p-5 md:p-8 border-[#090E17] space-y-4">
            <h2 className="font-['Lilita_One'] text-2xl md:text-3xl text-white text-stroke-brawl">
              {t('article.sectionTrendTitle')}
            </h2>
            {article.trendParagraphs.map((p, i) => (
              <p key={i} className="text-sm md:text-base text-slate-300 leading-relaxed font-['Inter']">
                {p}
              </p>
            ))}
          </section>

          {/* ── Methodology link block ── */}
          <section className="brawl-card-dark p-5 md:p-6 border-[#090E17] flex items-start gap-4">
            <span className="w-12 h-12 rounded-xl bg-[#1C5CF1]/15 border border-[#1C5CF1]/30 inline-flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6 text-[#1C5CF1]" />
            </span>
            <div className="flex-1 space-y-2">
              <h3 className="font-['Lilita_One'] text-lg text-white">
                {t('article.methodologyLink')}
              </h3>
              <p className="text-sm text-slate-400 font-['Inter'] leading-relaxed">
                {t('article.methodologyBody', {
                  link: `/${locale}/methodology`,
                })}
              </p>
              <Link
                href="/methodology"
                className="inline-block text-sm text-[#4EC0FA] hover:text-white font-bold font-['Inter'] underline-offset-2 hover:underline"
              >
                /methodology
              </Link>
            </div>
          </section>

          {/* ── CTA to sign up (kept from original) ── */}
          <section className="brawl-card p-6 md:p-8 text-center">
            <p className="font-['Lilita_One'] text-xl text-white mb-2">
              {t('unlockPersonal')}
            </p>
            <p className="text-sm text-slate-400 mb-4">
              {t('personalTitle', { brawler: name })}
            </p>
            <Link
              href="/"
              className="brawl-button px-8 py-3 text-base inline-block"
            >
              {t('unlockCta')}
            </Link>
          </section>

        </article>
      </main>

      <footer className="border-t border-white/5 py-4 text-center">
        <p className="text-xs text-slate-600">
          BrawlVision — combat analytics
        </p>
      </footer>
    </div>
  )
}
