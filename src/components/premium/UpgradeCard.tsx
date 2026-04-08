'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { AuthModal } from '@/components/auth/AuthModal'
import { Crown, Shield, Check } from 'lucide-react'

function HookCarousel() {
  const t = useTranslations('premium')
  const [index, setIndex] = useState(0)
  const [fade, setFade] = useState(true)

  // Read hooks array from translations
  const hooks: string[] = t.raw('hooks') as string[] ?? []
  const subs: string[] = t.raw('hookSubs') as string[] ?? []
  const count = hooks.length

  const advance = useCallback(() => {
    setFade(false)
    setTimeout(() => {
      setIndex(i => (i + 1) % count)
      setFade(true)
    }, 300)
  }, [count])

  useEffect(() => {
    if (count <= 1) return
    const interval = setInterval(advance, 8000)
    return () => clearInterval(interval)
  }, [count, advance])

  if (count === 0) return null

  return (
    <div className="mx-6 md:mx-8 mt-4">
      <div
        className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#1C5CF1] to-[#B23DFF] p-4 cursor-pointer select-none"
        onClick={advance}
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(black_2px,transparent_2px)] [background-size:12px_12px]" />
        <div className={`transition-opacity duration-300 ${fade ? 'opacity-100' : 'opacity-0'}`}>
          <p className="font-['Lilita_One'] text-sm md:text-base text-white text-stroke-brawl leading-snug relative z-10">
            {hooks[index]}
          </p>
          {subs[index] && (
            <p className="font-['Inter'] text-[11px] text-white/80 mt-2 relative z-10 font-bold italic">
              {subs[index]}
            </p>
          )}
        </div>
        {/* Dots indicator */}
        {count > 1 && (
          <div className="flex justify-center gap-1.5 mt-3 relative z-10">
            {hooks.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === index ? 'bg-white scale-125' : 'bg-white/30'}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface UpgradeCardProps {
  redirectTo?: string
}

const FEATURES = [
  'modalFeature1', 'modalFeature2', 'modalFeature3',
  'modalFeature4', 'modalFeature5', 'modalFeature6',
] as const

export function UpgradeCard({ redirectTo }: UpgradeCardProps) {
  const { user } = useAuth()
  const t = useTranslations('premium')
  const locale = useLocale()
  const [loading, setLoading] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const handleUpgrade = async (interval: 'monthly' | 'quarterly' | 'yearly') => {
    if (!user) {
      setAuthModalOpen(true)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/checkout/paypal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval, locale }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { /* ignore */ }
    setLoading(false)
  }

  return (
    <>
      <div className="brawl-card-dark overflow-hidden border-[#FFC91B]/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FFC91B]/15 via-[#FFC91B]/5 to-transparent p-6 md:p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-[#FFC91B]/20 border-2 border-[#FFC91B]/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,201,27,0.15)]">
              <Crown className="w-6 h-6 text-[#FFC91B]" />
            </div>
            <div>
              <h3 className="font-['Lilita_One'] text-2xl text-white">{t('modalTitle')}</h3>
              <p className="text-sm text-[#FFC91B]/80">{t('modalSubtitle')}</p>
            </div>
          </div>
        </div>

        {/* Hook carousel */}
        <HookCarousel />

        {/* Features */}
        <div className="px-6 md:px-8 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {FEATURES.map(key => (
              <div key={key} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[#FFC91B]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-[#FFC91B]" />
                </div>
                <span className="text-sm text-slate-300 leading-snug">{t(key)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3 pricing tiers */}
        <div className="px-6 md:px-8 pb-6 md:pb-8 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Monthly */}
            <button
              onClick={() => handleUpgrade('monthly')}
              disabled={loading}
              className="cursor-pointer py-5 px-3 text-center font-['Lilita_One'] bg-white/[0.06] text-white rounded-xl border-2 border-white/10 shadow-[0_3px_0_0_rgba(255,255,255,0.05)] hover:border-[#FFC91B]/40 hover:bg-white/[0.12] hover:-translate-y-1 hover:shadow-[0_6px_12px_rgba(255,201,27,0.1)] active:translate-y-0 active:shadow-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <span className="block text-2xl leading-tight group-hover:scale-110 transition-transform">{t('planMonthly')}</span>
              <span className="block text-[10px] text-slate-500 font-normal mt-1">{t('planMonthlyPeriod')}</span>
            </button>

            {/* Quarterly */}
            <button
              onClick={() => handleUpgrade('quarterly')}
              disabled={loading}
              className="cursor-pointer relative py-5 px-3 text-center font-['Lilita_One'] bg-[#4EC0FA]/[0.08] text-white rounded-xl border-2 border-[#4EC0FA]/30 shadow-[0_3px_0_0_rgba(78,192,250,0.15)] hover:border-[#4EC0FA]/60 hover:bg-[#4EC0FA]/[0.15] hover:-translate-y-1 hover:shadow-[0_6px_12px_rgba(78,192,250,0.15)] active:translate-y-0 active:shadow-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold font-['Lilita_One'] bg-[#4EC0FA] text-white px-3 py-0.5 rounded-full whitespace-nowrap shadow-[0_2px_6px_rgba(78,192,250,0.4)] border-2 border-[#4EC0FA]/60">{t('saveQuarterly')}</span>
              <span className="block text-2xl leading-tight group-hover:scale-110 transition-transform">{t('planQuarterly')}</span>
              <span className="block text-[10px] text-slate-500 font-normal mt-1">{t('planQuarterlyPeriod')}</span>
            </button>

            {/* Yearly — best value — brawl-button style with lift+glow */}
            <div className="relative group">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20 text-[11px] font-bold font-['Lilita_One'] bg-green-500 text-white px-3.5 py-1 rounded-full whitespace-nowrap shadow-[0_3px_8px_rgba(34,197,94,0.5)] animate-pulse border-2 border-green-400">{t('saveYearly')}</span>
              <button
                onClick={() => handleUpgrade('yearly')}
                disabled={loading}
                className="brawl-button cursor-pointer w-full py-5 px-3 text-center font-['Lilita_One'] text-[#121A2F] !rounded-xl group-hover:-translate-y-1 group-hover:!shadow-[0_10px_0_0_var(--color-brawl-dark),inset_0px_-4px_0px_rgba(180,83,9,0.5),inset_0px_2px_0px_rgba(255,255,255,0.6),0_12px_24px_rgba(255,201,27,0.35)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="block text-2xl leading-tight group-hover:scale-110 transition-transform">{t('planYearly')}</span>
                <span className="block text-[10px] text-[#121A2F]/60 font-normal mt-1">{t('planYearlyPeriod')}</span>
              </button>
            </div>
          </div>

          {/* Trust signals */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-[10px] text-slate-500">{t('modalGuarantee')}</p>
            <p className="text-[10px] text-slate-600 flex items-center gap-1">
              <Shield className="w-3 h-3" /> {t('modalSecure')}
            </p>
          </div>
          <p className="text-[10px] text-slate-600 text-center">{t('ageNotice')}</p>
        </div>
      </div>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} redirectTo={redirectTo} />
    </>
  )
}
