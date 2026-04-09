'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { Footer } from '@/components/common/Footer'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import type { Profile } from '@/lib/supabase/types'

const AUTO_SYNC_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])
  const params = useParams<{ tag: string; locale: string }>()
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()

  const tag = decodeURIComponent(params.tag)
  const locale = params.locale

  // Redirect logged-in users away from non-existent player profiles to their own
  useEffect(() => {
    if (authLoading) return
    if (!user || !profile?.player_tag) return
    // Don't check if viewing own profile
    if (tag.toUpperCase() === profile.player_tag.toUpperCase()) return

    fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerTag: tag }),
    }).then(res => {
      if (!res.ok) {
        router.replace(`/${locale}/profile/${encodeURIComponent(profile.player_tag)}`)
      }
    }).catch(() => {
      // Network error — don't redirect
    })
  }, [tag, user, profile, authLoading, locale, router])

  // Auto-sync battles for premium users when visiting their own profile (if stale)
  useEffect(() => {
    if (authLoading) return
    if (!user || !profile?.player_tag) return
    if (!isPremium(profile as Profile)) return
    // Only auto-sync when viewing own profile
    if (tag.toUpperCase() !== profile.player_tag.toUpperCase()) return

    const lastSync = profile.last_sync ? new Date(profile.last_sync).getTime() : 0
    if (Date.now() - lastSync < AUTO_SYNC_INTERVAL_MS) return

    // Fire-and-forget sync
    fetch('/api/sync', { method: 'POST' }).catch(() => {})
  }, [tag, user, profile, authLoading])

  return (
    <div className="h-dvh flex flex-col font-['Inter'] w-full">
      {/* Fixed header */}
      <Header playerTag={tag} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Body: sidebar + main — fills remaining height */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar tag={tag} locale={locale} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Scrollable main content — lock scroll when mobile sidebar is open */}
        <main className={`flex-1 min-h-0 ${sidebarOpen ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div className="max-w-5xl mx-auto p-4 sm:p-8 pb-16 min-h-full">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Sticky footer — always visible at bottom */}
      <Footer />
    </div>
  )
}
