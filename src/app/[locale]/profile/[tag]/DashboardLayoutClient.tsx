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
    <div className="min-h-screen flex flex-col font-['Inter'] relative w-full">
      <Header playerTag={tag} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar tag={tag} locale={locale} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 relative">
          <div className="max-w-5xl mx-auto relative z-10 pb-20">
            {children}
          </div>
        </main>
      </div>
      
      <Footer />
    </div>
  )
}
