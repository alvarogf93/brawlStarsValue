'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { getMapImageUrl } from '@/lib/utils'
import type { DraftMode } from '@/lib/draft/constants'
import { isDraftMode } from '@/lib/draft/constants'

interface EventSlot {
  event: { id: number; mode: string; map: string }
  endTime: string
}

interface Props {
  mode: DraftMode
  onSelect: (map: string, eventId: number) => void
}

export function MapSelector({ mode, onSelect }: Props) {
  const t = useTranslations('draft')
  const [maps, setMaps] = useState<{ map: string; eventId: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/events')
      .then(r => r.json())
      .then((events: EventSlot[]) => {
        const matching = events
          .filter(e => e.event.mode === mode && isDraftMode(e.event.mode))
          .map(e => ({ map: e.event.map, eventId: e.event.id }))
        setMaps(matching)
        // Auto-select if only 1 map
        if (matching.length === 1) {
          onSelect(matching[0].map, matching[0].eventId)
        }
      })
      .catch(() => setMaps([]))
      .finally(() => setLoading(false))
  }, [mode, onSelect])

  if (loading) {
    return (
      <div className="flex gap-3 justify-center">
        {[1, 2].map(i => (
          <div key={i} className="w-40 h-28 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  if (maps.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-400 font-['Lilita_One']">{t('noMapsForMode')}</p>
      </div>
    )
  }

  return (
    <div className="text-center">
      <h3 className="font-['Lilita_One'] text-xl text-white mb-4">{t('selectMap')}</h3>
      <div className="flex flex-wrap gap-3 justify-center">
        {maps.map(m => (
          <button
            key={m.eventId}
            onClick={() => onSelect(m.map, m.eventId)}
            className="relative w-44 h-28 rounded-xl overflow-hidden border-2 border-white/10 hover:border-[#FFC91B]/50 transition-all hover:scale-105 active:scale-95 cursor-pointer group"
          >
            <img
              src={getMapImageUrl(m.eventId)}
              alt={m.map}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              width={176}
              height={112}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <span className="absolute bottom-2 left-2 right-2 font-['Lilita_One'] text-sm text-white text-stroke-brawl leading-tight text-left">
              {m.map}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
