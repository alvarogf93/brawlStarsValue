import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Global Leaderboard',
  description: 'Check out the top Brawl Stars players with the highest Gem Value in the world.',
  openGraph: {
    title: 'Global Leaderboard | BrawlValue',
    description: 'Who has the most valuable Brawl Stars account? Check the global & local leaderboards.',
  }
}

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
