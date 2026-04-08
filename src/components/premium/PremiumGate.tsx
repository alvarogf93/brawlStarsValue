'use client'

import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import type { Profile } from '@/lib/supabase/types'
import { Crown } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** If true, renders children with blur. If false, hides children entirely. */
  blur?: boolean
  /** Callback when the blur overlay is clicked */
  onUpgrade?: () => void
}

export function PremiumGate({ children, blur = true, onUpgrade }: Props) {
  const { user, profile } = useAuth()
  const t = useTranslations('premium')

  const hasPremium = user && profile && isPremium(profile as Profile)

  if (hasPremium) {
    return <>{children}</>
  }

  if (!blur) return null

  const handleClick = () => {
    if (onUpgrade) {
      onUpgrade()
    } else {
      // Scroll to upgrade card
      const el = document.getElementById('upgrade-section')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="relative select-none">
      {/* Blurred content — real data rendered but unreadable */}
      <div className="pointer-events-none" style={{ filter: 'blur(8px)' }} aria-hidden="true">
        {children}
      </div>

      {/* Overlay */}
      <div
        className="absolute inset-0 bg-[#030712]/40 backdrop-blur-[2px] flex flex-col items-center justify-center cursor-pointer rounded-xl transition-all hover:bg-[#030712]/50"
        onClick={handleClick}
      >
        <div className="bg-[#FFC91B]/10 border border-[#FFC91B]/30 rounded-2xl px-6 py-4 text-center backdrop-blur-sm">
          <Crown className="w-8 h-8 text-[#FFC91B] mx-auto mb-2" />
          <p className="font-['Lilita_One'] text-base text-white">{t('blurUnlock')}</p>
        </div>
      </div>
    </div>
  )
}
