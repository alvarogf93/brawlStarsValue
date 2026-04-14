'use client'

import { useState, useMemo, useId } from 'react'
import { useTranslations, useLocale } from 'next-intl'
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
const PAD = { top: 20, right: 30, bottom: 30, left: 40 } as const
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

function formatTooltipDate(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const date = new Date(Date.UTC(y, m - 1, d))
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(date)
  } catch {
    return dateStr
  }
}

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
  accentColor?: string
}

const TT_WIDTH = 170
const TT_HEADER_H = 32
const TT_LINE_H = 20
const TT_PAD_Y = 10
const TT_MARGIN = 12

function ChartTooltip({ info }: { info: TooltipInfo | null }) {
  if (!info) return null

  const tooltipH = TT_HEADER_H + info.lines.length * TT_LINE_H + TT_PAD_Y
  const flipLeft = info.x + TT_WIDTH + TT_MARGIN > CHART_W
  const tx = flipLeft
    ? clamp(info.x - TT_WIDTH - TT_MARGIN, 2, CHART_W - TT_WIDTH - 2)
    : clamp(info.x + TT_MARGIN, 2, CHART_W - TT_WIDTH - 2)
  const ty = clamp(info.y - tooltipH / 2, 2, CHART_H - tooltipH - 2)

  const accent = info.accentColor ?? 'rgba(255,255,255,0.15)'

  return (
    <foreignObject x={tx} y={ty} width={TT_WIDTH} height={tooltipH} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'rgba(10,16,29,0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderLeft: `4px solid ${accent}`,
          borderRadius: 8,
          padding: '8px 12px',
          boxSizing: 'border-box',
          boxShadow: `0 8px 24px rgba(0,0,0,0.8), 0 0 10px ${accent}40`,
          fontFamily: 'Inter, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            lineHeight: 1.4,
            marginBottom: 2,
          }}
        >
          {info.label}
        </div>
        {info.lines.map((line, i) => {
          const isHighlight = line.includes('%') || line.includes('+') || line.includes('-')
          return (
            <div
              key={i}
              style={{
                fontSize: isHighlight ? 14 : 11,
                fontWeight: isHighlight ? 800 : 600,
                color: isHighlight ? accent : '#e2e8f0',
                fontFamily: isHighlight ? '"Lilita One", sans-serif' : 'inherit',
                letterSpacing: isHighlight ? '0.05em' : 'normal',
                lineHeight: 1.4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {line}
            </div>
          )
        })}
      </div>
    </foreignObject>
  )
}

interface AreaChartProps {
  data: DailyPoint[]
  getValue: (d: DailyPoint) => number
  yMin: number
  yMax: number
  yTicks: number[]
  formatY: (v: number) => string
  tooltipLines: (d: DailyPoint) => string[]
  referenceLine?: number
  colorFn: (value: number) => string
  locale: string
  chartId: string
}

function AreaChart({
  data,
  getValue,
  yMin,
  yMax,
  yTicks,
  formatY,
  tooltipLines,
  referenceLine,
  colorFn,
  locale,
  chartId,
}: AreaChartProps) {
  const [hover, setHover] = useState<TooltipInfo | null>(null)
  const gradientId = useId()

  const labelIndices = useMemo(() => pickLabelIndices(data.length), [data.length])

  const toX = (i: number) =>
    PAD.left + (data.length === 1 ? INNER_W / 2 : (i / (data.length - 1)) * INNER_W)

  const toY = (v: number) => {
    const range = yMax - yMin || 1
    return PAD.top + INNER_H - ((v - yMin) / range) * INNER_H
  }

  const points = data.map((d, i) => ({ x: toX(i), y: toY(getValue(d)), val: getValue(d) }))
  
  // Create area path
  let areaPathStr = ''
  if (points.length > 0) {
    areaPathStr = `M ${points[0].x},${CHART_H - PAD.bottom}`
    points.forEach(p => {
      areaPathStr += ` L ${p.x},${p.y}`
    })
    areaPathStr += ` L ${points[points.length - 1].x},${CHART_H - PAD.bottom} Z`
  }

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(' ')

  const segmentPairs = data.map((d, i) => ({
    x: points[i].x,
    y: points[i].y,
    color: colorFn(getValue(d)),
  }))

  // Use the average or majority color for the gradient depending on the data
  const overallColor = colorFn(points.reduce((acc, p) => acc + p.val, 0) / (points.length || 1))

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={`${chartId}-gradient`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={overallColor} stopOpacity={0.4} />
          <stop offset="100%" stopColor={overallColor} stopOpacity={0.0} />
        </linearGradient>
        
        {/* Neon glow effect for line */}
        <filter id={`${chartId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Y-axis grid + labels */}
      {yTicks.map((tick) => {
        const y = toY(tick)
        return (
          <g key={tick}>
            <line
              x1={PAD.left}
              y1={y}
              x2={CHART_W - PAD.right + 10}
              y2={y}
              stroke="#ffffff"
              strokeOpacity={0.05}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y + 3}
              textAnchor="end"
              fontSize={10}
              fontFamily='"Lilita One", sans-serif'
              fill="#64748b"
              className="drop-shadow-md"
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
          x2={CHART_W - PAD.right + 10}
          y2={toY(referenceLine)}
          stroke="#4EC0FA"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          opacity={0.4}
        />
      )}

      {/* X-axis labels */}
      {labelIndices.map((idx) => (
        <text
          key={idx}
          x={toX(idx)}
          y={CHART_H - 10}
          textAnchor="middle"
          fontSize={9}
          fontWeight={800}
          letterSpacing={1}
          fill="#64748b"
        >
          {formatLabel(data[idx].date)}
        </text>
      ))}

      {/* Glowing Area Fill */}
      {points.length > 1 && (
        <path
          d={areaPathStr}
          fill={`url(#${chartId}-gradient)`}
        />
      )}

      {/* Line segments with neon stroke */}
      {segmentPairs.map((seg, i) => {
        if (i === 0) return null
        const prev = segmentPairs[i - 1]
        return (
          <g key={i}>
            {/* Outline trick for extra sharpness */}
            <line
              x1={prev.x}
              y1={prev.y}
              x2={seg.x}
              y2={seg.y}
              stroke="#0A0E1A"
              strokeWidth={5}
              strokeLinecap="round"
            />
            <line
              x1={prev.x}
              y1={prev.y}
              x2={seg.x}
              y2={seg.y}
              stroke={seg.color}
              strokeWidth={3}
              strokeLinecap="round"
              filter={`url(#${chartId}-glow)`}
            />
          </g>
        )
      })}

      {/* Invisible wider polyline for easier hover detection */}
      <polyline
        points={polylineStr}
        fill="none"
        stroke="transparent"
        strokeWidth={30}
      />

      {/* Data point dots */}
      {points.map((p, i) => {
        const d = data[i]
        const color = colorFn(getValue(d))
        const isHovered = hover?.x === p.x && hover?.y === p.y
        return (
          <g key={i} style={{ transition: 'all 0.2s ease-in-out' }}>
            {/* Outer glow ring */}
            <circle cx={p.x} cy={p.y} r={isHovered ? 12 : 8} fill={color} opacity={isHovered ? 0.3 : 0.15} style={{ transition: 'all 0.2s ease-in-out' }} />
            {/* Filled dot */}
            <circle cx={p.x} cy={p.y} r={isHovered ? 6 : 4} fill={color} stroke="#0D1321" strokeWidth={isHovered ? 2 : 1.5} style={{ transition: 'all 0.2s ease-in-out' }} />
            {/* Invisible hit area */}
            <circle
              cx={p.x}
              cy={p.y}
              r={20}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() =>
                setHover({
                  x: p.x,
                  y: p.y,
                  label: formatTooltipDate(d.date, locale),
                  lines: tooltipLines(d),
                  accentColor: colorFn(getValue(d)),
                })
              }
              onMouseLeave={() => setHover(null)}
            />
          </g>
        )
      })}

      {<ChartTooltip info={hover} />}
    </svg>
  )
}

/* ─────────────────────── main component ─────────────────────── */

export function TrendsChart({ dailyTrend, proAvgWR }: Props) {
  const t = useTranslations('advancedAnalytics')
  const locale = useLocale()

  if (dailyTrend.length === 0) {
    return (
      <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-3 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
          <span className="text-xl drop-shadow-md">📈</span> {t('trendsTitle')}
        </h3>
        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest text-center py-6">
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
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[length:30px_30px] pointer-events-none" />

      <h3 className="font-['Lilita_One'] text-lg text-white mb-6 flex items-center gap-2 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <span className="text-xl drop-shadow-md">📈</span> {t('trendsTitle')}
        <InfoTooltip className="ml-1.5 opacity-70 hover:opacity-100" text={t('tipTrends')} />
      </h3>

      <div className="space-y-8 relative z-10">
        {/* ── Chart 1: Win Rate Trend ── */}
        <div className="bg-[#0A0E1A] p-4 rounded-xl border border-white/5 shadow-inner">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FFC91B] drop-shadow-[0_0_5px_rgba(255,201,27,0.8)]" />
            {t('winRateTrend')}
            {proAvgWR != null && (
              <span className="ml-2 scale-90 origin-left">
                <ProBadge proValue={proAvgWR} total={0} compact />
              </span>
            )}
          </p>
          <AreaChart
            chartId="chart-wr"
            data={dailyTrend}
            getValue={(d) => d.winRate}
            yMin={0}
            yMax={100}
            yTicks={[0, 25, 50, 75, 100]}
            formatY={(v) => `${v}%`}
            referenceLine={50}
            colorFn={(v) => (v >= 50 ? GREEN : RED)}
            tooltipLines={(d) => [
              `WR ${d.winRate.toFixed(1)}%`,
              `${d.wins}W / ${d.total - d.wins}L`,
            ]}
            locale={locale}
          />
        </div>

        {/* ── Chart 2: Trophy Progression ── */}
        <div className="bg-[#0A0E1A] p-4 rounded-xl border border-white/5 shadow-inner">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4EC0FA] drop-shadow-[0_0_5px_rgba(78,192,250,0.8)]" />
            {t('trophyProgression')}
          </p>
          <AreaChart
            chartId="chart-trophies"
            data={dailyTrend}
            getValue={(d) => d.cumulativeTrophies}
            yMin={tMin}
            yMax={tMax}
            yTicks={trophyTicks}
            formatY={(v) => (v >= 0 ? `+${v}` : `${v}`)}
            referenceLine={tMin <= 0 && tMax >= 0 ? 0 : undefined}
            colorFn={(v) => (v >= 0 ? GREEN : RED)}
            tooltipLines={(d) => [
              `Sum ${d.cumulativeTrophies >= 0 ? '+' : ''}${d.cumulativeTrophies}`,
              `Day ${d.trophyChange >= 0 ? '+' : ''}${d.trophyChange}`,
            ]}
            locale={locale}
          />
        </div>
      </div>
    </div>
  )
}
