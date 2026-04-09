'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import type { Profile } from '@/lib/supabase/types'
import { Lock } from 'lucide-react'
import { getMapImageUrl, getGameModeImageUrl } from '@/lib/utils'
import { isDraftMode } from '@/lib/draft/constants'

interface MapSelectorProps {
  selectedMap: string | null
  selectedMode: string | null
  onSelect: (map: string, mode: string, eventId: number) => void
}

interface LiveMap {
  map: string
  mode: string
  eventId: number
}

export function MapSelector({ selectedMap, selectedMode, onSelect }: MapSelectorProps) {
  const t = useTranslations('metaPro')
  const { profile } = useAuth()
  const hasPremium = isPremium(profile as Profile | null)

  const [maps, setMaps] = useState<LiveMap[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/events', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then((events: Array<{ startTime?: string; endTime?: string; event?: { id?: number; map?: string; mode?: string }; map?: string; mode?: string; id?: number }>) => {
        const liveMaps = events
          .map(e => {
            // Competitive events last 12h+ (24h typical). Fun/no-trophy events last 2h.
            let isCompetitive = true
            if (e.startTime && e.endTime) {
              const parse = (s: string) => new Date(
                s.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'),
              )
              const durationH = (parse(e.endTime).getTime() - parse(e.startTime).getTime()) / 3600000
              isCompetitive = durationH >= 12
            }
            return {
              eventId: e.event?.id ?? e.id,
              map: e.event?.map ?? e.map,
              mode: e.event?.mode ?? e.mode,
              isCompetitive,
            }
          })
          .filter((e): e is LiveMap & { isCompetitive: boolean } =>
            typeof e.eventId === 'number' &&
            typeof e.map === 'string' &&
            typeof e.mode === 'string' &&
            isDraftMode(e.mode) &&
            e.isCompetitive
          )

        setMaps(liveMaps)
        setLoading(false)

        if (!selectedMap && liveMaps.length > 0) {
          const first = liveMaps[0]
          onSelect(first.map, first.mode, first.eventId)
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') setLoading(false)
      })
    return () => controller.abort()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="brawl-card-dark p-4 border-[#090E17]">
        <div className="h-8 w-48 bg-white/5 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-4 md:p-5 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-sm text-slate-400 mb-3 uppercase tracking-wider">
        {t('mapSelectorTitle')}
      </h3>

      {/* Live maps grid */}
      <div className="mb-4">
        <p className="font-['Lilita_One'] text-[10px] text-green-400 uppercase tracking-wider mb-2">
          {t('liveMaps')}
        </p>

        {maps.length === 0 ? (
          <p className="text-xs text-slate-600 italic font-['Lilita_One']">—</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {maps.map(m => {
              const isSelected = selectedMap === m.map && selectedMode === m.mode
              const mapImageUrl = getMapImageUrl(m.eventId)
              const modeIconUrl = getGameModeImageUrl(m.mode)

              return (
                <button
                  key={`${m.map}-${m.mode}-${m.eventId}`}
                  onClick={() => onSelect(m.map, m.mode, m.eventId)}
                  className={`relative h-24 overflow-hidden rounded-xl border-2 transition-all duration-200 text-left ${
                    isSelected
                      ? 'border-[#FFC91B] shadow-[0_0_16px_rgba(255,201,27,0.35)]'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  {/* Map image background */}
                  <img
                    src={mapImageUrl}
                    alt={m.map}
                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                    loading="lazy"
                    width={200}
                    height={96}
                  />

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E1A] via-[#0A0E1A]/60 to-transparent" />

                  {/* Selected gold tint overlay */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-[#FFC91B]/8" />
                  )}

                  {/* Mode icon — top-left */}
                  {modeIconUrl && (
                    <div className="absolute top-2 left-2">
                      <span className="bg-black/50 backdrop-blur-sm rounded-lg p-1 border border-white/10 inline-flex">
                        <img
                          src={modeIconUrl}
                          alt={m.mode}
                          className="w-4 h-4"
                          width={16}
                          height={16}
                        />
                      </span>
                    </div>
                  )}

                  {/* Map name — bottom */}
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className={`font-['Lilita_One'] text-xs leading-tight truncate ${
                      isSelected ? 'text-[#FFC91B]' : 'text-white'
                    }`}>
                      {m.map}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Historical maps section */}
      <div>
        <p className="font-['Lilita_One'] text-[10px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          {t('historicalMaps')}
          {!hasPremium && <Lock className="w-3 h-3" />}
        </p>
        {!hasPremium ? (
          <p className="font-['Lilita_One'] text-xs text-slate-600 italic">{t('historicalLocked')}</p>
        ) : (
          <p className="font-['Lilita_One'] text-xs text-slate-500 italic">{t('historicalMaps')}</p>
        )}
      </div>
    </div>
  )
}
