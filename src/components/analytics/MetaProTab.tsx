'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useProAnalysis } from '@/hooks/useProAnalysis'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import type { Profile } from '@/lib/supabase/types'
import { PremiumGate } from '@/components/premium/PremiumGate'
import { UpgradeCard } from '@/components/premium/UpgradeCard'
import { MapSelector } from '@/components/analytics/MapSelector'
import { TopBrawlersGrid } from '@/components/analytics/TopBrawlersGrid'
import { TrendingSection } from '@/components/analytics/TrendingSection'
import { ProTrendChart } from '@/components/analytics/ProTrendChart'
import { ProTrioGrid } from '@/components/analytics/ProTrioGrid'
import { GapAnalysisCards } from '@/components/analytics/GapAnalysisCards'
import { MatchupGapTable } from '@/components/analytics/MatchupGapTable'

export function MetaProTab() {
  const t = useTranslations('metaPro')
  const { profile } = useAuth()
  const hasPremium = isPremium(profile as Profile | null)

  const [selectedMap, setSelectedMap] = useState<string | null>(null)
  const [selectedMode, setSelectedMode] = useState<string | null>(null)
  const [window, setWindow] = useState(14)

  const { data, isLoading: loading, error } = useProAnalysis(selectedMap, selectedMode, window)

  const handleMapSelect = (map: string, mode: string, _eventId: number) => {
    setSelectedMap(map)
    setSelectedMode(mode)
  }

  return (
    <div className="space-y-6">
      <MapSelector
        selectedMap={selectedMap}
        selectedMode={selectedMode}
        onSelect={handleMapSelect}
      />

      {selectedMap && (
        <div className="flex items-center gap-2">
          <span className="font-['Lilita_One'] text-xs text-slate-500">{t('windowLabel')}:</span>
          {[7, 14, 30, 90].map(w => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={`px-3 py-1 text-xs font-['Lilita_One'] rounded-lg transition-all border ${
                window === w
                  ? 'bg-[#FFC91B]/20 text-[#FFC91B] border-[#FFC91B]/40'
                  : 'bg-[#0F172A] text-slate-400 border-[#1E293B] hover:text-white'
              }`}
            >
              {t(`window${w}d` as 'window7d' | 'window14d' | 'window30d' | 'window90d')}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="brawl-card-dark p-8 border-[#090E17] text-center">
          <div className="w-8 h-8 border-2 border-[#FFC91B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">{t('mapSelectorTitle')}...</p>
        </div>
      )}

      {error && (
        <div className="brawl-card-dark p-5 border-red-500/30 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          <TopBrawlersGrid
            brawlers={data.topBrawlers}
            totalBattles={data.totalProBattles}
            source={data.topBrawlersSource}
            counters={data.counters}
          />
          <TrendingSection rising={data.trending.rising} falling={data.trending.falling} />

          <PremiumGate>
            <div className="space-y-6">
              {data.dailyTrend && data.dailyTrend.length > 0 && (
                <ProTrendChart dailyTrend={data.dailyTrend} topBrawlers={data.topBrawlers} />
              )}
              {data.proTrios && data.proTrios.length > 0 && selectedMap && (
                <ProTrioGrid trios={data.proTrios} mapName={selectedMap} />
              )}
              {data.personalGap && data.personalGap.length > 0 && (
                <GapAnalysisCards gaps={data.personalGap} />
              )}
              {data.matchupGaps && data.matchupGaps.length > 0 && (
                <MatchupGapTable gaps={data.matchupGaps} />
              )}
              {hasPremium && !data.personalGap && (
                <div className="brawl-card-dark p-5 border-[#090E17] text-center">
                  <p className="text-sm text-slate-500">{t('noGapData')}</p>
                </div>
              )}
              {!hasPremium && (
                <div className="brawl-card-dark p-5 border-[#090E17] text-center">
                  <p className="text-sm text-slate-500">{t('upgradeForGap')}</p>
                </div>
              )}
            </div>
          </PremiumGate>

          {!hasPremium && (
            <div id="upgrade-section">
              <UpgradeCard />
            </div>
          )}
        </>
      )}
    </div>
  )
}
