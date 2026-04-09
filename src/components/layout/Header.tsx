'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { LocaleSwitcher } from '@/components/common/LocaleSwitcher'
import { AuthModal } from '@/components/auth/AuthModal'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import type { Profile } from '@/lib/supabase/types'
import { Menu, LogOut, RefreshCw, User, Crown, Home, Gift } from 'lucide-react'
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [refCopied, setRefCopied] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    if (profileMenuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [profileMenuOpen])

  const hasPremium = !loading && user && profile && isPremium(profile as Profile)

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
            <button onClick={onMenuToggle} aria-label="Toggle menu" className="md:hidden p-2 text-white hover:bg-white/10 transition-colors rounded-xl">
              <Menu className="w-6 h-6 stroke-[2.5px]" />
            </button>
          )}
          <img src="/assets/brand/logo-full.png" alt="BrawlVision" className="h-auto w-[120px] md:w-[11%]" />
          {playerTag && (
            <span className="hidden sm:inline text-sm font-['Lilita_One'] px-3 py-1 rounded-full bg-[var(--color-brawl-sky)] border-2 border-[var(--color-brawl-dark)] text-white drop-shadow-[0_2px_0_rgba(18,26,47,1)] ml-2">
              {playerTag}
            </span>
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
          {!loading && user && profile && !isPremium(profile as Profile) && (
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

          {/* Exit button for non-logged-in users viewing a profile */}
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

          {/* Profile avatar dropdown (logged in) */}
          {!loading && user && (
            <div ref={profileMenuRef} className="relative">
              <button
                onClick={() => setProfileMenuOpen(prev => !prev)}
                aria-label={t('profile')}
                className="relative transition-all hover:scale-105 active:scale-95"
              >
                <div className={`w-10 h-10 rounded-full border-2 overflow-hidden flex items-center justify-center ${hasPremium ? 'border-[#FFC91B] shadow-[0_0_8px_rgba(255,201,27,0.3)]' : 'border-white/20 hover:border-white/40'}`}>
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt=""
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

              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#1A2744] border-2 border-[#090E17] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden z-50">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-sm font-semibold text-white truncate">{user.user_metadata?.full_name || user.email}</p>
                    {profile?.player_tag && (
                      <p className="text-[10px] text-slate-500 font-['Lilita_One']">{profile.player_tag}</p>
                    )}
                  </div>

                  {/* Manage subscription */}
                  {hasPremium ? (
                    <a
                      href="https://www.paypal.com/myaccount/autopay/"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-[#FFC91B] transition-colors"
                    >
                      <Crown className="w-4 h-4 text-[#FFC91B]" />
                      {t('manage')}
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3 text-sm text-slate-600 cursor-not-allowed">
                      <Crown className="w-4 h-4" />
                      {t('manage')}
                    </div>
                  )}

                  {/* Referral code copy */}
                  {(profile as Profile)?.referral_code && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://brawlvision.com/${locale}?ref=${(profile as Profile).referral_code}`)
                        setRefCopied(true)
                        setTimeout(() => setRefCopied(false), 2000)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-[#FFC91B] transition-colors"
                    >
                      <Gift className="w-4 h-4" />
                      {refCopied ? `✓ ${t('referralCopied')}` : `${t('referral')} (${(profile as Profile).referral_code})`}
                    </button>
                  )}

                  {/* Logout */}
                  <button
                    onClick={() => { setProfileMenuOpen(false); handleLogout() }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-red-400 transition-colors border-t border-white/5"
                  >
                    <LogOut className="w-4 h-4" />
                    {t('logout')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  )
}
