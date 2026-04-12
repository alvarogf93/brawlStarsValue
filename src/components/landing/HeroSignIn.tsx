'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AuthModal } from '@/components/auth/AuthModal'
import { Crown } from 'lucide-react'

export function HeroSignIn() {
  const tSub = useTranslations('subscribe')
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <>
      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          onClick={() => setAuthOpen(true)}
          className="brawl-button px-8 py-3.5 text-base flex items-center gap-2.5 group"
        >
          <Crown className="w-5 h-5 text-[#121A2F] group-hover:scale-110 transition-transform" />
          {tSub('trialCta')}
        </button>
        <p className="text-xs text-slate-500 font-['Lilita_One']">
          {tSub('trialCtaBody')}
        </p>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
