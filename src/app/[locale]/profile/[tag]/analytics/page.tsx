'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { useAdvancedAnalytics } from '@/hooks/useAdvancedAnalytics'
import { useBattlelog } from '@/hooks/useBattlelog'
import { isPremium } from '@/lib/premium'
import { computePlayNowRecommendations } from '@/lib/analytics/recommendations'
import type { Profile } from '@/lib/supabase/types'
import type { PlayNowRecommendation } from '@/lib/analytics/types'
import { FlaskConical, LogIn } from 'lucide-react'

// Components
import { UpgradeCard } from '@/components/premium/UpgradeCard'
import { AuthModal } from '@/components/auth/AuthModal'
import { OverviewStats } from '@/components/analytics/OverviewStats'
import { BrawlerMapHeatmap } from '@/components/analytics/BrawlerMapHeatmap'
import { MatchupMatrix } from '@/components/analytics/MatchupMatrix'
import { TeamSynergyView } from '@/components/analytics/TeamSynergyView'
import { TrendsChart } from '@/components/analytics/TrendsChart'
import { TimeOfDayChart } from '@/components/analytics/TimeOfDayChart'
import { TiltDetector } from '@/components/analytics/TiltDetector'
import { MasteryChart } from '@/components/analytics/MasteryChart'
import { PlayNowDashboard } from '@/components/analytics/PlayNowDashboard'
import { CounterPickAdvisor } from '@/components/analytics/CounterPickAdvisor'

const TAB_IDS = ['overview', 'performance', 'matchups', 'team', 'trends', 'tools'] as const
type TabId = (typeof TAB_IDS)[number]
const TAB_ICONS: Record<TabId, string> = {
  overview: '📊', performance: '🗺️', matchups: '⚔️', team: '🤝', trends: '📈', tools: '🛡️',
}
const TAB_KEYS: Record<TabId, string> = {
  overview: 'tabOverview', performance: 'tabPerformance', matchups: 'tabMatchups',
  team: 'tabTeam', trends: 'tabTrends', tools: 'tabTools',
}

export default function AnalyticsPage() {
  const params = useParams<{ tag: string; locale: string }>()
  const t = useTranslations('analytics')
  const ta = useTranslations('advancedAnalytics')
  const { profile, loading: authLoading } = useAuth()
  const hasPremium = isPremium(profile as Profile | null)
  const isLoggedIn = !!profile
  // Only fetch analytics after auth resolves AND user is premium
  const tag = decodeURIComponent(params.tag)
  const { data: analytics, loading, error } = useAdvancedAnalytics(!authLoading && hasPremium)
  const { data: freeStats, isLoading: freeLoading } = useBattlelog(tag)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [playNow, setPlayNow] = useState<PlayNowRecommendation[]>([])
  const [authOpen, setAuthOpen] = useState(false)

  // Fetch current events for "Play Now"
  useEffect(() => {
    if (!analytics) return
    fetch('/api/events')
      .then(r => r.json())
      .then(events => {
        const recs = computePlayNowRecommendations(
          analytics.brawlerMapMatrix,
          analytics.brawlerSynergy,
          events,
        )
        setPlayNow(recs)
      })
      .catch(err => console.warn('Failed to fetch events for Play Now:', err))
  }, [analytics])

  // Not logged in: prompt to sign in with Google
  if (!authLoading && !isLoggedIn) {
    return (
      <div className="animate-fade-in w-full pb-10 space-y-6">
        <div className="brawl-card p-6 md:p-8 bg-gradient-to-r from-[var(--color-brawl-sky)] to-[#121A2F]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#121A2F] border-4 border-[var(--color-brawl-sky)] rounded-2xl flex items-center justify-center transform rotate-3 shadow-[0_4px_0_0_#121A2F]">
              <LogIn className="w-8 h-8 text-[var(--color-brawl-sky)]" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-1deg]">
                {t('title')}
              </h1>
              <p className="font-['Inter'] font-semibold text-[var(--color-brawl-sky)]">{t('premiumOnly')}</p>
            </div>
          </div>
        </div>
        <div className="brawl-card p-6 text-center">
          <p className="font-['Lilita_One'] text-lg text-[var(--color-brawl-dark)] mb-4">
            {ta('loginRequired') || 'Sign in with Google to access your analytics'}
          </p>
          <button
            onClick={() => setAuthOpen(true)}
            className="brawl-button px-6 py-3 text-base"
          >
            <span className="flex items-center gap-2">
              <LogIn className="w-5 h-5" />
              {ta('loginButton') || 'Sign in with Google'}
            </span>
          </button>
        </div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} redirectTo={`/${params.locale}/profile/${params.tag}/analytics`} />
      </div>
    )
  }

  // Logged in but not premium: show free preview + upgrade card
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

        {/* Free analytics preview from public battlelog */}
        {!freeLoading && freeStats && (
          <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
            <h3 className="font-['Lilita_One'] text-lg text-white mb-4">{ta('freePreviewTitle') || 'Quick Stats (Last 25 Battles)'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="brawl-row rounded-xl p-4 text-center">
                <p className={`font-['Lilita_One'] text-2xl tabular-nums ${freeStats.winRate >= 60 ? 'text-green-400' : freeStats.winRate >= 45 ? 'text-[#FFC91B]' : 'text-red-400'}`}>
                  {freeStats.winRate.toFixed(1)}%
                </p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{ta('winRateLabel')}</p>
              </div>
              <div className="brawl-row rounded-xl p-4 text-center">
                <p className="font-['Lilita_One'] text-2xl tabular-nums text-white">
                  {freeStats.recentWins}W {freeStats.recentLosses}L
                </p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{ta('record')}</p>
              </div>
              <div className="brawl-row rounded-xl p-4 text-center">
                <p className="font-['Lilita_One'] text-2xl tabular-nums text-[#4EC0FA] truncate">
                  {freeStats.mostPlayedBrawler}
                </p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{ta('freePreviewFavorite') || 'Favorite'}</p>
              </div>
              <div className="brawl-row rounded-xl p-4 text-center">
                <p className={`font-['Lilita_One'] text-2xl tabular-nums ${freeStats.trophyChange > 0 ? 'text-green-400' : freeStats.trophyChange < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {freeStats.trophyChange > 0 ? '+' : ''}{freeStats.trophyChange}
                </p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{ta('trophyChange')}</p>
              </div>
            </div>
          </div>
        )}

        <UpgradeCard redirectTo={`/${params.locale}/profile/${params.tag}/analytics`} />
      </div>
    )
  }

  if (authLoading || loading) {
    return <div className="animate-pulse py-20 text-center"><p className="text-slate-400 font-['Lilita_One'] text-2xl">{t('loading')}</p></div>
  }

  if (error || !analytics) {
    return <div className="glass p-8 rounded-2xl text-center border-red-500/30"><p className="text-red-400">{error || t('loading')}</p></div>
  }

  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      {/* Header */}
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
              {t('totalBattles', { count: String(analytics.overview.totalBattles) })}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {TAB_IDS.map(id => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-['Lilita_One'] text-sm whitespace-nowrap transition-all border-2 ${
              activeTab === id
                ? 'bg-[#FFC91B]/20 text-[#FFC91B] border-[#FFC91B]/40 shadow-[0_0_12px_rgba(255,201,27,0.15)]'
                : 'bg-[#0F172A] text-slate-400 border-[#1E293B] hover:bg-[#1E293B] hover:text-white'
            }`}
          >
            <span>{TAB_ICONS[id]}</span>
            <span>{ta(TAB_KEYS[id])}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <OverviewStats overview={analytics.overview} />
          {playNow.length > 0 && <PlayNowDashboard recommendations={playNow} />}
          <TiltDetector tilt={analytics.tilt} sessions={analytics.sessions} />
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-6">
          <BrawlerMapHeatmap data={analytics.brawlerMapMatrix} />
          <TimeOfDayChart data={analytics.byHour} />
        </div>
      )}

      {activeTab === 'matchups' && (
        <div className="space-y-6">
          <MatchupMatrix data={analytics.matchups} />
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-6">
          <TeamSynergyView
            brawlerSynergy={analytics.brawlerSynergy}
            teammateSynergy={analytics.teammateSynergy}
          />
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-6">
          <TrendsChart dailyTrend={analytics.dailyTrend} />
          <MasteryChart data={analytics.brawlerMastery} />
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="space-y-6">
          <CounterPickAdvisor />
        </div>
      )}
    </div>
  )
}
