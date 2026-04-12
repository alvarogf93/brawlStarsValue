'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AuthModal } from '@/components/auth/AuthModal'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'

const FREE_BULLETS = [
  { key: 'trialBannerFreeP1', emoji: '🏆' },
  { key: 'trialBannerFreeP2', emoji: '💎' },
  { key: 'trialBannerFreeP3', emoji: '📊' },
] as const

const PRO_BULLETS = [
  { key: 'trialBannerProP1', brawlerId: 16000000 },
  { key: 'trialBannerProP2', brawlerId: 16000015 },
  { key: 'trialBannerProP3', brawlerId: 16000022 },
  { key: 'trialBannerProP4', brawlerId: 16000034 },
] as const

export function TrialBanner() {
  const t = useTranslations('landing')
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[900px] mx-auto">
        {/* FREE column */}
        <div className="brawl-card-dark p-6 border-l-4 border-green-500">
          <h3
            className="font-['Lilita_One'] text-xl text-white tracking-wide mb-4"
            style={{ textShadow: '0 2px 0 rgba(0,0,0,0.3)' }}
          >
            {t('trialBannerFreeTitle')}
          </h3>
          <ul className="space-y-3">
            {FREE_BULLETS.map((b) => (
              <li
                key={b.key}
                className="flex items-center gap-3 font-['Lilita_One'] text-sm text-white"
                style={{ textShadow: '0 2px 0 rgba(0,0,0,0.3)' }}
              >
                <div className="w-8 h-8 rounded-lg bg-green-500/20 border-2 border-green-400 flex items-center justify-center shrink-0 shadow-[0_2px_0_rgba(0,0,0,0.3)]">
                  <span className="text-lg">{b.emoji}</span>
                </div>
                {t(b.key)}
              </li>
            ))}
          </ul>
        </div>

        {/* TRIAL PRO column */}
        <div
          className="brawl-card-dark p-6 relative border-2 border-[#FFC91B]"
          style={{ overflow: 'visible' }}
        >
          {/* GRATIS badge */}
          <div className="absolute -top-3 right-4 bg-[#FFC91B] text-[var(--color-brawl-dark)] font-['Lilita_One'] text-xs px-3 py-1 rounded-full z-10 shadow-[0_2px_0_rgba(0,0,0,0.3)]">
            {t('trialBannerProBadge')}
          </div>

          <h3
            className="font-['Lilita_One'] text-xl text-[#FFC91B] tracking-wide mb-4"
            style={{ textShadow: '0 2px 0 rgba(0,0,0,0.4)' }}
          >
            {t('trialBannerProTitle')}
          </h3>

          <ul className="space-y-3">
            {PRO_BULLETS.map((b) => (
              <li
                key={b.key}
                className="flex items-center gap-3 font-['Lilita_One'] text-sm text-white"
                style={{ textShadow: '0 2px 0 rgba(0,0,0,0.3)' }}
              >
                <BrawlImg
                  src={getBrawlerPortraitUrl(b.brawlerId)}
                  fallbackSrc={getBrawlerPortraitFallback(b.brawlerId)}
                  alt=""
                  className="w-8 h-8 rounded-lg border-2 border-[#FFC91B]/60 shrink-0 shadow-[0_2px_0_rgba(0,0,0,0.3)]"
                />
                {t(b.key)}
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <button
              onClick={() => setAuthOpen(true)}
              className="brawl-button w-full px-6 py-3 text-base"
            >
              {t('trialBannerCta')}
            </button>
          </div>
        </div>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
