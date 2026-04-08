'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AuthModal } from '@/components/auth/AuthModal'

export function HeroSignIn() {
  const t = useTranslations('landing')
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <>
      <p className="mt-4 text-sm text-slate-500">
        <button
          onClick={() => setAuthOpen(true)}
          className="text-[var(--color-brawl-sky)] hover:underline font-['Inter'] font-medium"
        >
          {t('heroSignIn')} →
        </button>
      </p>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
