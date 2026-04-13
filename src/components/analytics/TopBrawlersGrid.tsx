'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
import type { TopBrawlerEntry, CounterEntry } from '@/lib/draft/pro-analysis'

interface Props {
  brawlers: TopBrawlerEntry[]
  totalBattles: number
  /**
   * Which aggregation tier produced `brawlers`.
   * Optional for backwards compatibility — defaults to 'map-mode'.
   * When 'mode-fallback', a yellow inline banner explains the substitution.
   * Added in Sprint C — spec §7.2.
   */
  source?: 'map-mode' | 'mode-fallback'
  /**
   * Optional array of counter entries keyed by brawlerId. When provided,
   * each brawler card renders its 3 best counters inline. Free users see
   * the 3 the API sends; premium users receive more and can tap "Ver más"
   * (rendered in a later iteration — Sprint C ships the 3-slot version).
   *
   * Added in Sprint C — spec §5.1 Track 5.
   */
  counters?: CounterEntry[]
}

function TrendBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null
  if (delta > 2) {
    return (
      <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-md">
        {'\u2191'}{delta.toFixed(1)}%
      </span>
    )
  }
  if (delta < -2) {
    return (
      <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-md">
        {'\u2193'}{Math.abs(delta).toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-md">
      {'\u2014'}
    </span>
  )
}

export function TopBrawlersGrid({
  brawlers,
  totalBattles,
  source = 'map-mode',
  counters,
}: Props) {
  const t = useTranslations('metaPro')

  // Build an O(1) lookup: brawlerId → CounterEntry
  const counterByBrawlerId = useMemo(() => {
    const map = new Map<number, CounterEntry>()
    if (counters) {
      for (const c of counters) map.set(c.brawlerId, c)
    }
    return map
  }, [counters])

  if (brawlers.length === 0) {
    return (
      <div className="brawl-card-dark p-5 border-[#090E17] text-center">
        <p className="text-sm text-slate-500">{t('noDataForMap')}</p>
      </div>
    )
  }

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      {source === 'mode-fallback' && (
        <div className="mb-3 px-3 py-2 bg-amber-400/10 border border-amber-400/30 rounded-lg">
          <p className="text-[11px] text-amber-300">
            <span className="mr-1">{'\u26A0\uFE0F'}</span>
            {t('modeFallbackBanner')}
          </p>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2">
            <span className="text-xl">{'\uD83C\uDFC6'}</span> {t('topBrawlersTitle')}
          </h3>
          <span className="text-[10px] text-slate-500 font-bold">
            {t('totalBattles', { count: String(totalBattles) })}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {t('topBrawlersSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {brawlers.map((b, i) => (
          <div
            key={b.brawlerId}
            className="brawl-row rounded-xl p-3 flex flex-col items-center gap-2 relative"
          >
            {i < 3 && (
              <span className="absolute top-1.5 left-2 text-sm">
                {i === 0 ? '\uD83E\uDD47' : i === 1 ? '\uD83E\uDD48' : '\uD83E\uDD49'}
              </span>
            )}

            <div className="absolute top-1.5 right-2">
              <ConfidenceBadge total={b.totalBattles} />
            </div>

            <BrawlImg
              src={getBrawlerPortraitUrl(b.brawlerId)}
              fallbackSrc={getBrawlerPortraitFallback(b.brawlerId)}
              alt={b.name}
              className="w-12 h-12 rounded-lg ring-2 ring-[#090E17]"
            />

            <p className="font-['Lilita_One'] text-xs text-white truncate max-w-full">
              {b.name}
            </p>

            <p className={`font-['Lilita_One'] text-lg tabular-nums ${wrColor(b.winRate)}`}>
              {b.winRate.toFixed(1)}%
            </p>

            <p className="text-[10px] text-slate-400 tabular-nums">
              {t('sampleSize', { count: b.totalBattles })}
            </p>

            <p className="text-[10px] text-slate-500 tabular-nums">
              {b.pickRate.toFixed(1)}% picks
            </p>

            <TrendBadge delta={b.trend7d} />

            {(() => {
              const entry = counterByBrawlerId.get(b.brawlerId)
              if (!entry || entry.bestCounters.length === 0) return null
              const visibleCounters = entry.bestCounters.slice(0, 3)
              return (
                <div className="w-full mt-1 pt-2 border-t border-white/5">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1 text-center">
                    {t('countersLabel')}
                  </p>
                  <div className="flex flex-col gap-1">
                    {visibleCounters.map((c) => (
                      <div
                        key={c.opponentId}
                        className="flex items-center gap-1.5 bg-[#0D1321] rounded-md px-1.5 py-1"
                      >
                        <BrawlImg
                          src={getBrawlerPortraitUrl(c.opponentId)}
                          fallbackSrc={getBrawlerPortraitFallback(c.opponentId)}
                          alt={c.name}
                          className="w-4 h-4 rounded-sm flex-shrink-0"
                        />
                        <span className="font-['Lilita_One'] text-[10px] text-white truncate flex-1">
                          {c.name}
                        </span>
                        <ConfidenceBadge total={c.total} />
                        <span className={`text-[9px] font-bold tabular-nums ${wrColor(c.winRate)}`}>
                          {Math.round(c.winRate)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        ))}
      </div>
    </div>
  )
}
