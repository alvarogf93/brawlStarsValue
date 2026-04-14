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
    <div className="space-y-6 relative">
      {/* Global Meta Pro styling block (Imperial Gold & Dark Violet overlays) */}
      <style dangerouslySetInnerHTML={{__html: `
        .meta-pro-container .brawl-card-dark {
          background: rgba(22, 11, 38, 0.9);
          border-color: rgba(69, 30, 102, 0.4);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 201, 27, 0.1);
        }
        .meta-pro-container .text-[#4EC0FA] {
          color: #FFC91B !important; 
        }
      `}} />

      <div className="meta-pro-container space-y-6">
        <MapSelector
          selectedMap={selectedMap}
          selectedMode={selectedMode}
          onSelect={handleMapSelect}
        />

        {selectedMap && (
          <div className="flex items-center gap-2 bg-[#160B26] p-2 rounded-xl border border-[#FFC91B]/20 shadow-[0_0_15px_rgba(255,201,27,0.05)] w-fit">
            <span className="font-['Lilita_One'] text-xs text-[#FFC91B]/70 tracking-widest uppercase pl-2 pr-1">{t('windowLabel')}:</span>
            {[7, 14, 30, 90].map(w => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-3 py-1.5 text-xs font-['Lilita_One'] tracking-wide rounded-lg transition-all border ${
                  window === w
                    ? 'bg-[#FFC91B]/20 text-[#FFC91B] border-[#FFC91B]/50 shadow-[0_0_10px_rgba(255,201,27,0.2)]'
                    : 'bg-transparent text-[#FFC91B]/40 border-transparent hover:text-[#FFC91B]/80 hover:bg-[#FFC91B]/5'
                }`}
              >
                {t(`window${w}d` as 'window7d' | 'window14d' | 'window30d' | 'window90d')}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="relative overflow-hidden bg-[#160B26]/90 backdrop-blur-md rounded-xl p-8 border-b-[4px] border-[#0A0514] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)] text-center border-x border-t border-x-[#FFC91B]/10 border-t-[#FFC91B]/10">
            <div className="w-8 h-8 border-2 border-[#FFC91B] border-t-transparent rounded-full animate-spin mx-auto mb-3 drop-shadow-[0_0_8px_rgba(255,201,27,0.6)]" />
            <p className="text-[10px] uppercase font-black tracking-widest text-[#FFC91B]/70 animate-pulse">{t('mapSelectorTitle')}...</p>
          </div>
        )}

        {error && (
          <div className="relative overflow-hidden bg-[#2d0016]/90 backdrop-blur-md rounded-xl p-5 border-b-[4px] border-[#1a000d] text-center border border-red-500/30">
            <p className="text-sm font-bold tracking-widest uppercase text-red-400">{error}</p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-6">
            <TopBrawlersGrid
              brawlers={data.topBrawlers}
              totalBattles={data.totalProBattles}
              source={data.topBrawlersSource}
              counters={data.counters}
              topBrawlerTeammates={data.topBrawlerTeammates}
            />
            <TrendingSection rising={data.trending.rising} falling={data.trending.falling} />

            <PremiumGate>
              <div className="space-y-6">
                {data.dailyTrend && data.dailyTrend.length > 0 && (
                  <ProTrendChart dailyTrend={data.dailyTrend} topBrawlers={data.topBrawlers} />
                )}
                {data.personalGap && data.personalGap.length > 0 && (
                  <GapAnalysisCards gaps={data.personalGap} />
                )}
                {data.matchupGaps && data.matchupGaps.length > 0 && (
                  <MatchupGapTable gaps={data.matchupGaps} />
                )}
                {hasPremium && !data.personalGap && (
                  <div className="relative overflow-hidden bg-[#160B26]/90 backdrop-blur-md rounded-xl p-5 border border-[#FFC91B]/10 text-center">
                    <p className="text-[10px] uppercase font-black tracking-widest text-[#FFC91B]/50">{t('noGapData')}</p>
                  </div>
                )}
                {!hasPremium && (
                  <div className="relative overflow-hidden bg-[#160B26]/90 backdrop-blur-md rounded-xl p-5 border border-[#FFC91B]/10 text-center">
                    <p className="text-[10px] uppercase font-black tracking-widest text-[#FFC91B]/50">{t('upgradeForGap')}</p>
                  </div>
                )}
              </div>
            </PremiumGate>

            {!hasPremium && (
              <div id="upgrade-section">
                <UpgradeCard />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
