import type { Metadata } from 'next'
import { DashboardLayoutClient } from './DashboardLayoutClient'

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params
  const cleanTag = decodeURIComponent(tag).replace('#', '')
  
  return {
    title: `Player #${cleanTag.toUpperCase()} Stats`,
    description: `View Brawl Stars statistics, progression, and gem value for player #${cleanTag.toUpperCase()} on BrawlVision.`,
    openGraph: {
      title: `Player #${cleanTag.toUpperCase()} | BrawlVision Stats`,
      description: `View detailed brawlers, stats, and gem value for #${cleanTag.toUpperCase()}`,
      url: `https://brawlvision.com/profile/${cleanTag}`,
    }
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>
}
