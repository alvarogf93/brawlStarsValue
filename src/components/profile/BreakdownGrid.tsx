import { useTranslations } from 'next-intl'
import type { GemScore } from '@/lib/types'

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
      { label: t('hypercharges'), val: breakdown.enhance.hypercharges.toString() }
    ]},
    { key: 'elite', icon: '👑', value: breakdown.elite.value, details: [
      { label: t('prestige'), val: (breakdown.elite.prestige1 + breakdown.elite.prestige2 + breakdown.elite.prestige3).toString() }
    ]}
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
      {items.map((item, idx) => (
        <div key={item.key} className="glass rounded-2xl p-5 flex flex-col relative overflow-hidden group hover:border-white/20 transition-all hover:translate-y-[-2px] animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
          <div className="flex items-center gap-3 mb-4 text-slate-300">
            <span className="text-2xl opacity-80">{item.icon}</span>
            <h3 className="font-semibold tracking-wide uppercase text-xs">{t(item.key)}</h3>
          </div>
          
          <div className="flex-1">
            <p className="text-3xl font-bold font-['Lilita_One'] tracking-wide text-white mb-4">
              {item.value.toLocaleString()}
            </p>
            
            <div className="space-y-2 mt-auto">
              {item.details.map((detail, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-slate-500">{detail.label}</span>
                  <span className="text-slate-300 font-medium">{detail.val}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Subtle gradient effect on hover */}
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-[var(--color-brawl-blue)] rounded-full filter blur-[50px] opacity-0 group-hover:opacity-20 transition-opacity"></div>
        </div>
      ))}
    </div>
  )
}
