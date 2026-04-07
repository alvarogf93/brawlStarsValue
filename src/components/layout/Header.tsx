'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { LocaleSwitcher } from '@/components/common/LocaleSwitcher'
import { AuthModal } from '@/components/auth/AuthModal'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import type { Profile } from '@/lib/supabase/types'
import { Menu, LogOut, RefreshCw, User, Crown } from 'lucide-react'
import Link from 'next/link'

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '<1 min'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}

interface HeaderProps {
  playerTag?: string
  onMenuToggle?: () => void
}

export function Header({ playerTag, onMenuToggle }: HeaderProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('nav')
  const { user, profile, loading, signOut } = useAuth()

  const [syncing, setSyncing] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const handleSync = async () => {
    setSyncing(true)

    // Premium: call sync API first
    if (user && profile && isPremium(profile as Profile)) {
      try {
        await fetch('/api/sync', { method: 'POST' })
      } catch { /* ignore */ }
    }

    // Always clear local cache
    try {
      const keysToKeep = ['brawlvalue:user']
      const keysToKeepPrefixes = ['brawlvalue:skins:']
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key?.startsWith('brawlvalue:') && !keysToKeep.includes(key) && !keysToKeepPrefixes.some(p => key.startsWith(p))) {
          localStorage.removeItem(key)
        }
      }
    } catch { /* ignore */ }
    window.location.reload()
  }

  const handleLogout = async () => {
    // 1. Sign out from Supabase (with timeout to prevent hanging)
    try {
      if (user) {
        await Promise.race([
          signOut(),
          new Promise(resolve => setTimeout(resolve, 3000)),
        ])
      }
    } catch { /* ignore lock errors */ }

    // 2. Clear ALL app data from localStorage
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('brawlvalue:') || key?.startsWith('sb-')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))
    } catch { /* ignore */ }

    // 3. Clear Supabase auth cookies (fallback if signOut failed)
    try {
      document.cookie.split(';').forEach(c => {
        const name = c.trim().split('=')[0]
        if (name.startsWith('sb-')) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
        }
      })
    } catch { /* ignore */ }

    // 4. Hard redirect to landing (always, even if signOut hung)
    window.location.href = `/${locale}`
  }

  return (
    <>
      <header className="h-[var(--header-height)] shrink-0 bg-[#0F172A] border-b-4 border-[#030712] flex items-center justify-between px-6 md:px-8 z-50 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4">
          {onMenuToggle && (
            <button onClick={onMenuToggle} aria-label="Toggle menu" className="md:hidden p-2 text-[var(--color-brawl-dark)] hover:bg-[var(--color-brawl-light)] transition-colors rounded-xl border-2 border-transparent hover:border-[var(--color-brawl-dark)]">
              <Menu className="w-6 h-6 stroke-[3px]" />
            </button>
          )}
          <span className="font-black text-2xl font-['Lilita_One'] tracking-wider text-[var(--color-brawl-gold)] text-stroke-brawl-brand transform rotate-[-2deg]">BrawlVision</span>
          {playerTag && (
            <div className="hidden sm:flex items-center gap-2 ml-2">
              <span className="text-sm font-['Lilita_One'] px-3 py-1 rounded-full bg-[var(--color-brawl-sky)] border-2 border-[var(--color-brawl-dark)] text-white drop-shadow-[0_2px_0_rgba(18,26,47,1)]">
                {playerTag}
              </span>
              {user?.user_metadata?.avatar_url && (
                <img
                  src={user.user_metadata.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full border-2 border-[var(--color-brawl-gold)] shadow-[0_2px_0_rgba(0,0,0,0.3)]"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          )}
          {!loading && user && isPremium(profile as Profile) && profile?.last_sync && (
            <span className="text-[10px] text-slate-500 font-semibold hidden md:inline-block">
              {t('lastSync')}: {formatTimeAgo(profile.last_sync)}
            </span>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {/* Auth: Login or Premium Upgrade */}
          {!loading && !user && (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-['Lilita_One'] text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">{t('login')}</span>
            </button>
          )}
          {!loading && user && profile?.tier === 'free' && (
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ interval: 'monthly', locale }),
                  })
                  const data = await res.json()
                  if (data.url) window.location.href = data.url
                } catch { /* ignore */ }
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-['Lilita_One'] text-[#FFC91B] bg-[#FFC91B]/10 hover:bg-[#FFC91B]/20 rounded-xl transition-colors border border-[#FFC91B]/30"
            >
              <Crown className="w-4 h-4" />
              <span className="hidden sm:inline">{t('upgrade')}</span>
            </button>
          )}

          {playerTag && (
            <button
              onClick={handleSync}
              disabled={syncing}
              aria-label={t('sync')}
              className="p-2 text-slate-400 hover:text-[#4EC0FA] transition-colors rounded-xl hover:bg-white/5 disabled:opacity-50"
              title={t('sync')}
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            </button>
          )}
          <Link href={`/${locale}/leaderboard`} className="brawl-button px-3 py-2 flex items-center gap-2 text-sm">
            🏆 <span className="hidden sm:inline-block">{t('leaderboard')}</span>
          </Link>
          <LocaleSwitcher />
          {playerTag && (
            <button onClick={handleLogout} aria-label={t('logout')} className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-red-400 active:text-red-500 transition-colors rounded-xl hover:bg-white/5 active:bg-white/10" title={t('logout')}>
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  )
}
