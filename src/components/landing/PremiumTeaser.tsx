'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AuthModal } from '@/components/auth/AuthModal'

export function PremiumTeaser() {
  const t = useTranslations('landing')
  const [authOpen, setAuthOpen] = useState(false)

  const freeFeatures = [
    t('premiumFreeF1'),
    t('premiumFreeF2'),
    t('premiumFreeF3'),
  ]

  const proFeatures = [
    t('premiumProF1'),
    t('premiumProF2'),
    t('premiumProF3'),
    t('premiumProF4'),
    t('premiumProF5'),
  ]

  return (
    <>
      <div className="brawl-card p-8 max-w-[800px] w-full mx-auto" style={{ borderTop: '4px solid var(--color-brawl-gold)' }}>
        <h2 className="text-3xl md:text-4xl font-['Lilita_One'] text-stroke-brawl text-white text-center mb-8">
          {t('premiumTitle')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free column */}
          <div className="brawl-card-dark p-5 rounded-xl">
            <h3 className="font-['Lilita_One'] text-xl text-center text-white mb-4">
              {t('premiumFree')}
            </h3>
            <ul className="space-y-3">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-center gap-3 font-['Lilita_One'] text-sm text-white" style={{ textShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
                  <div className="w-6 h-6 rounded-lg bg-green-500/30 border-2 border-green-400 flex items-center justify-center shrink-0 shadow-[0_2px_0_rgba(0,0,0,0.3)]">
                    <Check className="w-3.5 h-3.5 text-green-300" />
                  </div>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Premium column */}
          <div className="brawl-card-dark p-5 rounded-xl relative" style={{ border: '2px solid var(--color-brawl-gold)', overflow: 'visible' }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--color-brawl-gold)] text-[var(--color-brawl-dark)] font-['Lilita_One'] text-xs px-3 py-1 rounded-full z-10 shadow-[0_2px_0_rgba(0,0,0,0.3)]">
              {t('premiumFrom')}
            </div>
            <h3 className="font-['Lilita_One'] text-xl text-center text-[var(--color-brawl-gold)] mb-4" style={{ textShadow: '0 2px 0 rgba(0,0,0,0.4)' }}>
              {t('premiumPro')}
            </h3>
            <ul className="space-y-3">
              {[...freeFeatures, ...proFeatures].map((f, i) => (
                <li key={f} className="flex items-center gap-3 font-['Lilita_One'] text-sm text-white" style={{ textShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 shadow-[0_2px_0_rgba(0,0,0,0.3)] ${i < freeFeatures.length ? 'bg-[var(--color-brawl-gold)]/30 border-[var(--color-brawl-gold)]' : 'bg-[var(--color-brawl-sky)]/30 border-[var(--color-brawl-sky)]'}`}>
                    <Check className={`w-3.5 h-3.5 ${i < freeFeatures.length ? 'text-[var(--color-brawl-gold)]' : 'text-[var(--color-brawl-sky)]'}`} />
                  </div>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => setAuthOpen(true)}
            className="brawl-button px-8 py-3 text-lg"
          >
            {t('premiumCTA')}
          </button>
        </div>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
