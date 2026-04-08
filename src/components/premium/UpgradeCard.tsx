'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { AuthModal } from '@/components/auth/AuthModal'
import { Crown, Shield, Check } from 'lucide-react'

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
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8px] font-bold bg-[#4EC0FA] text-white px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-[0_2px_4px_rgba(78,192,250,0.3)]">{t('saveQuarterly')}</span>
              <span className="block text-2xl leading-tight group-hover:scale-110 transition-transform">{t('planQuarterly')}</span>
              <span className="block text-[10px] text-slate-500 font-normal mt-1">{t('planQuarterlyPeriod')}</span>
            </button>

            {/* Yearly — best value — brawl-button style with lift+glow */}
            <div className="relative group">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 text-[8px] font-bold font-['Lilita_One'] bg-green-500 text-white px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-[0_2px_4px_rgba(34,197,94,0.4)] animate-pulse">{t('saveYearly')}</span>
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
