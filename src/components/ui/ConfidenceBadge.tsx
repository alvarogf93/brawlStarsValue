'use client'

import { useTranslations } from 'next-intl'
import { getConfidence, type Confidence } from '@/lib/analytics/types'

const DOT_COLORS: Record<Confidence, string> = {
  high: 'bg-green-400',
  medium: 'bg-amber-400',
  low: 'bg-slate-600',
}

const TOOLTIP_KEYS: Record<Confidence, string> = {
  high: 'confidenceHigh',
  medium: 'confidenceMedium',
  low: 'confidenceLow',
}

interface Props {
  total: number
  className?: string
}

export function ConfidenceBadge({ total, className = '' }: Props) {
  const t = useTranslations('advancedAnalytics')

  if (total === 0) return null

  const confidence = getConfidence(total)
  const isLow = confidence === 'low'

  return (
    <span
      className={`inline-flex items-center ${isLow ? 'opacity-50' : ''} ${className}`}
      title={t(TOOLTIP_KEYS[confidence])}
    >
      <span
        data-confidence={confidence}
        className={`w-2 h-2 rounded-full ${DOT_COLORS[confidence]} inline-block shrink-0`}
      />
    </span>
  )
}
