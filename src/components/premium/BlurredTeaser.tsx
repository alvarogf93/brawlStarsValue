'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { AuthModal } from '@/components/auth/AuthModal'
import { Lock } from 'lucide-react'

interface BlurredTeaserProps {
  children: React.ReactNode
  redirectTo?: string
}

export function BlurredTeaser({ children, redirectTo }: BlurredTeaserProps) {
  const { user } = useAuth()
  const t = useTranslations('premium')
  const locale = useLocale()
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none opacity-60">
        {children}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#121A2F]/60 backdrop-blur-[2px] rounded-2xl">
        <div className="w-14 h-14 rounded-full bg-[#FFC91B]/20 border-2 border-[#FFC91B]/30 flex items-center justify-center mb-3">
          <Lock className="w-6 h-6 text-[#FFC91B]" />
        </div>
        <p className="font-['Lilita_One'] text-lg text-white text-center mb-1">{t('teaserTitle')}</p>
        <p className="text-xs text-slate-400 text-center mb-4 max-w-xs">{t('teaserSubtitle')}</p>
        {user ? (
          <button
            onClick={async () => {
              const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ interval: 'monthly', locale }),
              })
              const data = await res.json()
              if (data.url) window.location.href = data.url
            }}
            className="brawl-button px-6 py-2.5 text-sm"
          >
            {t('upgradeButton')}
          </button>
        ) : (
          <button onClick={() => setAuthOpen(true)} className="brawl-button px-6 py-2.5 text-sm">
            {t('registerButton')}
          </button>
        )}
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} redirectTo={redirectTo} />
    </div>
  )
}
