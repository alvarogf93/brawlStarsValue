'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { LocaleSwitcher } from '@/components/common/LocaleSwitcher'
import { AuthModal } from '@/components/auth/AuthModal'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import { Menu, LogOut, RefreshCw, User, Crown, Home, Gift } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

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
  const locale = useLocale()
  const t = useTranslations('nav')
  const { user, profile, loading, signOut } = useAuth()

  const [syncing, setSyncing] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  // Ticker to force re-render once per minute so the "last sync"
  // label advances with the wall clock even when the DB hasn't
  // changed. Without this, formatTimeAgo is only recomputed when
  // something else causes a render, and the label visually freezes
  // at whatever value it had on mount (e.g. "1h 42m") until the
  // user hits F5. `AuthProvider` polls the DB every 5 min for real
  // updates; this ticker handles the in-between seconds.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!profile?.last_sync) return
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [profile?.last_sync])

  const hasPremium = !loading && user && profile && isPremium(profile)

  const handleSync = async () => {
    setSyncing(true)

    if (user && profile && isPremium(profile)) {
      try {
        await fetch('/api/sync', { method: 'POST' })
      } catch { /* ignore */ }
    }

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
    try {
      if (user) {
        await Promise.race([
          signOut(),
          new Promise(resolve => setTimeout(resolve, 3000)),
        ])
      }
    } catch { /* ignore lock errors */ }

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

    try {
      document.cookie.split(';').forEach(c => {
        const name = c.trim().split('=')[0]
        if (name.startsWith('sb-')) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
        }
      })
    } catch { /* ignore */ }

    window.location.href = `/${locale}`
  }

  const handleCopyReferral = () => {
    if (!profile?.referral_code) return
    navigator.clipboard.writeText(`https://brawlvision.com/${locale}?ref=${profile.referral_code}`)
    toast.success(t('referralCopied'))
  }

  return (
    <>
      <header className="h-[var(--header-height)] shrink-0 bg-[#0F172A] border-b-4 border-[#030712] flex items-center justify-between px-6 md:px-8 z-50 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4">
          {onMenuToggle && (
            <button onClick={onMenuToggle} aria-label="Toggle menu" className="md:hidden p-2 text-white hover:bg-white/10 transition-colors rounded-xl">
              <Menu className="w-6 h-6 stroke-[2.5px]" />
            </button>
          )}
          <img src="/assets/brand/logo-full.png" alt="BrawlVision" className="h-auto w-[72px] md:w-[11%]" />
          {playerTag && (
            <span className="hidden sm:inline text-sm font-['Lilita_One'] px-3 py-1 rounded-full bg-[var(--color-brawl-sky)] border-2 border-[var(--color-brawl-dark)] text-white drop-shadow-[0_2px_0_rgba(18,26,47,1)] ml-2">
              {playerTag}
            </span>
          )}
          {!loading && user && isPremium(profile) && profile?.last_sync && (
            <span className="text-[10px] text-slate-500 font-semibold hidden md:inline-block">
              {t('lastSync')}: {formatTimeAgo(profile.last_sync)}
            </span>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {!loading && !user && (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-['Lilita_One'] text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">{t('login')}</span>
            </button>
          )}
          {!loading && user && profile && !isPremium(profile) && (
            <Link
              href={`/${locale}/profile/${encodeURIComponent(profile.player_tag)}/subscribe`}
              className="cursor-pointer flex items-center gap-1.5 px-3 py-2 text-sm font-['Lilita_One'] text-slate-400 bg-white/5 hover:bg-white/10 hover:text-[#FFC91B] rounded-xl transition-colors border border-white/10 hover:border-[#FFC91B]/30"
            >
              <Crown className="w-4 h-4" />
              <span className="hidden sm:inline">{t('upgrade')}</span>
            </Link>
          )}

          {playerTag && (
            <button
              onClick={handleSync}
              disabled={syncing}
              aria-label={t('sync')}
              className="hidden md:flex p-2 min-w-[44px] min-h-[44px] items-center justify-center text-slate-400 hover:text-[#4EC0FA] transition-colors rounded-xl hover:bg-white/5 disabled:opacity-50"
              title={t('sync')}
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            </button>
          )}
          <Link href={`/${locale}/leaderboard`} className="brawl-button px-3 py-2 flex items-center gap-2 text-sm">
            🏆 <span className="hidden sm:inline-block">{t('leaderboard')}</span>
          </Link>
          <LocaleSwitcher />

          {!loading && !user && playerTag && (
            <Link
              href={`/${locale}`}
              onClick={() => { try { localStorage.removeItem('brawlvalue:user') } catch {} }}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/5"
              title={t('exit')}
            >
              <Home className="w-5 h-5" />
            </Link>
          )}

          {/* Profile dropdown (logged in) */}
          {!loading && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label={t('profile')}
                  className="relative transition-all hover:scale-105 active:scale-95 outline-none"
                >
                  <div className={`w-10 h-10 rounded-full border-2 overflow-hidden flex items-center justify-center ${hasPremium ? 'border-[#FFC91B] shadow-[0_0_8px_rgba(255,201,27,0.3)]' : 'border-white/20 hover:border-white/40'}`}>
                    {user.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt={user.user_metadata?.full_name || 'Avatar'}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  {hasPremium && (
                    <span className="absolute -top-1 -right-1 z-10 w-4 h-4 bg-[#FFC91B] rounded-full flex items-center justify-center border-2 border-[#0F172A]">
                      <Crown className="w-2.5 h-2.5 text-[#121A2F]" />
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold text-white truncate">{user.user_metadata?.full_name || user.email}</p>
                  {profile?.player_tag && (
                    <p className="text-[10px] text-slate-500 font-['Lilita_One']">{profile.player_tag}</p>
                  )}
                </DropdownMenuLabel>

                {hasPremium ? (
                  <DropdownMenuItem asChild>
                    <a
                      href="https://www.paypal.com/myaccount/autopay/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#FFC91B]"
                    >
                      <Crown className="w-4 h-4 text-[#FFC91B]" />
                      {t('manage')}
                    </a>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled>
                    <Crown className="w-4 h-4" />
                    {t('manage')}
                  </DropdownMenuItem>
                )}

                {profile?.referral_code && (
                  <DropdownMenuItem onClick={handleCopyReferral}>
                    <Gift className="w-4 h-4" />
                    {t('referral')} ({profile.referral_code})
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={handleLogout} className="hover:!text-red-400">
                  <LogOut className="w-4 h-4" />
                  {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  )
}
