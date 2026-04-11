'use client'

import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BRAWLER_RARITY_MAP, RARITY_COLORS } from '@/lib/constants'
import { resolveBrawlerName } from '@/lib/brawler-name'
import { Home } from 'lucide-react'
import type { BrawlerRarityName } from '@/lib/types'

export default function BrawlerIndexPage() {
  const locale = useLocale()
  const t = useTranslations('landing')

  const brawlerIds = Object.keys(BRAWLER_RARITY_MAP).map(Number).sort((a, b) => a - b)

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Header */}
      <header className="bg-[#0F172A] border-b-4 border-[#030712] px-6 py-3 flex items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center gap-3">
          <img src="/assets/brand/logo-full.png" alt="BrawlVision" width={200} height={96} className="h-auto w-[100px]" />
        </Link>
        <Link href={`/${locale}`} className="p-2 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/5">
          <Home className="w-5 h-5" />
        </Link>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-8 pb-16">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-['Lilita_One'] text-white text-stroke-brawl mb-2">
            {t('exploreBrawlersTitle')}
          </h1>
          <p className="text-sm text-slate-400 font-['Lilita_One']">
            {t('exploreBrawlersDesc')}
          </p>
        </div>

        {/* Brawler grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {brawlerIds.map(id => {
            const name = resolveBrawlerName(id)
            const rarity = BRAWLER_RARITY_MAP[id] ?? 'Trophy Road'
            const color = RARITY_COLORS[rarity as BrawlerRarityName]

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
      </main>

      <footer className="border-t border-white/5 py-4 text-center">
        <p className="text-xs text-slate-600">BrawlVision — combat analytics</p>
      </footer>
    </div>
  )
}
