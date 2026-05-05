import { useTranslations, useLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { GemScore } from '@/lib/types'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { GemIcon } from '@/components/ui/GemIcon'
import { BrawlIcon, type BrawlIconName } from '@/components/ui/BrawlIcon'
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

  const gemItems: Array<{
    key: string
    iconName: BrawlIconName | null
    emoji: string | null
    label: string
    gems: number
    detail: string
  }> = [
    { key: 'powerLevels', iconName: 'brawlers', emoji: null, label: t('powerLevels'), gems: breakdown.powerLevels.gems, detail: `${breakdown.powerLevels.count} brawlers` },
    { key: 'gadgets', iconName: 'gadget', emoji: null, label: t('gadgets'), gems: breakdown.gadgets.gems, detail: `×${breakdown.gadgets.count}` },
    { key: 'starPowers', iconName: 'starpower', emoji: null, label: t('starPowers'), gems: breakdown.starPowers.gems, detail: `×${breakdown.starPowers.count}` },
    { key: 'hypercharges', iconName: 'hypercharge', emoji: null, label: t('hypercharges'), gems: breakdown.hypercharges.gems, detail: `×${breakdown.hypercharges.count}` },
    { key: 'buffies', iconName: 'buffies', emoji: null, label: t('buffies'), gems: breakdown.buffies.gems, detail: `×${breakdown.buffies.count}` },
    { key: 'gears', iconName: 'gear', emoji: null, label: t('gears'), gems: breakdown.gears.gems, detail: `×${breakdown.gears.count}` },
  ]

  return (
    /* PERF 2026-05-05 — moved `animate-fade-in` to the wrapper instead of
       per-card with staggered `animationDelay`. The previous per-item stagger
       reset on every parent re-render (sort/filter/visibility refetch in PWA)
       which made cards blink mid-scroll. Single fade-in on mount is equally
       polished and stable. */
    <div className="space-y-8 mt-8 animate-fade-in">
      {/* Gem breakdown grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {gemItems.map((item, idx) => (
          <div key={item.key} className="brawl-card p-4 flex flex-col items-center text-center relative overflow-hidden group brawl-tilt">
            {item.iconName ? (
              <BrawlIcon name={item.iconName} className="w-10 h-10 mb-2" />
            ) : (
              <span className="text-3xl mb-2 filter drop-shadow-md">{item.emoji}</span>
            )}
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
          className="brawl-card p-4 flex flex-col items-center text-center relative overflow-hidden group brawl-tilt cursor-pointer hover:ring-4 hover:ring-[var(--color-brawl-gold)] transition-all"
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
          <BrawlIcon name="prestige" className="w-10 h-10 mx-auto mb-1 group-hover:scale-110 transition-transform" />
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
