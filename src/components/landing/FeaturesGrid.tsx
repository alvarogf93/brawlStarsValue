import { useTranslations } from 'next-intl'

const FEATURES = [
  { key: '1', emoji: '💎', color: 'var(--color-brawl-gold)' },
  { key: '2', emoji: '📊', color: 'var(--color-brawl-sky)' },
  { key: '3', emoji: '🤝', color: '#4ade80' },
  { key: '4', emoji: '🛡️', color: 'var(--color-brawl-red)' },
  { key: '5', emoji: '📈', color: 'var(--color-brawl-purple)' },
  { key: '6', emoji: '⚡', color: 'var(--color-brawl-gold)' },
] as const

export function FeaturesGrid() {
  const t = useTranslations('landing')

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-[900px] w-full mx-auto">
      {FEATURES.map((f) => (
        <div
          key={f.key}
          className="brawl-card-dark p-5 text-center transition-transform hover:scale-[1.03]"
        >
          <div
            className="w-14 h-14 mx-auto mb-3 rounded-xl border-4 border-[var(--color-brawl-dark)] flex items-center justify-center shadow-[0_3px_0_0_rgba(18,26,47,1)]"
            style={{ backgroundColor: f.color + '30' }}
          >
            <span className="text-3xl">{f.emoji}</span>
          </div>
          <h3 className="font-['Lilita_One'] text-base text-white tracking-wide mb-1">
            {t(`feature${f.key}Title`)}
          </h3>
          <p className="text-xs text-slate-400 font-['Inter']">
            {t(`feature${f.key}Desc`)}
          </p>
        </div>
      ))}
    </div>
  )
}
