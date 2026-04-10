'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { useAdvancedAnalytics } from '@/hooks/useAdvancedAnalytics'
import { isPremium, isOnTrial } from '@/lib/premium'
import { computePlayNowRecommendations } from '@/lib/analytics/recommendations'
import type { Profile } from '@/lib/supabase/types'
import type { PlayNowRecommendation } from '@/lib/analytics/types'
import { FlaskConical, ChevronDown } from 'lucide-react'
import { AnalyticsSkeleton } from '@/components/ui/Skeleton'
import { useProAnalysis } from '@/hooks/useProAnalysis'
import { bayesianWinRate } from '@/lib/draft/scoring'

// Components
import { UpgradeCard } from '@/components/premium/UpgradeCard'
import { TrialBanner } from '@/components/premium/TrialBanner'
import { ReferralCard } from '@/components/premium/ReferralCard'
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
import { MetaProTab } from '@/components/analytics/MetaProTab'
import { ClutchCard } from '@/components/analytics/ClutchCard'
import { WarmUpCard } from '@/components/analytics/WarmUpCard'
import { ModePerformanceChart } from '@/components/analytics/ModePerformanceChart'
import { MapPerformanceList } from '@/components/analytics/MapPerformanceList'
import { BrawlerTierList } from '@/components/analytics/BrawlerTierList'
import { PowerLevelChart } from '@/components/analytics/PowerLevelChart'
import { BrawlerComfortList } from '@/components/analytics/BrawlerComfortList'
import { WeeklyPatternChart } from '@/components/analytics/WeeklyPatternChart'
import { OpponentStrengthCard } from '@/components/analytics/OpponentStrengthCard'
import { CarryCard } from '@/components/analytics/CarryCard'
import { SessionEfficiencyCard } from '@/components/analytics/SessionEfficiencyCard'
import { RecoveryCard } from '@/components/analytics/RecoveryCard'
import { GadgetImpactCard } from '@/components/analytics/GadgetImpactCard'
import { AuthModal } from '@/components/auth/AuthModal'

const TAB_IDS = ['overview', 'performance', 'matchups', 'team', 'trends', 'draft', 'metaPro'] as const
type TabId = (typeof TAB_IDS)[number]
const TAB_ICONS: Record<TabId, string> = {
  overview: '📊', performance: '', matchups: '⚔️', team: '', trends: '📈', draft: '', metaPro: '',
}
const TAB_KEYS: Record<TabId, string> = {
  overview: 'tabOverview', performance: 'tabPerformance', matchups: 'tabMatchups',
  team: 'tabTeam', trends: 'tabTrends', draft: 'tabDraft', metaPro: 'tabMetaPro',
}
const TAB_IMAGE_ICONS: Partial<Record<TabId, string>> = {
  overview: '/assets/modes/record-3.png',
  performance: '/assets/modes/record-12.png',
  matchups: '/assets/modes/record-6.png',
  team: '/assets/modes/48000058.png',
  trends: '/assets/modes/record-8.png',
  draft: '/assets/modes/48000028.png',
  metaPro: '/assets/modes/record-3.png',
}

function AnalyticsTrialPreview() {
  const t = useTranslations('analytics')
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <>
      <div className="animate-fade-in w-full pb-10 space-y-6 relative">
        {/* Fake analytics skeleton — gives visual preview */}
        <div className="blur-sm pointer-events-none select-none opacity-60">
          {/* Header card mimicking real analytics */}
          <div className="brawl-card p-6 md:p-8 bg-gradient-to-r from-[var(--color-brawl-blue)] to-[#121A2F]">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#FFC91B] border-4 border-[#121A2F] rounded-2xl flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <h1 className="text-3xl font-['Lilita_One'] text-white">Analytics</h1>
                <p className="text-[var(--color-brawl-gold)] text-sm font-['Lilita_One']">PRO</p>
              </div>
            </div>
          </div>

          {/* Fake stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['72.3%', '68/26', '+704', '33.0%'].map((val, i) => (
              <div key={i} className="brawl-card-dark p-5 text-center border-[#090E17]">
                <p className="text-xs text-slate-400 mb-1">Stat</p>
                <p className="font-['Lilita_One'] text-2xl text-white">{val}</p>
              </div>
            ))}
          </div>

          {/* Fake chart area */}
          <div className="brawl-card-dark p-6 border-[#090E17] h-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="brawl-card-dark p-6 border-[#090E17] h-32" />
            <div className="brawl-card-dark p-6 border-[#090E17] h-32" />
          </div>
        </div>

        {/* Overlay CTA */}
        <div className="absolute inset-0 flex items-center justify-center bg-[#121A2F]/40 backdrop-blur-[2px]">
          <div className="brawl-card p-8 max-w-md text-center">
            <span className="text-5xl mb-4 block">🔓</span>
            <h2 className="font-['Lilita_One'] text-2xl text-white mb-2">{t('trialPreviewTitle')}</h2>
            <p className="text-sm text-slate-400 mb-6">{t('trialPreviewDesc')}</p>
            <button onClick={() => setAuthOpen(true)} className="brawl-button px-8 py-3 text-lg w-full mb-3">
              {t('trialPreviewCta')}
            </button>
            <button onClick={() => setAuthOpen(true)} className="text-sm text-slate-400 hover:text-white transition-colors">
              {t('trialPreviewLogin')}
            </button>
          </div>
        </div>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}

export default function AnalyticsPage() {
  const params = useParams<{ tag: string; locale: string }>()
  const t = useTranslations('analytics')
  const ta = useTranslations('advancedAnalytics')
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const hasPremium = isPremium(profile as Profile | null)
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
  const { data: analytics, isLoading: loading, error } = useAdvancedAnalytics(!authLoading && hasPremium)
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
  const tp = useTranslations('premium')
  const [showCelebration, setShowCelebration] = useState(false)
  const [tabMenuOpen, setTabMenuOpen] = useState(false)
  const [liveMap, setLiveMap] = useState<{ map: string; mode: string } | null>(null)

  // PRO data for inline badges (fetched for the first live map)
  const { data: proData } = useProAnalysis(liveMap?.map ?? null, liveMap?.mode ?? null)

  // Derive PRO badge data from proData
  const proAvgWR = proData?.topBrawlers && proData.topBrawlers.length > 0
    ? proData.topBrawlers.reduce((sum, b) => sum + b.winRate, 0) / proData.topBrawlers.length
    : null

  const proBrawlerMapData = useMemo(() => {
    if (!proData?.topBrawlers || !liveMap) return null
    const map = new Map<string, { winRate: number; total: number }>()
    for (const b of proData.topBrawlers) {
      map.set(`${b.brawlerId}|${liveMap.map}`, { winRate: b.winRate, total: b.totalBattles })
    }
    return map
  }, [proData, liveMap])

  const proMatchupData = useMemo(() => {
    if (!proData?.counters) return null
    const map = new Map<string, { winRate: number; total: number }>()
    for (const c of proData.counters) {
      for (const m of c.bestCounters) {
        map.set(`${c.brawlerId}|${m.opponentId}`, { winRate: m.winRate, total: m.total })
      }
      for (const m of c.worstMatchups) {
        map.set(`${c.brawlerId}|${m.opponentId}`, { winRate: m.winRate, total: m.total })
      }
    }
    return map
  }, [proData])

  const proTrioData = useMemo(() => {
    if (!proData?.proTrios) return null
    const map = new Map<string, { winRate: number; total: number }>()
    for (const trio of proData.proTrios) {
      const key = trio.brawlers.map(b => b.id).sort((a, b) => a - b).join('|')
      map.set(key, { winRate: trio.winRate, total: trio.total })
    }
    return map
  }, [proData])

  // Fetch current events for "Play Now"
  useEffect(() => {
    if (!analytics) return
    fetch('/api/events')
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
      .then(events => {
        const recs = computePlayNowRecommendations(
          analytics.brawlerMapMatrix,
          analytics.trioSynergy,
          events,
        )
        setPlayNow(recs)
        // Capture first draft-mode map for PRO badge data
        if (!liveMap) {
          const DRAFT = ['gemGrab', 'heist', 'bounty', 'brawlBall', 'hotZone', 'knockout', 'wipeout', 'brawlHockey', 'basketBrawl']
          for (const e of events) {
            const ev = e.event ?? e
            const mode = ev.mode === 'unknown' && ev.modeId === 45 ? 'brawlHockey' : ev.mode
            if (ev.map && mode && DRAFT.includes(mode)) {
              setLiveMap({ map: ev.map, mode })
              break
            }
          }
        }
      })
      .catch(() => { /* Play Now is optional — silent fail */ })
  }, [analytics])

  // Trial celebration — show confetti once on first premium visit after trial activation
  useEffect(() => {
    if (!isOnTrial(profile as Profile)) return
    const key = 'brawlvalue:trial-celebrated'
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      setShowCelebration(true)
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#FFC91B', '#4EC0FA', '#FF5733', '#28A745'] })
      })
    } catch { /* ignore */ }
  }, [profile])

  // Show blur preview + trial CTA for non-premium users
  if (!authLoading && !hasPremium) {
    return <AnalyticsTrialPreview />
  }

  if (authLoading || loading) {
    return <AnalyticsSkeleton />
  }

  if (error || !analytics) {
    return <div className="glass p-8 rounded-2xl text-center border-red-500/30"><p className="text-red-400">{error || t('loading')}</p></div>
  }

  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCelebration(false)}>
          <div className="brawl-card p-8 max-w-sm text-center space-y-4" onClick={e => e.stopPropagation()}>
            <p className="text-5xl">🎉</p>
            <h2 className="font-['Lilita_One'] text-2xl text-[#FFC91B]">{tp('trialWelcome')}</h2>
            <p className="text-slate-300">{tp('trialWelcomeBody')}</p>
            <button onClick={() => setShowCelebration(false)} className="brawl-button px-6 py-2">OK</button>
          </div>
        </div>
      )}
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

      {/* Trial banner (shown for trial users) */}
      <TrialBanner />

      {/* Tab Navigation — dropdown on mobile, row on desktop */}
      {/* Mobile: dropdown selector */}
      <div className="md:hidden relative">
        <button
          onClick={() => setTabMenuOpen(!tabMenuOpen)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-['Lilita_One'] text-sm bg-[#FFC91B]/20 text-[#FFC91B] border-2 border-[#FFC91B]/40 shadow-[0_0_12px_rgba(255,201,27,0.15)]"
        >
          <span className="flex items-center gap-2">
            {TAB_IMAGE_ICONS[activeTab] ? (
              <img src={TAB_IMAGE_ICONS[activeTab]} alt="" className="w-5 h-5" width={20} height={20} />
            ) : (
              <span>{TAB_ICONS[activeTab]}</span>
            )}
            {ta(TAB_KEYS[activeTab])}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${tabMenuOpen ? 'rotate-180' : ''}`} />
        </button>
        {tabMenuOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-[#0F172A] border-2 border-[#1E293B] rounded-xl overflow-hidden shadow-xl">
            {TAB_IDS.filter(id => id !== activeTab).map(id => (
              <button
                key={id}
                onClick={() => { setActiveTab(id); setTabMenuOpen(false) }}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-['Lilita_One'] text-slate-300 hover:bg-white/5 hover:text-[#FFC91B] transition-colors border-b border-[#1E293B] last:border-b-0"
              >
                {TAB_IMAGE_ICONS[id] ? (
                  <img src={TAB_IMAGE_ICONS[id]} alt="" className="w-5 h-5" width={20} height={20} />
                ) : (
                  <span>{TAB_ICONS[id]}</span>
                )}
                {ta(TAB_KEYS[id])}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: horizontal tabs */}
      <div className="hidden md:flex gap-1.5 pb-1">
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
          <OverviewStats overview={analytics.overview} proAvgWR={proAvgWR} />
          {playNow.length > 0 && <PlayNowDashboard recommendations={playNow} />}
          <BrawlerTierList data={analytics.byBrawler} />
          <TiltDetector tilt={analytics.tilt} sessions={analytics.sessions} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ClutchCard data={analytics.clutch} />
            <WarmUpCard data={analytics.warmUp} />
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ModePerformanceChart data={analytics.byMode} />
            <MapPerformanceList data={analytics.byMap} />
          </div>
          <BrawlerMapHeatmap data={analytics.brawlerMapMatrix} proData={proBrawlerMapData} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TimeOfDayChart data={analytics.byHour} />
            <WeeklyPatternChart data={analytics.weeklyPattern} />
          </div>
          <PowerLevelChart data={analytics.powerLevelImpact} />
          <GadgetImpactCard data={analytics.gadgetImpact} />
          <BrawlerComfortList data={analytics.brawlerComfort} />
        </div>
      )}

      {activeTab === 'matchups' && (
        <div className="space-y-6">
          <MatchupMatrix data={analytics.matchups} proMatchups={proMatchupData} />
          <OpponentStrengthCard data={analytics.opponentStrength} />
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-6">
          <TeamSynergyView
            trioSynergy={analytics.trioSynergy}
            teammateSynergy={analytics.teammateSynergy}
            proTrios={proTrioData}
          />
          <CarryCard data={analytics.carry} />
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-6">
          <TrendsChart dailyTrend={analytics.dailyTrend} proAvgWR={proAvgWR} />
          <MasteryChart data={analytics.brawlerMastery} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SessionEfficiencyCard data={analytics.sessionEfficiency} />
            <RecoveryCard data={analytics.recovery} />
          </div>
        </div>
      )}

      {activeTab === 'draft' && (
        <div className="space-y-6">
          <DraftSimulator />
        </div>
      )}

      {activeTab === 'metaPro' && (
        <div className="space-y-6">
          <MetaProTab />
        </div>
      )}

      {/* Subscription section for trial users — always accessible */}
      {isOnTrial(profile as Profile) && (
        <div id="upgrade-section" className="mt-8 space-y-4">
          <UpgradeCard redirectTo={`/${params.locale}/profile/${params.tag}/analytics`} />
          <ReferralCard />
        </div>
      )}
    </div>
  )
}
