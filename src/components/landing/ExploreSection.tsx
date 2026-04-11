'use client'

import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'

const MAP_BG_URL = 'https://cdn.brawlify.com/maps/regular/15000026.png'

const BRAWLER_IDS = [16000000, 16000001, 16000003] as const

export function ExploreSection() {
  const t = useTranslations('landing')
  const locale = useLocale()

  return (
    <section className="w-full">
      <h2 className="text-3xl md:text-4xl font-['Lilita_One'] text-stroke-brawl text-white text-center mb-6">
        {t('exploreTitle')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[900px] mx-auto">
        {/* Picks de hoy */}
        <Link
          href={`/${locale}/picks`}
          className="group relative overflow-hidden rounded-2xl border-4 border-[var(--color-brawl-dark)] h-32 md:h-40 hover:scale-[1.02] transition-transform shadow-[0_4px_0_0_rgba(18,26,47,1)]"
        >
          <img
            src={MAP_BG_URL}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-30"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-5">
            <span className="text-2xl mb-1">&#x2694;&#xFE0F;</span>
            <h3 className="font-['Lilita_One'] text-lg text-white tracking-wide" style={{ textShadow: '0 2px 0 rgba(0,0,0,0.4)' }}>
              {t('explorePicksTitle')}
            </h3>
            <p className="text-xs text-slate-300 font-['Inter'] mt-0.5">
              {t('explorePicksDesc')}
            </p>
            <span className="absolute top-4 right-4 text-white/60 text-xl group-hover:translate-x-1 transition-transform">
              &rarr;
            </span>
          </div>
        </Link>

        {/* Stats de Brawlers */}
        <Link
          href={`/${locale}/brawler`}
          className="group relative overflow-hidden rounded-2xl border-4 border-[var(--color-brawl-dark)] h-32 md:h-40 hover:scale-[1.02] transition-transform shadow-[0_4px_0_0_rgba(18,26,47,1)]"
        >
          {/* Overlapping brawler portraits */}
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            {BRAWLER_IDS.map((id, i) => (
              <div
                key={id}
                className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-[var(--color-brawl-dark)]"
                style={{ marginLeft: i > 0 ? '-16px' : '0', zIndex: BRAWLER_IDS.length - i }}
              >
                <BrawlImg
                  src={getBrawlerPortraitUrl(id)}
                  fallbackSrc={getBrawlerPortraitFallback(id)}
                  alt={`Brawler ${id}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-5">
            <span className="text-2xl mb-1">&#x1F50D;</span>
            <h3 className="font-['Lilita_One'] text-lg text-white tracking-wide" style={{ textShadow: '0 2px 0 rgba(0,0,0,0.4)' }}>
              {t('exploreBrawlersTitle')}
            </h3>
            <p className="text-xs text-slate-300 font-['Inter'] mt-0.5">
              {t('exploreBrawlersDesc')}
            </p>
            <span className="absolute top-4 right-4 text-white/60 text-xl group-hover:translate-x-1 transition-transform">
              &rarr;
            </span>
          </div>
        </Link>
      </div>
    </section>
  )
}
