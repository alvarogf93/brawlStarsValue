import { useTranslations, useLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { GemScore } from '@/lib/types'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { GemIcon } from '@/components/ui/GemIcon'
import { formatPlaytime } from '@/lib/utils'
import { useSkinClassifications } from '@/hooks/useSkinClassifications'

interface BreakdownGridProps {
  breakdown: GemScore['breakdown']
  stats: GemScore['stats']
}

export function BreakdownGrid({ breakdown, stats }: BreakdownGridProps) {
  const t = useTranslations('profile')
  const locale = useLocale()
  const params = useParams<{ tag: string }>()
  const tag = decodeURIComponent(params.tag)
  const { totalCosmeticGems } = useSkinClassifications(tag)

  const cosmeticsHref = `/${locale}/profile/${encodeURIComponent(tag)}/cosmetics`

  const gemItems = [
    { key: 'powerLevels', icon: '📈', label: t('powerLevels'), gems: breakdown.powerLevels.gems, detail: `${breakdown.powerLevels.count} brawlers` },
    { key: 'gadgets', icon: '🔧', label: t('gadgets'), gems: breakdown.gadgets.gems, detail: `×${breakdown.gadgets.count}` },
    { key: 'starPowers', icon: '⭐', label: t('starPowers'), gems: breakdown.starPowers.gems, detail: `×${breakdown.starPowers.count}` },
    { key: 'hypercharges', icon: '⚡', label: t('hypercharges'), gems: breakdown.hypercharges.gems, detail: `×${breakdown.hypercharges.count}` },
    { key: 'buffies', icon: '💪', label: t('buffies'), gems: breakdown.buffies.gems, detail: `×${breakdown.buffies.count}` },
    { key: 'gears', icon: '🔩', label: t('gears'), gems: breakdown.gears.gems, detail: `×${breakdown.gears.count}` },
  ]

  return (
    <div className="space-y-8 mt-8">
      {/* Gem breakdown grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {gemItems.map((item, idx) => (
          <div key={item.key} className="brawl-card p-4 flex flex-col items-center text-center relative overflow-hidden group brawl-tilt animate-fade-in" style={{ animationDelay: `${idx * 60}ms` }}>
            <span className="text-3xl mb-2 filter drop-shadow-md">{item.icon}</span>
            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">{item.label}</p>
            <p className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-dark)] flex items-center gap-1">
              <AnimatedCounter value={item.gems} duration={1200 + idx * 100} fromZero />
              <GemIcon className="w-5 h-5" />
            </p>
            <p className="text-[10px] text-slate-400 mt-1">{item.detail}</p>
          </div>
        ))}

        {/* Cosmetics card — links to /cosmetics */}
        <Link
          href={cosmeticsHref}
          className="brawl-card p-4 flex flex-col items-center text-center relative overflow-hidden group brawl-tilt animate-fade-in cursor-pointer hover:ring-4 hover:ring-[var(--color-brawl-gold)] transition-all"
          style={{ animationDelay: `${gemItems.length * 60}ms` }}
        >
          <span className="text-3xl mb-2 filter drop-shadow-md">🎨</span>
          <p className="text-[10px] text-slate-500 font-black uppercase mb-1">{t('cosmetics')}</p>
          <p className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-dark)] flex items-center gap-1">
            {totalCosmeticGems > 0 ? (
              <>
                <AnimatedCounter value={totalCosmeticGems} duration={1600} fromZero />
                <GemIcon className="w-5 h-5" />
              </>
            ) : (
              <span className="text-[var(--color-brawl-gold)] text-sm">+ {t('addCosmetics')}</span>
            )}
          </p>
          {totalCosmeticGems > 0 && (
            <p className="text-[10px] text-slate-400 mt-1">skins &amp; pins</p>
          )}
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="brawl-card p-4 text-center group">
          <span className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform block mb-1">🏆</span>
          <p className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-dark)]">{stats.trophies.toLocaleString()}</p>
          <p className="text-[10px] uppercase font-black text-slate-500">{t('trophies')}</p>
        </div>
        <div className="brawl-card p-4 text-center group">
          <span className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform block mb-1">👑</span>
          <p className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-purple)]">P{stats.totalPrestigeLevel}</p>
          <p className="text-[10px] uppercase font-black text-slate-500">{t('prestige')}</p>
        </div>
        <div className="brawl-card p-4 text-center group">
          <span className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform block mb-1">⚔️</span>
          <p className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-blue)]">{stats.threeVsThreeVictories.toLocaleString()}</p>
          <p className="text-[10px] uppercase font-black text-slate-500">{t('victories3v3')}</p>
        </div>
        <div className="brawl-card p-4 text-center group">
          <span className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform block mb-1">🏅</span>
          <p className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-gold)]">{(stats.soloVictories + stats.duoVictories).toLocaleString()}</p>
          <p className="text-[10px] uppercase font-black text-slate-500">{t('victoriesSurvival')}</p>
        </div>
        <div className="brawl-card p-4 text-center group">
          <span className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform block mb-1">⏱️</span>
          <p className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-dark)]">{formatPlaytime(stats.estimatedHoursPlayed)}</p>
          <p className="text-[10px] uppercase font-black text-slate-500">{t('timePlayed')}</p>
        </div>
      </div>
    </div>
  )
}
