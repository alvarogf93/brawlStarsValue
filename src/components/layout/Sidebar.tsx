'use client'

import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, BarChart3, Share2 } from 'lucide-react'

interface SidebarProps {
  tag: string
  locale: string
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ tag, locale, isOpen, onClose }: SidebarProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const basePath = `/${locale}/profile/${encodeURIComponent(tag)}`

  const NAV_ITEMS = [
    { key: 'overview', path: '', icon: <LayoutDashboard className="w-5 h-5" /> },
    { key: 'brawlers', path: '/brawlers', icon: <Users className="w-5 h-5" /> },
    { key: 'stats', path: '/stats', icon: <BarChart3 className="w-5 h-5" /> },
    { key: 'share', path: '/share', icon: <Share2 className="w-5 h-5" /> },
  ] as const

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed top-[var(--header-height)] left-0 h-[calc(100vh-var(--header-height))]
          w-[var(--sidebar-width)] bg-[var(--color-brawl-dark)] border-r border-white/10
          z-50 transition-transform duration-300 ease-in-out
          md:translate-x-0 md:static flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <nav className="flex flex-col gap-2 p-4 flex-1">
          {NAV_ITEMS.map((item) => {
            const href = `${basePath}${item.path}`
            const isActive = pathname === href || (item.path === '' && pathname === basePath)

            return (
              <Link
                key={item.key}
                href={href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-['Inter'] font-medium transition-all group
                  ${isActive
                    ? 'bg-gradient-to-r from-[var(--color-brawl-blue)]/20 to-transparent border-l-2 border-[var(--color-brawl-blue)] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent'}
                `}
              >
                <span className={`transition-colors ${isActive ? 'text-[var(--color-brawl-blue)]' : 'group-hover:text-slate-300'}`}>
                  {item.icon}
                </span>
                <span>{t(item.key)}</span>
              </Link>
            )
          })}
        </nav>
        
        {/* Decorative element at the bottom of the sidebar */}
        <div className="p-4 mt-auto">
          <div className="w-full h-24 rounded-xl border border-white/5 bg-gradient-to-b from-white/5 to-transparent flex items-center justify-center relative overflow-hidden">
             <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--color-brawl-purple)] rounded-full filter blur-[30px] opacity-20"></div>
             <p className="text-[10px] text-slate-500 font-['Righteous'] uppercase tracking-widest relative z-10">Cyber-Brawl OS</p>
          </div>
        </div>
      </aside>
    </>
  )
}
