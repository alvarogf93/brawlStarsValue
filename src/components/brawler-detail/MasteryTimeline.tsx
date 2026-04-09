'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import type { BrawlerMastery } from '@/lib/analytics/types'

interface Props {
  mastery: BrawlerMastery | null
}

/* ── Chart layout constants ─────────────────────────────────────── */
const PADDING = { top: 24, right: 24, bottom: 44, left: 52 }
const VIEW_W = 600
const VIEW_H = 260
const PLOT_W = VIEW_W - PADDING.left - PADDING.right
const PLOT_H = VIEW_H - PADDING.top - PADDING.bottom

const GOLD = '#FFC91B'
const Y_TICKS = [0, 25, 50, 75, 100]

export function MasteryTimeline({ mastery }: Props) {
  const t = useTranslations('brawlerDetail')

  /* ── Compute cumulative WR at each point ────────────────────── */
  const points = useMemo(() => {
    if (!mastery?.points || mastery.points.length < 2) return null

    let totalSoFar = 0
    let winsSoFar = 0

    return mastery.points.map((p) => {
      totalSoFar += p.total
      winsSoFar += p.wins
      const wr = totalSoFar > 0 ? (winsSoFar / totalSoFar) * 100 : 0
      return { date: p.date, wr }
    })
  }, [mastery])

  if (!points) return null

  /* ── Map data to SVG coordinates ────────────────────────────── */
  const coords = points.map((p, i) => ({
    x: PADDING.left + (i / (points.length - 1)) * PLOT_W,
    y: PADDING.top + PLOT_H - (p.wr / 100) * PLOT_H,
    wr: p.wr,
    date: p.date,
  }))

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`)
    .join(' ')

  const areaPath = `${linePath} L${coords[coords.length - 1].x},${PADDING.top + PLOT_H} L${coords[0].x},${PADDING.top + PLOT_H} Z`

  /* ── X-axis label sampling ──────────────────────────────────── */
  const maxLabels = 6
  const step = Math.max(1, Math.ceil(points.length / maxLabels))
  const xLabels = points
    .map((p, i) => ({ index: i, label: formatDate(p.date) }))
    .filter((_, i) => i % step === 0 || i === points.length - 1)

  /* ── Improvement detection ──────────────────────────────────── */
  const firstWR = points[0].wr
  const lastWR = points[points.length - 1].wr
  const improved = lastWR > firstWR
  const diff = Math.abs(lastWR - firstWR).toFixed(1)
  const daySpan = daysBetween(points[0].date, points[points.length - 1].date)

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white flex items-center gap-2 mb-4">
        <span aria-hidden>📈</span>
        {t('mastery')}
      </h3>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t('mastery')}
        className="block"
      >
        {/* Y-axis grid lines + labels */}
        {Y_TICKS.map((tick) => {
          const y = PADDING.top + PLOT_H - (tick / 100) * PLOT_H
          return (
            <g key={tick}>
              <line
                x1={PADDING.left}
                x2={PADDING.left + PLOT_W}
                y1={y}
                y2={y}
                stroke="#1E293B"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 8}
                y={y + 4}
                textAnchor="end"
                fill="#64748B"
                fontSize={11}
                fontFamily="Inter, sans-serif"
              >
                {tick}%
              </text>
            </g>
          )
        })}

        {/* X-axis labels */}
        {xLabels.map(({ index, label }) => (
          <text
            key={index}
            x={coords[index].x}
            y={PADDING.top + PLOT_H + 20}
            textAnchor="middle"
            fill="#64748B"
            fontSize={10}
            fontFamily="Inter, sans-serif"
          >
            {label}
          </text>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={GOLD} opacity={0.05} />

        {/* Animated line */}
        <motion.path
          d={linePath}
          stroke={GOLD}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
        />

        {/* Data point dots */}
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={3} fill={GOLD} />
        ))}
      </svg>

      {/* Improvement message */}
      {improved && (
        <p className="mt-3 text-sm text-emerald-400 font-['Inter']">
          {t('improved', { diff, days: daySpan })}
        </p>
      )}
    </div>
  )
}

/* ── Helpers ────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  const d = new Date(iso)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${month}/${day}`
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  return Math.max(1, Math.round(ms / 86_400_000))
}
