'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { aggregateAnalytics, type Analytics } from '@/hooks/useAnalytics'
import { WinRateByMode } from '@/components/analytics/WinRateByMode'
import { WinRateByBrawler } from '@/components/analytics/WinRateByBrawler'
import { BestTeammates } from '@/components/analytics/BestTeammates'
import { UpgradeCard } from '@/components/premium/UpgradeCard'
import { ManageSubscription } from '@/components/premium/ManageSubscription'
import { isPremium } from '@/lib/auth'
import type { Battle, Profile } from '@/lib/supabase/types'
import { FlaskConical } from 'lucide-react'

export default function AnalyticsPage() {
  const params = useParams<{ tag: string; locale: string }>()
  const t = useTranslations('analytics')
  const { profile, loading: authLoading } = useAuth()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(false)

  const hasPremium = isPremium(profile as Profile | null)

  // Fetch analytics via server-side aggregation
  useEffect(() => {
    if (!hasPremium || loading || analytics) return
    setLoading(true)
    fetch('/api/battles?aggregate=true')
      .then(r => r.json())
      .then(data => {
        setAnalytics(aggregateAnalytics(data.analytics as Battle[]))
      })
      .finally(() => setLoading(false))
  }, [hasPremium, loading, analytics])

  // Not premium: show upgrade card
  if (!authLoading && !hasPremium) {
    return (
      <div className="animate-fade-in w-full pb-10 space-y-6">
        <div className="brawl-card p-6 md:p-8 bg-gradient-to-r from-[#FFC91B] to-[#121A2F]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#121A2F] border-4 border-[#FFC91B] rounded-2xl flex items-center justify-center transform rotate-3 shadow-[0_4px_0_0_#121A2F]">
              <FlaskConical className="w-8 h-8 text-[#FFC91B]" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-1deg]">
                {t('title')}
              </h1>
              <p className="font-['Inter'] font-semibold text-[#FFC91B]">{t('premiumOnly')}</p>
            </div>
          </div>
        </div>
        <UpgradeCard redirectTo={`/${params.locale}/profile/${params.tag}/analytics`} />
      </div>
    )
  }

  if (authLoading || loading || !analytics) {
    return <div className="animate-pulse py-20 text-center"><p className="text-slate-400 font-['Lilita_One'] text-2xl">{t('loading')}</p></div>
  }

  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      <div className="brawl-card p-6 md:p-8 bg-gradient-to-r from-[#FFC91B] to-[#121A2F]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#121A2F] border-4 border-[#FFC91B] rounded-2xl flex items-center justify-center transform rotate-3 shadow-[0_4px_0_0_#121A2F]">
            <FlaskConical className="w-8 h-8 text-[#FFC91B]" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-1deg]">
              {t('title')}
            </h1>
            <p className="font-['Inter'] font-semibold text-[#FFC91B]">
              {t('totalBattles', { count: String(analytics.totalBattles) })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="brawl-card p-4 text-center">
          <p className="font-['Lilita_One'] text-3xl text-green-500">{analytics.overallWinRate}%</p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('winRate')}</p>
        </div>
        <div className="brawl-card p-4 text-center">
          <p className={`font-['Lilita_One'] text-2xl ${analytics.trophyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {analytics.trophyChange >= 0 ? '+' : ''}{analytics.trophyChange}
          </p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('trophies')}</p>
        </div>
        <div className="brawl-card p-4 text-center">
          <p className="font-['Lilita_One'] text-2xl text-[#FFC91B]">{analytics.starPlayerCount}</p>
          <p className="text-[10px] uppercase font-bold text-slate-500">Star Player</p>
        </div>
        <div className="brawl-card p-4 text-center">
          <p className="font-['Lilita_One'] text-2xl text-white">{analytics.totalBattles}</p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('battles')}</p>
        </div>
      </div>

      <ManageSubscription />
      <WinRateByMode data={analytics.byMode} />
      <WinRateByBrawler data={analytics.byBrawler} />
      <BestTeammates data={analytics.bestTeammates} />
    </div>
  )
}
