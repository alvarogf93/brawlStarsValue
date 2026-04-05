'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import type { GemScore } from '@/lib/types'
import { BreakdownGrid } from '@/components/profile/BreakdownGrid'

export default function OverviewPage() {
  const params = useParams<{ tag: string }>()
  const t = useTranslations('profile')
  const tag = decodeURIComponent(params.tag)
  
  const [data, setData] = useState<GemScore | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerTag: tag }),
    })
      .then((res) => res.json())
      .then((resData) => {
        setData(resData)
        setIsLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setIsLoading(false)
      })
  }, [tag])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <div className="w-24 h-24 border-4 border-[var(--color-brawl-blue)] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-8 text-slate-400 font-['Righteous'] text-xl tracking-widest uppercase">Consultando base de datos...</p>
      </div>
    )
  }

  if (!data || !data.breakdown) {
    return (
      <div className="glass p-8 rounded-2xl text-center border-red-500/30">
        <p className="text-red-400">No se pudo cargar la información del perfil.</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in w-full">
      {/* Hero Section */}
      <div className="glass rounded-[32px] p-8 md:p-12 text-center border-t border-t-[var(--color-brawl-gold)]/30 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[200px] bg-[var(--color-brawl-gold)] mix-blend-screen filter blur-[120px] opacity-10 pointer-events-none"></div>
        
        <p className="text-slate-400 text-sm font-semibold tracking-widest uppercase mb-4 relative z-10 font-['Inter']">
          Valoración de <span className="text-white">{data.playerName}</span>
        </p>
        
        <div className="relative z-10 inline-block">
          <h2 className="text-5xl md:text-8xl font-['Lilita_One'] tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-[#FDE047] via-[#FBBF24] to-[#B45309] drop-shadow-[0_4px_10px_rgba(251,191,36,0.4)]">
            {data.gemEquivalent.toLocaleString()}
          </h2>
        </div>
        
        <div className="bg-[var(--color-brawl-dark)]/50 border border-white/10 rounded-full px-6 py-2 inline-flex items-center gap-2 mt-6 relative z-10">
          <span className="text-xl">💎</span>
          <span className="text-slate-300 font-semibold font-['Inter']">{t('gemEquivalent')}</span>
        </div>
      </div>

      {/* Breakdown Section */}
      <BreakdownGrid breakdown={data.breakdown} />
      
      {/* Ad Placeholder to prevent CLS */}
      <div className="w-full min-h-[250px] mt-8 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center border-dashed">
        <p className="text-slate-600 text-sm italic">Ad Space Reservation</p>
      </div>
    </div>
  )
}
