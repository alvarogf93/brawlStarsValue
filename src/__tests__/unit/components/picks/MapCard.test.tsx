import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      ended: 'Finalizado',
      limitedData: 'Datos limitados',
      noData: 'Sin datos aún',
      noDataContextual: 'Mapa nuevo — recolectando datos',
      modeFallbackBanner: 'Mostrando top del modo',
      showMore: 'Ver más',
      showLess: 'Ver menos',
      sampleSize: `${params?.count ?? '?'} batallas`,
    }
    return map[key] ?? key
  },
}))

vi.mock('@/components/ui/BrawlImg', () => ({
  BrawlImg: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

vi.mock('@/components/ui/ConfidenceBadge', () => ({
  ConfidenceBadge: ({ total }: { total: number }) => (
    <span data-confidence={total >= 10 ? 'high' : total >= 3 ? 'medium' : 'low'} />
  ),
}))

vi.mock('@/lib/utils', async () => ({
  getBrawlerPortraitUrl: (id: number) => `/p/${id}`,
  getBrawlerPortraitFallback: (id: number) => `/f/${id}`,
  getMapImageUrl: (id: number) => `/m/${id}`,
  getGameModeImageUrl: (mode: string) => `/g/${mode}`,
  wrColor: () => 'text-green-400',
  barGradient: () => 'from-green-400 to-green-600',
}))

import { MapCard } from '@/components/picks/MapCard'

const MOCK_TOP: Array<{ brawlerId: number; winRate: number; pickCount: number }> = [
  { brawlerId: 1, winRate: 62, pickCount: 142 },
  { brawlerId: 2, winRate: 58, pickCount: 98 },
  { brawlerId: 3, winRate: 56, pickCount: 75 },
]

function endTime(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 3600_000).toISOString()
}

describe('MapCard — Task 12', () => {
  it('renders the promoted sample size text', () => {
    render(
      <MapCard
        mode="brawlBall"
        map="Sidetrack"
        eventId={1}
        endTime={endTime(2)}
        totalBattles={1250}
        topBrawlers={MOCK_TOP}
      />,
    )
    expect(screen.getByText(/\b1250 batallas\b/)).toBeTruthy()
  })

  it('renders "limited data" amber warning when totalBattles < 100', () => {
    render(
      <MapCard
        mode="brawlBall"
        map="SparseMap"
        eventId={2}
        endTime={endTime(1)}
        totalBattles={12}
        topBrawlers={MOCK_TOP}
      />,
    )
    expect(screen.getByText('Datos limitados')).toBeTruthy()
  })

  it('renders the mode-fallback banner when source is "mode-fallback"', () => {
    render(
      <MapCard
        mode="heist"
        map="Pit Stop"
        eventId={3}
        endTime={endTime(1)}
        totalBattles={5}
        topBrawlers={MOCK_TOP}
        source="mode-fallback"
      />,
    )
    expect(screen.getByText(/Mostrando top del modo|modeFallbackBanner/i)).toBeTruthy()
  })

  it('renders contextual noData when topBrawlers is empty', () => {
    render(
      <MapCard
        mode="new"
        map="New Map"
        eventId={4}
        endTime={endTime(1)}
        totalBattles={0}
        topBrawlers={[]}
      />,
    )
    expect(screen.getByText(/noDataContextual|Mapa nuevo/i)).toBeTruthy()
  })

  it('omits the fallback banner when source is "map-mode" or missing', () => {
    const { container: c1 } = render(
      <MapCard mode="a" map="A" eventId={1} endTime={endTime(1)} totalBattles={500} topBrawlers={MOCK_TOP} source="map-mode" />,
    )
    expect(c1.textContent).not.toMatch(/modeFallbackBanner|Mostrando top del modo/)

    const { container: c2 } = render(
      <MapCard mode="a" map="A" eventId={1} endTime={endTime(1)} totalBattles={500} topBrawlers={MOCK_TOP} />,
    )
    expect(c2.textContent).not.toMatch(/modeFallbackBanner|Mostrando top del modo/)
  })
})
