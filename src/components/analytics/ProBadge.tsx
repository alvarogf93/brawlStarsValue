'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface ProBadgeProps {
  proValue: number
  userValue?: number
  total: number
  compact?: boolean
}

export function ProBadge({ proValue, userValue, total, compact = false }: ProBadgeProps) {
  const t = useTranslations('metaPro')
  const [showTooltip, setShowTooltip] = useState(false)

  const gap = userValue !== undefined ? userValue - proValue : null
  const gapColor = gap !== null
    ? gap > 3 ? 'text-green-400' : gap < -3 ? 'text-red-400' : 'text-[#FFC91B]'
    : ''
  const gapArrow = gap !== null
    ? gap > 3 ? '\u2191' : gap < -3 ? '\u2193' : '\u2014'
    : ''

  if (compact) {
    return (
      <span className="text-[#FFC91B] text-[10px] font-bold tracking-wide whitespace-nowrap">
        PRO {proValue.toFixed(1)}%
      </span>
    )
  }

  return (
    <div
      className="relative inline-flex items-center gap-1"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onTouchStart={() => setShowTooltip(prev => !prev)}
    >
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFC91B]/15 border border-[#FFC91B]/30">
        <span className="text-[#FFC91B] text-[10px] font-bold">PRO</span>
        <span className="text-white text-[10px] font-bold tabular-nums">
          {proValue.toFixed(1)}%
        </span>
        {gap !== null && (
          <span className={`text-[10px] font-bold ${gapColor}`}>
            {gapArrow}
          </span>
        )}
      </span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-[#0D1321] border border-[#1E293B] rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
            <p className="text-[10px] text-slate-400">
              {t('proBadgeTooltip', { count: String(total) })}
            </p>
            <p className="text-xs font-bold text-[#FFC91B]">
              {t('proWR', { wr: proValue.toFixed(1) })}
            </p>
            {userValue !== undefined && (
              <>
                <p className="text-xs font-bold text-white">
                  {t('yourWR', { wr: userValue.toFixed(1) })}
                </p>
                <p className={`text-xs font-bold ${gapColor}`}>
                  {gap !== null && gap > 0 ? '+' : ''}{gap?.toFixed(1)}pp
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
