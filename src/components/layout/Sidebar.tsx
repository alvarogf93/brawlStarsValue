'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, Swords, BarChart3, Shield, GitCompareArrows, Palette, Share2, FlaskConical } from 'lucide-react'

interface SidebarProps {
  tag: string
  locale: string
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ tag, locale, isOpen, onClose }: SidebarProps) {
  const t = useTranslations('nav')
  const tLanding = useTranslations('landing')
  const pathname = usePathname()
  const basePath = `/${locale}/profile/${encodeURIComponent(tag)}`

  const NAV_ITEMS = [
    { key: 'overview', path: '', icon: <LayoutDashboard className="w-5 h-5" />, sub: [
      { key: 'cosmetics', path: '/cosmetics', icon: <Palette className="w-4 h-4" /> },
    ] },
    { key: 'brawlers', path: '/brawlers', icon: <Users className="w-5 h-5" /> },
    { key: 'battles', path: '/battles', icon: <Swords className="w-5 h-5" />, sub: [
      { key: 'picks', path: '/picks', icon: <Swords className="w-4 h-4" />, isGlobal: true },
    ] },
    { key: 'stats', path: '/stats', icon: <BarChart3 className="w-5 h-5" />, sub: [
      { key: 'analytics', path: '/analytics', icon: <FlaskConical className="w-4 h-4" /> },
    ] },
    { key: 'club', path: '/club', icon: <Shield className="w-5 h-5" /> },
    { key: 'compare', path: '/compare', icon: <GitCompareArrows className="w-5 h-5" /> },
    { key: 'share', path: '/share', icon: <Share2 className="w-5 h-5" /> },
  ]

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={onClose} aria-hidden="true" />
      )}

      {/* Sidebar: mobile=fixed overlay, desktop=static flex column inside parent */}
      <aside
        role="navigation"
        aria-label="Profile navigation"
        className={`
          w-[var(--sidebar-width)] bg-[#121A2F] border-r-4 border-[#0F172A]
          flex flex-col shrink-0 overflow-y-auto
          fixed inset-y-0 left-0 top-[var(--header-height)] z-50 transition-transform duration-300
          md:static md:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <nav className="flex flex-col gap-2 p-4 flex-1" aria-label="Profile sections">
          {NAV_ITEMS.map((item) => {
            const href = `${basePath}${item.path}`
            const isActive = pathname === href || (item.path === '' && pathname === basePath)

            return (
              <div key={item.key}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-4 py-2.5 rounded-xl text-base font-['Lilita_One'] transition-all group border-4
                    ${isActive
                      ? 'bg-[var(--color-brawl-gold)] text-[var(--color-brawl-dark)] border-[var(--color-brawl-dark)] shadow-[0_3px_0_0_rgba(18,26,47,1)] translate-y-[-1px]'
                      : 'bg-white/5 border-transparent text-white hover:bg-white/10'}
                  `}
                >
                  <span className={`transition-colors ${isActive ? 'text-[var(--color-brawl-dark)]' : 'group-hover:text-[var(--color-brawl-gold)]'}`}>
                    {item.icon}
                  </span>
                  <span>{t(item.key)}</span>
                </Link>

                {/* Sub-items */}
                {item.sub?.map((sub) => {
                  const subHref = (sub as { isGlobal?: boolean }).isGlobal ? `/${locale}${sub.path}` : `${basePath}${sub.path}`
                  const subActive = pathname === subHref
                  return (
                    <Link
                      key={sub.key}
                      href={subHref}
                      onClick={onClose}
                      className={`
                        flex items-center gap-2.5 ml-6 mt-1 px-3 py-2 rounded-lg text-sm font-['Lilita_One'] transition-all group border-2
                        ${subActive
                          ? 'bg-[var(--color-brawl-gold)]/80 text-[var(--color-brawl-dark)] border-[var(--color-brawl-dark)] shadow-[0_2px_0_0_rgba(18,26,47,1)]'
                          : 'bg-white/[0.03] border-transparent text-slate-400 hover:bg-white/10 hover:text-white'}
                      `}
                    >
                      <span className={subActive ? 'text-[var(--color-brawl-dark)]' : 'group-hover:text-[var(--color-brawl-gold)]'}>
                        {sub.icon}
                      </span>
                      <span>{t(sub.key)}</span>
                      {sub.key === 'analytics' && (
                        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[#FFC91B]/20 text-[#FFC91B] font-bold uppercase">PRO</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* BrawlVision branding footer */}
        <div className="p-4 shrink-0">
          <div className="w-full rounded-2xl border-4 border-[#0F172A] bg-gradient-to-r from-[#1C5CF1] to-[#121A2F] px-4 py-3 flex flex-col items-center justify-center overflow-hidden shadow-[0_3px_0_0_rgba(18,26,47,1)]">
            <span className="font-['Lilita_One'] text-xl text-[var(--color-brawl-gold)] text-stroke-brawl-brand tracking-wider transform rotate-[-1deg]">BrawlVision</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">combat analytics</span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2 text-[10px] text-slate-600">
            <Link href={`/${locale}/privacy`} className="hover:text-slate-400 transition-colors">{tLanding('privacyLink')}</Link>
            <span>·</span>
            <a href="mailto:contact@brawlvision.com" className="hover:text-slate-400 transition-colors">{tLanding('contact')}</a>
          </div>
        </div>
      </aside>
    </>
  )
}
