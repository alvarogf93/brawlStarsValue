import { useTranslations } from 'next-intl'
import type { GemScore } from '@/lib/types'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { GemIcon } from '@/components/ui/GemIcon'

interface BreakdownGridProps {
  breakdown: GemScore['breakdown']
  stats: GemScore['stats']
}

export function BreakdownGrid({ breakdown, stats }: BreakdownGridProps) {
  const t = useTranslations('profile')

  const gemItems = [
    { key: 'unlocks', icon: '🎴', label: t('brawlerCount'), gems: breakdown.unlocks.gems, detail: `${breakdown.unlocks.count} brawlers` },
    { key: 'powerLevels', icon: '📈', label: 'Power Levels', gems: breakdown.powerLevels.gems, detail: `${breakdown.powerLevels.count} upgraded` },
    { key: 'gadgets', icon: '🔧', label: t('gadgets'), gems: breakdown.gadgets.gems, detail: `×${breakdown.gadgets.count}` },
    { key: 'starPowers', icon: '⭐', label: t('starPowers'), gems: breakdown.starPowers.gems, detail: `×${breakdown.starPowers.count}` },
    { key: 'hypercharges', icon: '⚡', label: t('hypercharges'), gems: breakdown.hypercharges.gems, detail: `×${breakdown.hypercharges.count}` },
    { key: 'buffies', icon: '💪', label: t('buffies'), gems: breakdown.buffies.gems, detail: `×${breakdown.buffies.count}` },
    { key: 'skins', icon: '🎨', label: t('skins'), gems: breakdown.skins.gems, detail: `×${breakdown.skins.count}` },
  ]

  return (
    <div className="space-y-8 mt-8">
      {/* Gem breakdown grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {gemItems.map((item, idx) => (
          <div key={item.key} className="brawl-card-dark p-4 flex flex-col items-center text-center relative overflow-hidden group brawl-tilt animate-fade-in" style={{ animationDelay: `${idx * 60}ms` }}>
            <span className="text-2xl mb-2 filter drop-shadow-md">{item.icon}</span>
            <p className="text-xs text-slate-400 font-bold uppercase mb-1">{item.label}</p>
            <p className="font-['Lilita_One'] text-xl text-white flex items-center gap-1">
              <AnimatedCounter value={item.gems} duration={1200 + idx * 100} />
              <GemIcon className="w-4 h-4" />
            </p>
            <p className="text-[10px] text-slate-500 mt-1">{item.detail}</p>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="brawl-card p-4 text-center">
          <span className="text-2xl">🏆</span>
          <p className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-dark)]">{stats.trophies.toLocaleString()}</p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('trophies')}</p>
        </div>
        <div className="brawl-card p-4 text-center">
          <span className="text-2xl">👑</span>
          <p className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-dark)]">P{stats.totalPrestigeLevel}</p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('prestige')}</p>
        </div>
        <div className="brawl-card p-4 text-center">
          <span className="text-2xl">⚔️</span>
          <p className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-dark)]">{stats.totalVictories.toLocaleString()}</p>
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('victories')}</p>
        </div>
        <div className="brawl-card p-4 text-center bg-[#4EC0FA]">
          <span className="text-2xl">⏱️</span>
          <p className="font-['Lilita_One'] text-2xl text-white text-stroke-brawl" style={{ WebkitTextStroke: '1px #121A2F' }}>{stats.estimatedHoursPlayed.toLocaleString()}h</p>
          <p className="text-[10px] uppercase font-bold text-white/80">Tiempo jugado</p>
        </div>
      </div>
    </div>
  )
}
