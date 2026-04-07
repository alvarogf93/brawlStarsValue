'use client'

import { useRef, useState, useEffect } from 'react'
import { Swords, Users, Zap } from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { useTranslations } from 'next-intl'

export function StatsTicker() {
  const t = useTranslations('landing')
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const stats = [
    { icon: Swords, value: 101, suffix: '+', label: t('statsBrawlers') },
    { icon: Users, value: 10000, suffix: '+', label: t('statsPlayers') },
    { icon: Zap, value: 1000000, suffix: '+', label: t('statsBattles') },
  ]

  return (
    <div ref={ref} className="brawl-card-dark px-6 py-5 max-w-[900px] w-full mx-auto">
      <div className="flex items-center justify-around gap-4 flex-wrap">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-3 min-w-[140px]">
            <s.icon className="w-7 h-7 text-[var(--color-brawl-gold)] shrink-0" />
            <div>
              <div className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-gold)]">
                {visible ? <AnimatedCounter value={s.value} fromZero duration={2000} /> : '0'}
                {s.suffix}
              </div>
              <div className="text-xs text-slate-300 font-['Inter'] font-medium">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
