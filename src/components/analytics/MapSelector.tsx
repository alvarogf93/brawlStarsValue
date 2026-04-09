'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useMapImages } from '@/hooks/useMapImages'
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import type { Profile } from '@/lib/supabase/types'
import { ModeIcon } from '@/components/ui/ModeIcon'
import { Lock } from 'lucide-react'

interface MapSelectorProps {
  selectedMap: string | null
  selectedMode: string | null
  onSelect: (map: string, mode: string) => void
}

export function MapSelector({ selectedMap, selectedMode, onSelect }: MapSelectorProps) {
  const t = useTranslations('metaPro')
  const { profile } = useAuth()
  const hasPremium = isPremium(profile as Profile | null)
  const mapImages = useMapImages()

  const [maps, setMaps] = useState<Array<{ map: string; mode: string; isLive: boolean }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/events', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then((events: Array<{ map?: string; mode?: string; event?: { map: string; mode: string } }>) => {
        const liveMaps = events
          .map(e => ({ map: e.event?.map ?? e.map, mode: e.event?.mode ?? e.mode }))
          .filter((e): e is { map: string; mode: string } => !!e.map && !!e.mode)
          .map(e => ({ map: e.map, mode: e.mode, isLive: true }))
        setMaps(liveMaps)
        setLoading(false)
        if (!selectedMap && liveMaps.length > 0) {
          onSelect(liveMaps[0].map, liveMaps[0].mode)
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') setLoading(false)
      })
    return () => controller.abort()
  }, [mapImages]) // eslint-disable-line react-hooks/exhaustive-deps

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

      <div className="mb-4">
        <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-2">
          {t('liveMaps')}
        </p>
        <div className="flex flex-wrap gap-2">
          {maps.filter(m => m.isLive).map(m => (
            <button
              key={`${m.map}-${m.mode}`}
              onClick={() => onSelect(m.map, m.mode)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-['Lilita_One'] transition-all border-2 ${
                selectedMap === m.map && selectedMode === m.mode
                  ? 'bg-[#FFC91B]/20 text-[#FFC91B] border-[#FFC91B]/40 shadow-[0_0_12px_rgba(255,201,27,0.15)]'
                  : 'bg-[#0F172A] text-slate-300 border-[#1E293B] hover:bg-[#1E293B] hover:text-white'
              }`}
            >
              <ModeIcon mode={m.mode} size={16} />
              <span className="truncate max-w-[120px]">{m.map}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          {t('historicalMaps')}
          {!hasPremium && <Lock className="w-3 h-3" />}
        </p>
        {!hasPremium ? (
          <p className="text-xs text-slate-600 italic">{t('historicalLocked')}</p>
        ) : (
          <p className="text-xs text-slate-500 italic">{t('historicalMaps')}</p>
        )}
      </div>
    </div>
  )
}
