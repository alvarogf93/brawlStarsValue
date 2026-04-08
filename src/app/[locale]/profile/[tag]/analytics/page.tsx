'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { useAdvancedAnalytics } from '@/hooks/useAdvancedAnalytics'
import { useBattlelog } from '@/hooks/useBattlelog'
import { isPremium } from '@/lib/premium'
import { computePlayNowRecommendations } from '@/lib/analytics/recommendations'
import type { Profile } from '@/lib/supabase/types'
import type { PlayNowRecommendation } from '@/lib/analytics/types'
import { FlaskConical, LogIn } from 'lucide-react'
import { AnalyticsSkeleton } from '@/components/ui/Skeleton'

// Components
import { UpgradeCard } from '@/components/premium/UpgradeCard'
import { PremiumGate } from '@/components/premium/PremiumGate'
import { TrialBanner } from '@/components/premium/TrialBanner'
import { ReferralCard } from '@/components/premium/ReferralCard'
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
import { DraftSimulator } from '@/components/draft/DraftSimulator'
import { ClutchCard } from '@/components/analytics/ClutchCard'
import { WarmUpCard } from '@/components/analytics/WarmUpCard'
import { PowerLevelChart } from '@/components/analytics/PowerLevelChart'
import { BrawlerComfortList } from '@/components/analytics/BrawlerComfortList'
import { WeeklyPatternChart } from '@/components/analytics/WeeklyPatternChart'
import { OpponentStrengthCard } from '@/components/analytics/OpponentStrengthCard'
import { CarryCard } from '@/components/analytics/CarryCard'
import { SessionEfficiencyCard } from '@/components/analytics/SessionEfficiencyCard'
import { RecoveryCard } from '@/components/analytics/RecoveryCard'
import { GadgetImpactCard } from '@/components/analytics/GadgetImpactCard'

const TAB_IDS = ['overview', 'performance', 'matchups', 'team', 'trends', 'draft'] as const
type TabId = (typeof TAB_IDS)[number]
const TAB_ICONS: Record<TabId, string> = {
  overview: '📊', performance: '', matchups: '⚔️', team: '', trends: '📈', draft: '',
}
const TAB_KEYS: Record<TabId, string> = {
  overview: 'tabOverview', performance: 'tabPerformance', matchups: 'tabMatchups',
  team: 'tabTeam', trends: 'tabTrends', draft: 'tabDraft',
}
const TAB_IMAGE_ICONS: Partial<Record<TabId, string>> = {
  overview: '/assets/modes/record-3.png',
  performance: '/assets/modes/record-12.png',
  matchups: '/assets/modes/record-6.png',
  team: '/assets/modes/48000058.png',
  trends: '/assets/modes/record-8.png',
  draft: '/assets/modes/48000028.png',
}

export default function AnalyticsPage() {
  const params = useParams<{ tag: string; locale: string }>()
  const t = useTranslations('analytics')
  const ta = useTranslations('advancedAnalytics')
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const hasPremium = isPremium(profile as Profile | null)
  const isLoggedIn = !!user
  // Only fetch analytics after auth resolves AND user is premium
  const tag = decodeURIComponent(params.tag)

  // SECURITY: Premium user viewing a different tag → redirect to own tag
  // Analytics are always for the authenticated user, so URL must match
  useEffect(() => {
    if (authLoading || !hasPremium || !profile?.player_tag) return
    const ownTag = profile.player_tag.toUpperCase().replace('#', '')
    const urlTag = tag.toUpperCase().replace('#', '')
    if (ownTag !== urlTag) {
      router.replace(`/${params.locale}/profile/${encodeURIComponent(profile.player_tag)}/analytics`)
    }
  }, [authLoading, hasPremium, profile, tag, params.locale, router])
  const { data: analytics, loading, error } = useAdvancedAnalytics(!authLoading && hasPremium)
  const { data: freeStats, isLoading: freeLoading } = useBattlelog(tag)
  const [tagHasPremium, setTagHasPremium] = useState<boolean | null>(null)
  const [activeTab, setActiveTabState] = useState<TabId>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '') as TabId
      if (TAB_IDS.includes(hash as typeof TAB_IDS[number])) return hash
    }
    return 'overview'
  })
  const setActiveTab = (tab: TabId) => {
    setActiveTabState(tab)
    window.location.hash = tab
  }
  const [playNow, setPlayNow] = useState<PlayNowRecommendation[]>([])
  const [authOpen, setAuthOpen] = useState(false)

  // Check if this player tag has a premium account (for non-logged-in users)
  useEffect(() => {
    if (authLoading || hasPremium) return
    const controller = new AbortController()
    fetch(`/api/profile/check-premium?tag=${encodeURIComponent(tag)}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => setTagHasPremium(data.hasPremium === true))
      .catch(err => { if (err.name !== 'AbortError') setTagHasPremium(false) })
    return () => controller.abort()
  }, [tag, authLoading, hasPremium])

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

  // Case: Tag has premium account but user isn't logged in → prompt sign in
  if (!authLoading && !hasPremium && tagHasPremium === null) {
    return <AnalyticsSkeleton />
  }

  if (!authLoading && !hasPremium && tagHasPremium && !isLoggedIn) {
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
          <p className="font-['Lilita_One'] text-lg text-[var(--color-brawl-dark)] mb-4">{ta('loginRequired')}</p>
          <button onClick={() => setAuthOpen(true)} className="brawl-button px-6 py-3 text-base">
            <span className="flex items-center gap-2"><LogIn className="w-5 h-5" /> {ta('loginButton')}</span>
          </button>
        </div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} redirectTo={`/${params.locale}/profile/${params.tag}/analytics`} />
      </div>
    )
  }

  // For non-premium: show UpgradeCard above tabs (the freemium view)
  const showUpgrade = !authLoading && !hasPremium

  if (authLoading || loading) {
    return <AnalyticsSkeleton />
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

      {/* Trial banner */}
      <TrialBanner />

      {/* Upgrade section for non-premium users */}
      {showUpgrade && (
        <>
          {/* Free analytics preview */}
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

          <div id="upgrade-section">
            <UpgradeCard redirectTo={`/${params.locale}/profile/${params.tag}/analytics`} />
            <ReferralCard />
          </div>

          {!isLoggedIn && (
            <>
              <div className="brawl-card-dark p-5 text-center border-[#090E17]">
                <p className="text-sm text-slate-400 mb-3">{ta('loginRequired')}</p>
                <button onClick={() => setAuthOpen(true)} className="brawl-button px-5 py-2.5 text-sm">
                  <span className="flex items-center gap-2"><LogIn className="w-4 h-4" /> {ta('loginButton')}</span>
                </button>
              </div>
              <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} redirectTo={`/${params.locale}/profile/${params.tag}/analytics`} />
            </>
          )}
        </>
      )}

      {/* Tab Navigation — always visible */}
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
            {TAB_IMAGE_ICONS[id] ? (
              <img src={TAB_IMAGE_ICONS[id]} alt="" className="w-5 h-5" width={20} height={20} />
            ) : (
              <span>{TAB_ICONS[id]}</span>
            )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ClutchCard data={analytics.clutch} />
            <WarmUpCard data={analytics.warmUp} />
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <PremiumGate blur>
          <div className="space-y-6">
            <BrawlerMapHeatmap data={analytics?.brawlerMapMatrix ?? []} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TimeOfDayChart data={analytics?.byHour ?? []} />
              <WeeklyPatternChart data={analytics?.weeklyPattern ?? []} />
            </div>
            <PowerLevelChart data={analytics?.powerLevelImpact ?? []} />
            <GadgetImpactCard data={analytics?.gadgetImpact ?? { withGadget: { winRate: 0, total: 0 }, withoutGadget: { winRate: 0, total: 0 }, withStarPower: { winRate: 0, total: 0 }, withoutStarPower: { winRate: 0, total: 0 } }} />
            <BrawlerComfortList data={analytics?.brawlerComfort ?? []} />
          </div>
        </PremiumGate>
      )}

      {activeTab === 'matchups' && (
        <PremiumGate blur>
          <div className="space-y-6">
            <MatchupMatrix data={analytics?.matchups ?? []} />
            <OpponentStrengthCard data={analytics?.opponentStrength ?? []} />
          </div>
        </PremiumGate>
      )}

      {activeTab === 'team' && (
        <PremiumGate blur>
          <div className="space-y-6">
            <TeamSynergyView
              brawlerSynergy={analytics?.brawlerSynergy ?? []}
              teammateSynergy={analytics?.teammateSynergy ?? []}
            />
            <CarryCard data={analytics?.carry ?? { carryWR: null, normalWR: null, carryGames: 0, normalGames: 0 }} />
          </div>
        </PremiumGate>
      )}

      {activeTab === 'trends' && (
        <PremiumGate blur>
          <div className="space-y-6">
            <TrendsChart dailyTrend={analytics?.dailyTrend ?? []} />
            <MasteryChart data={analytics?.brawlerMastery ?? []} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SessionEfficiencyCard data={analytics?.sessionEfficiency ?? []} />
              <RecoveryCard data={analytics?.recovery ?? { recoveryEpisodes: 0, avgGamesToRecover: null, recoveryRate: null }} />
            </div>
          </div>
        </PremiumGate>
      )}

      {activeTab === 'draft' && (
        <div className="space-y-6">
          <DraftSimulator />
        </div>
      )}
    </div>
  )
}
