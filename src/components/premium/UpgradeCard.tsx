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
          <div className="grid grid-cols-3 gap-2">
            {/* Monthly */}
            <button
              onClick={() => handleUpgrade('monthly')}
              disabled={loading}
              className="py-4 px-2 text-center font-['Lilita_One'] bg-white/[0.06] text-white rounded-xl border-2 border-white/10 hover:border-[#FFC91B]/30 hover:bg-white/[0.08] transition-all disabled:opacity-50"
            >
              <span className="block text-lg leading-tight">{t('planMonthly')}</span>
              <span className="block text-[10px] text-slate-500 font-normal mt-0.5">{t('planMonthlyPeriod')}</span>
            </button>

            {/* Quarterly */}
            <button
              onClick={() => handleUpgrade('quarterly')}
              disabled={loading}
              className="relative py-4 px-2 text-center font-['Lilita_One'] bg-white/[0.06] text-white rounded-xl border-2 border-[#4EC0FA]/30 hover:border-[#4EC0FA]/60 hover:bg-white/[0.08] transition-all disabled:opacity-50"
            >
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8px] font-bold bg-[#4EC0FA] text-white px-2 py-0.5 rounded-full whitespace-nowrap">{t('saveQuarterly')}</span>
              <span className="block text-lg leading-tight">{t('planQuarterly')}</span>
              <span className="block text-[10px] text-slate-500 font-normal mt-0.5">{t('planQuarterlyPeriod')}</span>
            </button>

            {/* Yearly — best value */}
            <button
              onClick={() => handleUpgrade('yearly')}
              disabled={loading}
              className="relative py-4 px-2 text-center font-['Lilita_One'] bg-[#FFC91B] text-[#121A2F] rounded-xl border-2 border-[#FFC91B] shadow-[0_3px_0_0_rgba(18,26,47,1)] hover:translate-y-[1px] hover:shadow-[0_2px_0_0_rgba(18,26,47,1)] transition-all disabled:opacity-50"
            >
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">{t('saveYearly')}</span>
              <span className="block text-lg leading-tight">{t('planYearly')}</span>
              <span className="block text-[10px] text-[#121A2F]/60 font-normal mt-0.5">{t('planYearlyPeriod')}</span>
            </button>
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
