'use client'

import { LocaleSwitcher } from '@/components/common/LocaleSwitcher'
import { Menu } from 'lucide-react'

interface HeaderProps {
  playerTag?: string
  onMenuToggle?: () => void
}

export function Header({ playerTag, onMenuToggle }: HeaderProps) {
  return (
    <header className="h-[var(--header-height)] border-b border-white/10 bg-[var(--color-brawl-dark)]/90 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button onClick={onMenuToggle} className="md:hidden p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
            <Menu className="w-5 h-5" />
          </button>
        )}
        <span className="font-bold text-xl font-['Righteous'] bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 tracking-wide">BrawlValue</span>
        {playerTag && (
          <span className="text-sm font-['Inter'] font-semibold px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-slate-300 hidden sm:inline-block ml-2">
            {playerTag}
          </span>
        )}
      </div>
      <LocaleSwitcher />
    </header>
  )
}
