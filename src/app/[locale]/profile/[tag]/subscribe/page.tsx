'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { useBattlelog } from '@/hooks/useBattlelog'
import { isPremium } from '@/lib/premium'
import { parseBattlelog } from '@/lib/battle-parser'
import { detectSegment } from '@/lib/analytics/detect-segment'
import type { Profile } from '@/lib/supabase/types'
import { FlaskConical, LogIn } from 'lucide-react'
import { AnalyticsSkeleton } from '@/components/ui/Skeleton'

import { UpgradeCard } from '@/components/premium/UpgradeCard'
import { ReferralCard } from '@/components/premium/ReferralCard'
import { TrialBanner } from '@/components/premium/TrialBanner'
import { PersonalizedHook } from '@/components/premium/PersonalizedHook'
import { FeatureShowcase } from '@/components/premium/FeatureShowcase'
import { AuthModal } from '@/components/auth/AuthModal'

export default function SubscribePage() {
  const params = useParams<{ tag: string; locale: string }>()
  const tag = decodeURIComponent(params.tag)
  const router = useRouter()
  const t = useTranslations('subscribe')
  const ta = useTranslations('advancedAnalytics')
  const { user, profile, loading: authLoading } = useAuth()
  const hasPremium = isPremium(profile as Profile | null)
  const isLoggedIn = !!user
  const { data: freeStats, isLoading: freeLoading } = useBattlelog(tag)
  const [authOpen, setAuthOpen] = useState(false)
  const [trophies, setTrophies] = useState(0)

  // Redirect premium users to analytics
  useEffect(() => {
    if (!authLoading && hasPremium) {
      router.replace(`/${params.locale}/profile/${params.tag}/analytics`)
    }
  }, [authLoading, hasPremium, router, params.locale, params.tag])

  // Fetch player trophies for segment detection (competitive check).
  // Uses the lightweight `/api/player/tag-summary` — the old path called
  // `/api/calculate` (3 Supercell calls + gem-value compute) just to read
  // the `trophies` number, which is wasted work on the subscribe page.
  useEffect(() => {
    fetch('/api/player/tag-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerTag: tag }),
    })
      .then(r => {
        if (!r.ok) throw new Error(`API error: ${r.status}`)
        return r.json()
      })
      .then(d => setTrophies(d.trophies ?? 0))
      .catch(() => { /* trophies default to 0 — competitive segment won't trigger */ })
  }, [tag])

  // Detect player segment for PersonalizedHook
  const playerSegment = useMemo(() => {
    if (!freeStats?.battles || freeStats.battles.length === 0) return 'tilt' as const
    const parsed = parseBattlelog(freeStats.battles, tag)
    return detectSegment(parsed, trophies)
  }, [freeStats, tag, trophies])

  if (authLoading || freeLoading) return <AnalyticsSkeleton />
  if (hasPremium) return <AnalyticsSkeleton />

  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      {/* Expired trial banner */}
      <TrialBanner />

      {/* Header */}
      <div className="brawl-card p-6 md:p-8 bg-gradient-to-r from-[#FFC91B] to-[#121A2F]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#121A2F] border-4 border-[#FFC91B] rounded-2xl flex items-center justify-center transform rotate-3 shadow-[0_4px_0_0_#121A2F]">
            <FlaskConical className="w-8 h-8 text-[#FFC91B]" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-1deg]">{t('title')}</h1>
            <p className="font-['Inter'] font-semibold text-[#FFC91B]">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Free preview stats — computed from 25 public battles */}
      {freeStats && (
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
          <h3 className="font-['Lilita_One'] text-lg text-white mb-4">{ta('freePreviewTitle') || 'Quick Stats (Last 25 Battles)'}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="brawl-row rounded-xl p-4 text-center">
              <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">Win Rate</p>
              <p className={`font-['Lilita_One'] text-2xl tabular-nums ${freeStats.winRate >= 60 ? 'text-green-400' : freeStats.winRate >= 45 ? 'text-[#FFC91B]' : 'text-red-400'}`}>{freeStats.winRate.toFixed(1)}%</p>
            </div>
            <div className="brawl-row rounded-xl p-4 text-center">
              <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">Record</p>
              <p className="font-['Lilita_One'] text-2xl tabular-nums text-white">{freeStats.recentWins}W {freeStats.recentLosses}L</p>
            </div>
            <div className="brawl-row rounded-xl p-4 text-center">
              <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">{ta('freePreviewFavorite') || 'Favorite'}</p>
              <p className="font-['Lilita_One'] text-2xl tabular-nums text-[#4EC0FA] truncate">{freeStats.mostPlayedBrawler}</p>
            </div>
            <div className="brawl-row rounded-xl p-4 text-center">
              <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">{ta('trophyChange')}</p>
              <p className={`font-['Lilita_One'] text-2xl tabular-nums ${freeStats.trophyChange > 0 ? 'text-green-400' : freeStats.trophyChange < 0 ? 'text-red-400' : 'text-slate-500'}`}>{freeStats.trophyChange > 0 ? '+' : ''}{freeStats.trophyChange}</p>
            </div>
          </div>
        </div>
      )}

      {/* Personalized hook — computed from 25 public battles */}
      {freeStats && (
        <PersonalizedHook
          segment={playerSegment}
          freeStats={freeStats}
          trophies={trophies}
        />
      )}

      {/* Feature showcase — static screenshots */}
      <FeatureShowcase />

      {/* Pricing + checkout */}
      <div id="upgrade-section">
        <UpgradeCard redirectTo={`/${params.locale}/profile/${params.tag}/analytics`} />
        <ReferralCard />
      </div>

      {/* Auth prompt for non-logged-in users */}
      {!isLoggedIn && (
        <>
          <div className="brawl-card-dark p-5 text-center border-[#090E17]">
            <p className="text-sm text-slate-400 mb-3">{t('trialCtaBody')}</p>
            <button onClick={() => setAuthOpen(true)} className="brawl-button px-5 py-2.5 text-sm">
              <span className="flex items-center gap-2"><LogIn className="w-4 h-4" /> {t('trialCta')}</span>
            </button>
          </div>
          <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} redirectTo={`/${params.locale}/profile/${params.tag}/subscribe`} />
        </>
      )}
    </div>
  )
}
