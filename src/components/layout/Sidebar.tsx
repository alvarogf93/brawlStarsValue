'use client'

import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, BarChart3, Share2, Package } from 'lucide-react'

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
          w-[var(--sidebar-width)] bg-[#121A2F] border-r-4 border-[#0F172A]
          z-50 transition-transform duration-300 ease-in-out
          md:translate-x-0 md:static flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <nav className="flex flex-col gap-3 p-4 flex-1">
          {NAV_ITEMS.map((item) => {
            const href = `${basePath}${item.path}`
            const isActive = pathname === href || (item.path === '' && pathname === basePath)

            return (
              <Link
                key={item.key}
                href={href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-['Lilita_One'] transition-all group border-4
                  ${isActive
                    ? 'bg-[var(--color-brawl-gold)] text-[var(--color-brawl-dark)] border-[var(--color-brawl-dark)] shadow-[0_4px_0_0_rgba(18,26,47,1)] translate-y-[-2px]'
                    : 'bg-white/5 border-transparent text-white hover:bg-white/10'}
                `}
              >
                <span className={`transition-colors ${isActive ? 'text-[var(--color-brawl-dark)]' : 'group-hover:text-[var(--color-brawl-gold)]'}`}>
                  {item.icon}
                </span>
                <span>{t(item.key)}</span>
              </Link>
            )
          })}
        </nav>
        
        {/* Decorative element at the bottom of the sidebar */}
        <div className="p-4 mt-auto">
          <div className="w-full h-24 rounded-2xl border-4 border-[#0F172A] bg-[var(--color-brawl-sky)] flex items-center justify-center relative overflow-hidden shadow-[0_4px_0_0_rgba(18,26,47,1)]">
             <p className="text-[14px] text-[var(--color-brawl-dark)] font-['Lilita_One'] uppercase tracking-widest relative z-10 transform -rotate-6 filter drop-shadow-md">Auth. OS</p>
          </div>
        </div>
      </aside>
    </>
  )
}
