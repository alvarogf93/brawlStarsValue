'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback, wrColor } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { CounterEntry } from '@/lib/draft/pro-analysis'

interface Props {
  counters: CounterEntry[]
  isPremium: boolean
}

export function CounterQuickView({ counters, isPremium }: Props) {
  const t = useTranslations('metaPro')
  const [expanded, setExpanded] = useState(false)

  if (counters.length === 0) return null

  const INITIAL_LIMIT = isPremium ? 6 : 3
  const displayed = expanded ? counters : counters.slice(0, INITIAL_LIMIT)
  const hasMore = counters.length > INITIAL_LIMIT

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">{'\u2694\uFE0F'}</span> {t('counterTitle')}
      </h3>

      <div className="space-y-3">
        {displayed.map(entry => (
          <div key={entry.brawlerId} className="brawl-row rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <BrawlImg
                src={getBrawlerPortraitUrl(entry.brawlerId)}
                fallbackSrc={getBrawlerPortraitFallback(entry.brawlerId)}
                alt={entry.name}
                className="w-7 h-7 rounded-lg"
              />
              <p className="text-[11px] text-slate-400">
                {t('counterHint', { name: entry.name })}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {entry.bestCounters.slice(0, 3).map(counter => (
                <div
                  key={counter.opponentId}
                  className="flex items-center gap-1.5 bg-[#0D1321] rounded-lg px-2 py-1.5"
                >
                  <BrawlImg
                    src={getBrawlerPortraitUrl(counter.opponentId)}
                    fallbackSrc={getBrawlerPortraitFallback(counter.opponentId)}
                    alt={counter.name}
                    className="w-6 h-6 rounded-md"
                  />
                  <span className="font-['Lilita_One'] text-[11px] text-white truncate max-w-[60px]">
                    {counter.name}
                  </span>
                  <span className={`text-[10px] font-bold tabular-nums ${wrColor(counter.winRate)}`}>
                    {counter.winRate.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="mt-3 w-full py-2 text-xs font-bold text-slate-400 hover:text-[#FFC91B] transition-colors rounded-lg bg-white/[0.02] hover:bg-white/[0.04]"
        >
          {expanded ? '−' : `+${counters.length - INITIAL_LIMIT}`}
        </button>
      )}
    </div>
  )
}
