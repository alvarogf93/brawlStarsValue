'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { getMapImageUrl } from '@/lib/utils'
import type { DraftMode } from '@/lib/draft/constants'
import { Radio } from 'lucide-react'

interface MapEntry {
  map: string
  eventId: number | null
  isLive: boolean
}

interface Props {
  mode: DraftMode
  onSelect: (map: string, eventId: number) => void
}

export function MapSelector({ mode, onSelect }: Props) {
  const t = useTranslations('draft')
  const [maps, setMaps] = useState<MapEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/draft/maps?mode=${mode}`)
      .then(r => r.json())
      .then(data => setMaps(data.maps ?? []))
      .catch(() => setMaps([]))
      .finally(() => setLoading(false))
  }, [mode])

  if (loading) {
    return (
      <div className="flex flex-wrap gap-3 justify-center">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-40 h-28 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  if (maps.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="font-['Lilita_One'] text-sm text-slate-300">{t('noMapsForMode')}</p>
      </div>
    )
  }

  return (
    <div className="text-center">
      <h3 className="font-['Lilita_One'] text-xl text-white mb-4">{t('selectMap')}</h3>
      <div className="flex flex-wrap gap-3 justify-center">
        {maps.map(m => (
          <button
            key={m.map}
            onClick={() => onSelect(m.map, m.eventId ?? 0)}
            className={`relative w-44 h-28 rounded-xl overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 cursor-pointer group ${
              m.isLive ? 'border-green-500/40 hover:border-green-400/70' : 'border-white/10 hover:border-[#FFC91B]/50'
            }`}
          >
            {/* Map image (only if we have an eventId) */}
            {m.eventId ? (
              <img
                src={getMapImageUrl(m.eventId)}
                alt={m.map}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
                width={176}
                height={112}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#1C5CF1]/20 to-[#121A2F]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

            {/* Live badge */}
            {m.isLive && (
              <span className="absolute top-2 right-2 flex items-center gap-1 bg-green-500/80 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                <Radio className="w-2.5 h-2.5" /> LIVE
              </span>
            )}

            {/* Map name */}
            <span className="absolute bottom-2 left-2 right-2 font-['Lilita_One'] text-sm text-white text-stroke-brawl leading-tight text-left">
              {m.map}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
