'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { AuthModal } from '@/components/auth/AuthModal'
import { Crown, Zap, BarChart3, Users } from 'lucide-react'

interface UpgradeCardProps {
  redirectTo?: string
}

export function UpgradeCard({ redirectTo }: UpgradeCardProps) {
  const { user } = useAuth()
  const t = useTranslations('premium')
  const [loading, setLoading] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const handleUpgrade = async (interval: 'monthly' | 'yearly') => {
    if (!user) {
      setAuthModalOpen(true)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="brawl-card-dark p-6 md:p-8 border-[#FFC91B]/20 bg-gradient-to-br from-[#FFC91B]/5 to-transparent">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-[#FFC91B]/20 border-2 border-[#FFC91B]/30 flex items-center justify-center">
            <Crown className="w-6 h-6 text-[#FFC91B]" />
          </div>
          <div>
            <h3 className="font-['Lilita_One'] text-xl text-white">{t('title')}</h3>
            <p className="text-xs text-slate-400">{t('subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Zap className="w-4 h-4 text-[#FFC91B]" />
            <span>{t('featureHistory')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <BarChart3 className="w-4 h-4 text-[#FFC91B]" />
            <span>{t('featureAnalytics')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Users className="w-4 h-4 text-[#FFC91B]" />
            <span>{t('featureTeammates')}</span>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 mb-4">{t('ageNotice')}</p>

        <div className="flex gap-3">
          <button
            onClick={() => handleUpgrade('monthly')}
            disabled={loading}
            className="flex-1 brawl-button py-3 text-center disabled:opacity-50"
          >
            {t('monthly')}
          </button>
          <button
            onClick={() => handleUpgrade('yearly')}
            disabled={loading}
            className="flex-1 py-3 text-center font-['Lilita_One'] text-sm bg-[#FFC91B] text-[var(--color-brawl-dark)] rounded-xl border-4 border-[var(--color-brawl-dark)] shadow-[0_3px_0_0_rgba(18,26,47,1)] hover:translate-y-[1px] hover:shadow-[0_2px_0_0_rgba(18,26,47,1)] transition-all disabled:opacity-50"
          >
            {t('yearly')}
          </button>
        </div>
      </div>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} redirectTo={redirectTo} />
    </>
  )
}
