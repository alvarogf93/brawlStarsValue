'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { ProBadge } from '@/components/analytics/ProBadge'

interface DailyPoint {
  date: string
  wins: number
  total: number
  winRate: number
  trophyChange: number
  cumulativeTrophies: number
}

interface Props {
  dailyTrend: DailyPoint[]
  proAvgWR?: number | null
}

/** SVG chart padding */
const PAD = { top: 10, right: 20, bottom: 30, left: 40 } as const
const CHART_W = 600
const CHART_H = 180
const INNER_W = CHART_W - PAD.left - PAD.right
const INNER_H = CHART_H - PAD.top - PAD.bottom

const GREEN = '#4ade80'
const RED = '#ef4444'

/* ─────────────────────── helpers ─────────────────────── */

function formatLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
}

/** Pick ~5-7 evenly-spaced indices for X-axis labels */
function pickLabelIndices(total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  const target = 6
  const step = (total - 1) / (target - 1)
  const indices: number[] = []
  for (let i = 0; i < target; i++) {
    indices.push(Math.round(i * step))
  }
  return indices
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

/* ─────────────────────── sub-components ─────────────────────── */

interface TooltipInfo {
  x: number
  y: number
  label: string
  lines: string[]
}

function ChartTooltip({ info }: { info: TooltipInfo | null }) {
  if (!info) return null

  const tooltipW = 130
  const tooltipH = 14 + info.lines.length * 16
  const tx = info.x + tooltipW + 10 > CHART_W ? info.x - tooltipW - 8 : info.x + 8
  const ty = clamp(info.y - tooltipH / 2, 2, CHART_H - tooltipH - 2)

  return (
    <g>
      <rect
        x={tx}
        y={ty}
        width={tooltipW}
        height={tooltipH}
        rx={6}
        fill="#0D1321"
        stroke="#1e293b"
        strokeWidth={1}
        opacity={0.95}
      />
      <text x={tx + 8} y={ty + 14} fontSize={10} fontWeight={700} fill="#94a3b8">
        {info.label}
      </text>
      {info.lines.map((line, i) => (
        <text
          key={i}
          x={tx + 8}
          y={ty + 14 + (i + 1) * 16}
          fontSize={11}
          fontWeight={600}
          fill="#e2e8f0"
        >
          {line}
        </text>
      ))}
    </g>
  )
}

interface LineChartProps {
  data: DailyPoint[]
  getValue: (d: DailyPoint) => number
  yMin: number
  yMax: number
  yTicks: number[]
  formatY: (v: number) => string
  tooltipLines: (d: DailyPoint) => string[]
  referenceLine?: number
  colorFn: (value: number) => string
}

function LineChart({
  data,
  getValue,
  yMin,
  yMax,
  yTicks,
  formatY,
  tooltipLines,
  referenceLine,
  colorFn,
}: LineChartProps) {
  const [hover, setHover] = useState<TooltipInfo | null>(null)

  const labelIndices = useMemo(() => pickLabelIndices(data.length), [data.length])

  const toX = (i: number) =>
    PAD.left + (data.length === 1 ? INNER_W / 2 : (i / (data.length - 1)) * INNER_W)

  const toY = (v: number) => {
    const range = yMax - yMin || 1
    return PAD.top + INNER_H - ((v - yMin) / range) * INNER_H
  }

  const points = data.map((d, i) => ({ x: toX(i), y: toY(getValue(d)) }))
  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(' ')

  // Build gradient segments: for each pair of consecutive points, use color of their average
  const segmentPairs = data.map((d, i) => ({
    x: points[i].x,
    y: points[i].y,
    color: colorFn(getValue(d)),
  }))

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Y-axis grid + labels */}
      {yTicks.map((tick) => {
        const y = toY(tick)
        return (
          <g key={tick}>
            <line
              x1={PAD.left}
              y1={y}
              x2={CHART_W - PAD.right}
              y2={y}
              stroke="#1e293b"
              strokeWidth={0.5}
            />
            <text
              x={PAD.left - 6}
              y={y + 3}
              textAnchor="end"
              fontSize={9}
              fill="#64748b"
            >
              {formatY(tick)}
            </text>
          </g>
        )
      })}

      {/* Reference line (e.g. 50% win rate) */}
      {referenceLine !== undefined && (
        <line
          x1={PAD.left}
          y1={toY(referenceLine)}
          x2={CHART_W - PAD.right}
          y2={toY(referenceLine)}
          stroke="#64748b"
          strokeWidth={1}
          strokeDasharray="6 4"
          opacity={0.6}
        />
      )}

      {/* X-axis labels */}
      {labelIndices.map((idx) => (
        <text
          key={idx}
          x={toX(idx)}
          y={CHART_H - 4}
          textAnchor="middle"
          fontSize={9}
          fill="#64748b"
        >
          {formatLabel(data[idx].date)}
        </text>
      ))}

      {/* Line segments with per-segment color */}
      {segmentPairs.map((seg, i) => {
        if (i === 0) return null
        const prev = segmentPairs[i - 1]
        return (
          <line
            key={i}
            x1={prev.x}
            y1={prev.y}
            x2={seg.x}
            y2={seg.y}
            stroke={seg.color}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )
      })}

      {/* Invisible wider polyline for easier hover detection */}
      <polyline
        points={polylineStr}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
      />

      {/* Data point dots */}
      {points.map((p, i) => {
        const d = data[i]
        const color = colorFn(getValue(d))
        return (
          <g key={i}>
            {/* Outer glow ring */}
            <circle cx={p.x} cy={p.y} r={6} fill={color} opacity={0.15} />
            {/* Filled dot */}
            <circle cx={p.x} cy={p.y} r={3.5} fill={color} stroke="#0D1321" strokeWidth={1.5} />
            {/* Invisible hit area */}
            <circle
              cx={p.x}
              cy={p.y}
              r={14}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() =>
                setHover({
                  x: p.x,
                  y: p.y,
                  label: d.date,
                  lines: tooltipLines(d),
                })
              }
              onMouseLeave={() => setHover(null)}
            />
          </g>
        )
      })}

      <ChartTooltip info={hover} />
    </svg>
  )
}

/* ─────────────────────── main component ─────────────────────── */

export function TrendsChart({ dailyTrend, proAvgWR }: Props) {
  const t = useTranslations('advancedAnalytics')

  if (dailyTrend.length === 0) {
    return (
      <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-3 flex items-center gap-2">
          <span className="text-xl">📈</span> {t('trendsTitle')}
          <InfoTooltip className="ml-1.5" text={t('tipTrends')} />
        </h3>
        <p className="text-slate-500 text-sm text-center py-6">
          {t('trendsEmpty')}
        </p>
      </div>
    )
  }

  const trophyValues = dailyTrend.map((d) => d.cumulativeTrophies)
  const trophyMin = Math.min(...trophyValues)
  const trophyMax = Math.max(...trophyValues)
  const trophyPad = Math.max(Math.ceil(Math.abs(trophyMax - trophyMin) * 0.15), 5)
  const tMin = Math.floor((trophyMin - trophyPad) / 5) * 5
  const tMax = Math.ceil((trophyMax + trophyPad) / 5) * 5
  const trophyStep = Math.max(Math.round((tMax - tMin) / 4), 1)
  const trophyTicks: number[] = []
  for (let v = tMin; v <= tMax; v += trophyStep) trophyTicks.push(v)
  if (!trophyTicks.includes(0) && tMin <= 0 && tMax >= 0) trophyTicks.push(0)
  trophyTicks.sort((a, b) => a - b)

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-5 flex items-center gap-2">
        <span className="text-xl">📈</span> {t('trendsTitle')}
        <InfoTooltip className="ml-1.5" text={t('tipTrends')} />
      </h3>

      <div className="space-y-6">
        {/* ── Chart 1: Win Rate Trend ── */}
        <div>
          <p className="text-xs font-bold uppercase text-slate-500 mb-2 tracking-wider flex items-center">
            {t('winRateTrend')}
            {proAvgWR != null && (
              <span className="ml-2">
                <ProBadge proValue={proAvgWR} total={0} compact />
              </span>
            )}
          </p>
          <LineChart
            data={dailyTrend}
            getValue={(d) => d.winRate}
            yMin={0}
            yMax={100}
            yTicks={[0, 25, 50, 75, 100]}
            formatY={(v) => `${v}%`}
            referenceLine={50}
            colorFn={(v) => (v >= 50 ? GREEN : RED)}
            tooltipLines={(d) => [
              `WR: ${d.winRate.toFixed(1)}%`,
              `${d.wins}W / ${d.total - d.wins}L`,
            ]}
          />
        </div>

        {/* ── Chart 2: Trophy Progression ── */}
        <div>
          <p className="text-xs font-bold uppercase text-slate-500 mb-2 tracking-wider">
            {t('trophyProgression')}
          </p>
          <LineChart
            data={dailyTrend}
            getValue={(d) => d.cumulativeTrophies}
            yMin={tMin}
            yMax={tMax}
            yTicks={trophyTicks}
            formatY={(v) => (v >= 0 ? `+${v}` : `${v}`)}
            referenceLine={tMin <= 0 && tMax >= 0 ? 0 : undefined}
            colorFn={(v) => (v >= 0 ? GREEN : RED)}
            tooltipLines={(d) => [
              `Total: ${d.cumulativeTrophies >= 0 ? '+' : ''}${d.cumulativeTrophies}`,
              `Day: ${d.trophyChange >= 0 ? '+' : ''}${d.trophyChange}`,
            ]}
          />
        </div>
      </div>
    </div>
  )
}
