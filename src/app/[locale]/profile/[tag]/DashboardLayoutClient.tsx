'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { Footer } from '@/components/common/Footer'

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const params = useParams<{ tag: string; locale: string }>()

  const tag = decodeURIComponent(params.tag)
  const locale = params.locale

  return (
    <div className="h-dvh flex flex-col font-['Inter'] w-full">
      {/* Fixed header */}
      <Header playerTag={tag} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Body: sidebar + main — fills remaining height */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar tag={tag} locale={locale} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Scrollable main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-4 sm:p-8 pb-16">
            {children}
          </div>
        </main>
      </div>

      {/* Sticky footer — always visible at bottom */}
      <Footer />
    </div>
  )
}
