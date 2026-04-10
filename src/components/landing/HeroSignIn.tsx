'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AuthModal } from '@/components/auth/AuthModal'
import { Crown } from 'lucide-react'

export function HeroSignIn() {
  const t = useTranslations('landing')
  const tPremium = useTranslations('premium')
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <>
      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          onClick={() => setAuthOpen(true)}
          className="brawl-button px-8 py-3.5 text-base flex items-center gap-2.5 group"
        >
          <Crown className="w-5 h-5 text-[#121A2F] group-hover:scale-110 transition-transform" />
          {tPremium('trialCta')}
        </button>
        <p className="text-xs text-slate-500 font-['Lilita_One']">
          {tPremium('trialCtaBody')}
        </p>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
