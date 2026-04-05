'use client'

import { LocaleSwitcher } from '@/components/common/LocaleSwitcher'
import { Menu } from 'lucide-react'
import Link from 'next/link'

interface HeaderProps {
  playerTag?: string
  onMenuToggle?: () => void
}

export function Header({ playerTag, onMenuToggle }: HeaderProps) {
  return (
    <header className="h-[var(--header-height)] bg-[#0F172A] border-b-4 border-[#030712] flex items-center justify-between px-6 md:px-8 sticky top-0 z-50 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
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
        <Link href={`/${playerTag ? 'es' : 'es'}/leaderboard`} className="brawl-button px-3 py-2 flex items-center gap-2 text-sm">
          🏆 <span className="hidden sm:inline-block">RANKING</span>
        </Link>
        <LocaleSwitcher />
      </div>
    </header>
  )
}
