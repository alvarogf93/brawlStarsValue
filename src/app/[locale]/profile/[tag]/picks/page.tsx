'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { MapCard } from '@/components/picks/MapCard'
import { Loader2 } from 'lucide-react'

interface TopBrawler {
  brawlerId: number
  winRate: number
  pickCount: number
}

interface MetaEvent {
  mode: string
  map: string
  eventId: number
  startTime: string
  endTime: string
  totalBattles: number
  topBrawlers: TopBrawler[]
}

export default function ProfilePicksPage() {
  const t = useTranslations('picks')
  const [events, setEvents] = useState<MetaEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/meta')
      .then(r => r.json())
      .then(data => setEvents(data.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-['Lilita_One'] text-2xl md:text-3xl text-white flex items-center gap-3">
          <span className="text-3xl">⚔️</span> {t('title')}
        </h1>
        <p className="text-sm text-slate-400 mt-1 ml-12">{t('subtitle')}</p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#FFC91B] animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="brawl-card-dark p-10 text-center border-[#090E17]">
          <span className="text-4xl block mb-3">📊</span>
          <p className="font-['Lilita_One'] text-lg text-slate-300">{t('collecting')}</p>
          <p className="text-sm text-slate-500 mt-2">{t('collectingHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map(event => (
            <MapCard
              key={`${event.mode}-${event.map}`}
              mode={event.mode}
              map={event.map}
              eventId={event.eventId}
              endTime={event.endTime}
              totalBattles={event.totalBattles}
              topBrawlers={event.topBrawlers}
            />
          ))}
        </div>
      )}
    </div>
  )
}
