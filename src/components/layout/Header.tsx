'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { LocaleSwitcher } from '@/components/common/LocaleSwitcher'
import { Menu, LogOut, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface HeaderProps {
  playerTag?: string
  onMenuToggle?: () => void
}

export function Header({ playerTag, onMenuToggle }: HeaderProps) {
  const router = useRouter()
  const locale = useLocale()

  const [syncing, setSyncing] = useState(false)

  const handleSync = () => {
    setSyncing(true)
    try {
      // Clear all brawlvalue caches except user tag and skin classifications
      const keysToKeep = ['brawlvalue:user']
      const keysToKeepPrefixes = ['brawlvalue:skins:']
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key?.startsWith('brawlvalue:') && !keysToKeep.includes(key) && !keysToKeepPrefixes.some(p => key.startsWith(p))) {
          localStorage.removeItem(key)
        }
      }
    } catch { /* ignore */ }
    // Reload current page
    window.location.reload()
  }

  const handleLogout = () => {
    try { localStorage.removeItem('brawlvalue:user') } catch { /* ignore */ }
    router.replace(`/${locale}`)
  }

  return (
    <header className="h-[var(--header-height)] shrink-0 bg-[#0F172A] border-b-4 border-[#030712] flex items-center justify-between px-6 md:px-8 z-50 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-4">
        {onMenuToggle && (
          <button onClick={onMenuToggle} className="md:hidden p-2 text-[var(--color-brawl-dark)] hover:bg-[var(--color-brawl-light)] transition-colors rounded-xl border-2 border-transparent hover:border-[var(--color-brawl-dark)]">
            <Menu className="w-6 h-6 stroke-[3px]" />
          </button>
        )}
        <span className="font-black text-2xl font-['Lilita_One'] tracking-wide text-[var(--color-brawl-gold)] text-stroke-brawl transform rotate-[-2deg]">BrawlValue</span>
        {playerTag && (
          <span className="text-sm font-['Lilita_One'] px-3 py-1 rounded-full bg-[var(--color-brawl-sky)] border-2 border-[var(--color-brawl-dark)] text-white hidden sm:inline-block ml-2 drop-shadow-[0_2px_0_rgba(18,26,47,1)]">
            {playerTag}
          </span>
        )}
      </div>
      <div className="flex gap-2 items-center">
        <Link href={`/${locale}/leaderboard`} className="brawl-button px-3 py-2 flex items-center gap-2 text-sm">
          🏆 <span className="hidden sm:inline-block">RANKING</span>
        </Link>
        {playerTag && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="p-2 text-slate-400 hover:text-[#4EC0FA] transition-colors rounded-xl hover:bg-white/5 disabled:opacity-50"
            title="Sync"
          >
            <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        )}
        <LocaleSwitcher />
        {playerTag && (
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-xl hover:bg-white/5" title="Logout">
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  )
}
