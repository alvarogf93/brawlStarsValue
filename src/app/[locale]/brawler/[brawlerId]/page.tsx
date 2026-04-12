'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { useBrawlerMeta } from '@/hooks/useBrawlerMeta'
import { getCachedRegistry } from '@/lib/brawler-registry'
import { resolveBrawlerName } from '@/lib/brawler-name'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BRAWLER_RARITY_MAP, RARITY_COLORS } from '@/lib/constants'
import { MetaIntelligence } from '@/components/brawler-detail/MetaIntelligence'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { Home, ArrowLeft } from 'lucide-react'
import type { BrawlerRarityName } from '@/lib/types'
import type { BrawlerEntry } from '@/lib/brawler-registry'

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
  const brawlerId = parseInt(params.brawlerId, 10)

  const { data: metaData, isLoading, error } = useBrawlerMeta(brawlerId, 90)

  if (isNaN(brawlerId)) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="glass p-8 rounded-2xl text-center border-red-500/30">
          <p className="text-red-400">Invalid brawler ID</p>
        </div>
      </div>
    )
  }

  // Resolve brawler info
  const registry = getCachedRegistry()
  const brawlerInfo: BrawlerEntry | null = registry?.find(b => b.id === brawlerId) ?? null
  const rarity: BrawlerRarityName = BRAWLER_RARITY_MAP[brawlerId] ?? 'Trophy Road'
  const rarityColor = RARITY_COLORS[rarity]
  const name = resolveBrawlerName(brawlerId)

  if (isLoading) return <PublicBrawlerSkeleton />

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Simple public header */}
      <header className="bg-[#0F172A] border-b-4 border-[#030712] px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <img src="/assets/brand/logo-full.png" alt="BrawlVision" width={200} height={96} className="h-auto w-[100px]" />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="p-2 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/5"
          >
            <Home className="w-5 h-5" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-8 pb-16">
        <div className="animate-fade-in space-y-6">
          {/* Hero Banner — public version (no player stats) */}
          <div
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
                <span
                  className="inline-block self-start rounded-full px-3 py-1 text-xs font-['Lilita_One'] text-white border-2"
                  style={{ backgroundColor: `${rarityColor}66`, borderColor: rarityColor }}
                >
                  {rarity}
                </span>
              </div>
            </div>
          </div>

          {/* Meta Intelligence — public data */}
          {metaData && <MetaIntelligence data={metaData} />}

          {error && (
            <div className="brawl-card-dark p-5 border-[#090E17] text-center">
              <p className="text-sm text-slate-500">{t('insufficientData')}</p>
            </div>
          )}

          {/* CTA to sign up */}
          <div className="brawl-card p-6 md:p-8 text-center">
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
          </div>
        </div>
      </main>

      {/* Simple footer */}
      <footer className="border-t border-white/5 py-4 text-center">
        <p className="text-xs text-slate-600">
          BrawlVision — combat analytics
        </p>
      </footer>
    </div>
  )
}
