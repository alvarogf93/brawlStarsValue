'use client'

import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { OpponentStrengthBreakdown } from '@/lib/analytics/types'

interface Props {
  data: OpponentStrengthBreakdown[]
}

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400'
  if (wr >= 45) return 'text-[#FFC91B]'
  return 'text-red-400'
}

const TIER_ICONS: Record<string, string> = {
  weak: '🟢',
  even: '🟡',
  strong: '🔴',
}

const TIER_KEYS: Record<string, string> = {
  weak: 'tierWeak',
  even: 'tierEven',
  strong: 'tierStrong',
}

export function OpponentStrengthCard({ data }: Props) {
  const t = useTranslations('advancedAnalytics')

  const filtered = data.filter(d => d.total > 0)
  if (filtered.length === 0) return null

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">💪</span> {t('opponentTitle')}
        <InfoTooltip className="ml-1.5" text={t('tipOpponent')} />
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {filtered.map(d => (
          <div key={d.tier} className="brawl-row rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-lg">{TIER_ICONS[d.tier]}</span>
              <span className="font-['Lilita_One'] text-sm text-white">{t(TIER_KEYS[d.tier])}</span>
            </div>
            <p className={`font-['Lilita_One'] text-2xl tabular-nums ${wrColor(d.winRate)}`}>
              {d.winRate.toFixed(1)}%
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              {d.wins}W / {d.total}G
            </p>
            <p className="text-[10px] text-slate-600 mt-0.5">
              ~{Math.round(d.avgOpponentTrophies)} 🏆
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
