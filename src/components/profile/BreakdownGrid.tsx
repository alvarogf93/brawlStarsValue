import { useTranslations } from 'next-intl'
import type { GemScore } from '@/lib/types'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'

interface BreakdownGridProps {
  breakdown: GemScore['breakdown']
}

export function BreakdownGrid({ breakdown }: BreakdownGridProps) {
  const t = useTranslations('profile')

  const items = [
    { key: 'base', icon: '🏆', value: breakdown.base.value, details: [
      { label: t('trophies'), val: breakdown.base.trophies.toLocaleString() },
      { label: t('victories'), val: breakdown.base.victories3vs3.toLocaleString() }
    ]},
    { key: 'assets', icon: '🎴', value: breakdown.assets.value, details: [
      { label: t('brawlerCount'), val: breakdown.assets.brawlerCount.toString() }
    ]},
    { key: 'enhance', icon: '⚡', value: breakdown.enhance.value, details: [
      { label: t('gadgets'), val: breakdown.enhance.gadgets.toString() },
      { label: t('starPowers'), val: breakdown.enhance.starPowers.toString() },
      { label: t('hypercharges'), val: breakdown.enhance.hypercharges.toString() },
      { label: t('buffies'), val: breakdown.enhance.buffies.toString() },
      { label: t('skins'), val: breakdown.enhance.skins.toString() },
    ]},
    { key: 'elite', icon: '👑', value: breakdown.elite.value, details: [
      { label: t('prestige'), val: (breakdown.elite.prestige1 + breakdown.elite.prestige2 + breakdown.elite.prestige3).toString() }
    ]}
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
      {items.map((item, idx) => (
        <div key={item.key} className="brawl-card-dark p-5 flex flex-col relative overflow-hidden group brawl-tilt animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl filter drop-shadow-md">{item.icon}</span>
            <h3 className="font-bold tracking-widest uppercase text-sm text-[var(--color-brawl-sky)] font-['Lilita_One'] text-shadow-sm">{t(item.key)}</h3>
          </div>
          
          <div className="flex-1 z-10">
            <p className="text-4xl font-bold font-['Lilita_One'] tracking-wider text-white mb-4 text-stroke-brawl">
              <AnimatedCounter value={item.value} duration={1800 + (idx * 200)} />
            </p>
            
            <div className="space-y-2 mt-auto">
              {item.details.map((detail, i) => (
                <div key={i} className="flex justify-between text-base font-['Lilita_One'] border-b border-white/10 pb-1">
                  <span className="text-slate-300">{detail.label}</span>
                  <span className="text-[var(--color-brawl-gold)]">{detail.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
