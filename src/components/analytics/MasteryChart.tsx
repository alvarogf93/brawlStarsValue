'use client'

import { useState, useMemo, useRef, useId } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import type { BrawlerMastery, MasteryPoint } from '@/lib/analytics/types'

/* ─────────────────────── types ─────────────────────── */

// ARQ-13 — local interfaces removed; consume the canonical
// BrawlerMastery / MasteryPoint from `lib/analytics/types`. The local
// copies were structurally compatible by accident, so any new field
// added upstream was silently dropped here.

interface Props {
  data: BrawlerMastery[]
}

/* ─────────────────────── constants ─────────────────────── */

const PAD = { top: 20, right: 30, bottom: 30, left: 40 } as const
const CHART_W = 600
const CHART_H = 200
const INNER_W = CHART_W - PAD.left - PAD.right
const INNER_H = CHART_H - PAD.top - PAD.bottom

const CYAN = '#4EC0FA'

/* ─────────────────────── helpers ─────────────────────── */

function formatLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
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

function cumulativeWR(p: MasteryPoint): number {
  return p.cumulativeTotal > 0
    ? (p.cumulativeWins / p.cumulativeTotal) * 100
    : 0
}

/* ─────────────────────── tooltip ─────────────────────── */

interface TooltipInfo {
  x: number
  y: number
  label: string
  lines: string[]
}

function ChartTooltip({ info }: { info: TooltipInfo | null }) {
  if (!info) return null

  const tooltipW = 160
  const tooltipH = 32 + info.lines.length * 20 + 10
  const tx =
    info.x + tooltipW + 12 > CHART_W ? info.x - tooltipW - 12 : info.x + 12
  const ty = clamp(info.y - tooltipH / 2, 2, CHART_H - tooltipH - 2)

  return (
    <foreignObject x={tx} y={ty} width={tooltipW} height={tooltipH} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'rgba(10,16,29,0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderLeft: `4px solid ${CYAN}`,
          borderRadius: 8,
          padding: '8px 12px',
          boxSizing: 'border-box',
          boxShadow: `0 8px 24px rgba(0,0,0,0.8), 0 0 10px ${CYAN}40`,
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
          const isHighlight = i === 0
          return (
            <div
              key={i}
              style={{
                fontSize: isHighlight ? 14 : 11,
                fontWeight: isHighlight ? 800 : 600,
                color: isHighlight ? CYAN : '#e2e8f0',
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

/* ─────────────────────── brawler selector ─────────────────────── */

function BrawlerSelector({
  brawlers,
  selectedId,
  onSelect,
}: {
  brawlers: BrawlerMastery[]
  selectedId: number
  onSelect: (id: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-thin scrollbar-thumb-[#4EC0FA]/50 scrollbar-track-black/20"
    >
      {brawlers.map((b) => (
        <button
          key={b.brawlerId}
          onClick={() => onSelect(b.brawlerId)}
          className={`relative flex-shrink-0 p-0.5 transition-all overflow-hidden cursor-pointer ${
            selectedId === b.brawlerId
              ? 'scale-105 shadow-[0_0_15px_rgba(78,192,250,0.4)] z-10'
              : 'scale-95 opacity-60 hover:opacity-100 hover:scale-100'
          }`}
          style={{ clipPath: 'polygon(15% 0, 100% 0, 85% 100%, 0 100%)' }}
          title={b.brawlerName}
        >
          {selectedId === b.brawlerId && (
            <div className="absolute inset-0 bg-[#4EC0FA] z-0" />
          )}
          <div className="relative bg-[#0A0E1A] p-[2px] z-10 w-full h-full" style={{ clipPath: 'polygon(15% 0, 100% 0, 85% 100%, 0 100%)' }}>
            <BrawlImg
              src={getBrawlerPortraitUrl(b.brawlerId)}
              fallbackSrc={getBrawlerPortraitFallback(b.brawlerId)}
              alt={b.brawlerName}
              className="w-12 h-10 object-cover"
              style={{ clipPath: 'polygon(15% 0, 100% 0, 85% 100%, 0 100%)' }}
            />
          </div>
        </button>
      ))}
    </div>
  )
}

/* ─────────────────────── SVG area chart ─────────────────────── */

function MasteryAreaChart({ points }: { points: MasteryPoint[] }) {
  const [hover, setHover] = useState<TooltipInfo | null>(null)
  const gradientId = useId()
  const glowId = useId()

  const labelIndices = useMemo(
    () => pickLabelIndices(points.length),
    [points.length],
  )

  const yTicks = [0, 25, 50, 75, 100]

  const toX = (i: number) =>
    PAD.left +
    (points.length === 1 ? INNER_W / 2 : (i / (points.length - 1)) * INNER_W)

  const toY = (v: number) => PAD.top + INNER_H - (v / 100) * INNER_H

  const chartPoints = points.map((p, i) => ({
    x: toX(i),
    y: toY(cumulativeWR(p)),
  }))

  let areaPathStr = ''
  if (chartPoints.length > 0) {
    areaPathStr = `M ${chartPoints[0].x},${CHART_H - PAD.bottom}`
    chartPoints.forEach(p => {
      areaPathStr += ` L ${p.x},${p.y}`
    })
    areaPathStr += ` L ${chartPoints[chartPoints.length - 1].x},${CHART_H - PAD.bottom} Z`
  }

  const polylineStr = chartPoints.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CYAN} stopOpacity={0.4} />
          <stop offset="100%" stopColor={CYAN} stopOpacity={0.0} />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
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
              {tick}%
            </text>
          </g>
        )
      })}

      {/* 50% reference line */}
      <line
        x1={PAD.left}
        y1={toY(50)}
        x2={CHART_W - PAD.right + 10}
        y2={toY(50)}
        stroke="#FFC91B"
        strokeWidth={1.5}
        strokeDasharray="4 4"
        opacity={0.3}
      />

      {/* Glowing Area Fill */}
      {chartPoints.length > 1 && (
        <path
          d={areaPathStr}
          fill={`url(#${gradientId})`}
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
          {formatLabel(points[idx].date)}
        </text>
      ))}

      {/* Line segments */}
      {chartPoints.map((seg, i) => {
        if (i === 0) return null
        const prev = chartPoints[i - 1]
        return (
          <g key={i}>
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
              stroke={CYAN}
              strokeWidth={3}
              strokeLinecap="round"
              filter={`url(#${glowId})`}
            />
          </g>
        )
      })}

      {/* Invisible wider polyline for hover */}
      <polyline
        points={polylineStr}
        fill="none"
        stroke="transparent"
        strokeWidth={30}
      />

      {/* Data point dots */}
      {chartPoints.map((cp, i) => {
        const p = points[i]
        const wr = cumulativeWR(p)
        const isHovered = hover?.x === cp.x && hover?.y === cp.y
        return (
          <g key={i} style={{ transition: 'all 0.2s ease-in-out' }}>
            <circle cx={cp.x} cy={cp.y} r={isHovered ? 12 : 8} fill={CYAN} opacity={isHovered ? 0.3 : 0.15} style={{ transition: 'all 0.2s ease-in-out' }} />
            <circle
              cx={cp.x}
              cy={cp.y}
              r={isHovered ? 6 : 4}
              fill={CYAN}
              stroke="#0D1321"
              strokeWidth={isHovered ? 2 : 1.5}
              style={{ transition: 'all 0.2s ease-in-out' }}
            />
            {/* Hit area */}
            <circle
              cx={cp.x}
              cy={cp.y}
              r={20}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() =>
                setHover({
                  x: cp.x,
                  y: cp.y,
                  label: p.date,
                  lines: [
                    `WR: ${wr.toFixed(1)}%`,
                    `${p.cumulativeWins}W / ${p.cumulativeTotal - p.cumulativeWins}L`,
                    `Day: ${p.wins}W / ${p.total - p.wins}L`,
                  ],
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

/* ─────────────────────── summary stats ─────────────────────── */

function SummaryStats({ points, t }: { points: MasteryPoint[]; t: ReturnType<typeof useTranslations> }) {
  const first = points[0]
  const last = points[points.length - 1]
  const firstWR = cumulativeWR(first)
  const currentWR = cumulativeWR(last)
  const delta = currentWR - firstWR
  const totalGames = last.cumulativeTotal

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
      {/* Total Games */}
      <div className="bg-[#0A0E1A] rounded-xl p-3 text-center border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#4EC0FA]" />
        <p className="font-['Lilita_One'] text-xl tabular-nums text-white drop-shadow-md relative z-10">
          {totalGames}
        </p>
        <p className="text-[9px] font-black uppercase tracking-widest text-[#4EC0FA] mt-1 relative z-10">
          {t('totalGames')}
        </p>
      </div>

      {/* Current WR */}
      <div className="bg-[#0A0E1A] rounded-xl p-3 text-center border border-white/5 relative overflow-hidden">
        <p
          className={`font-['Lilita_One'] text-xl tabular-nums drop-shadow-[0_0_8px_currentColor] relative z-10 ${
            currentWR >= 60
              ? 'text-green-400'
              : currentWR >= 45
                ? 'text-[#FFC91B]'
                : 'text-red-400'
          }`}
        >
          {currentWR.toFixed(1)}%
        </p>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1 relative z-10">
          {t('currentWR')}
        </p>
      </div>

      {/* First WR */}
      <div className="bg-[#0A0E1A] rounded-xl p-3 text-center border border-white/5 relative overflow-hidden opacity-80">
        <p className="font-['Lilita_One'] text-xl tabular-nums text-slate-400 relative z-10">
          {firstWR.toFixed(1)}%
        </p>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1 relative z-10">
          {t('firstWR')}
        </p>
      </div>

      {/* Delta */}
      <div className="bg-[#0A0E1A] rounded-xl p-3 text-center border border-white/5 relative overflow-hidden">
        <p
          className={`font-['Lilita_One'] text-xl tabular-nums drop-shadow-[0_0_8px_currentColor] relative z-10 ${
            delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-slate-400'
          }`}
        >
          {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'}{' '}
          {Math.abs(delta).toFixed(1)}%
        </p>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1 relative z-10">
          {t('wrChange')}
        </p>
      </div>
    </div>
  )
}

/* ─────────────────────── main component ─────────────────────── */

export function MasteryChart({ data }: Props) {
  const t = useTranslations('advancedAnalytics')
  const [selectedId, setSelectedId] = useState<number | null>(
    data.length > 0 ? data[0].brawlerId : null,
  )

  if (data.length === 0) {
    return (
      <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-3 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
          <span className="text-xl drop-shadow-md">📈</span> {t('masteryTitle')}
        </h3>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center py-6">
          {t('masteryEmpty')}
        </p>
      </div>
    )
  }

  const selected = data.find((b) => b.brawlerId === selectedId) ?? data[0]
  const hasEnoughPoints = selected.points.length >= 2

  return (
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
      {/* Background visual texture */}
      <div className="absolute inset-0 z-0 opacity-[0.03] bg-[linear-gradient(rgba(78,192,250,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(78,192,250,0.2)_1px,transparent_1px)] bg-[length:40px_40px] pointer-events-none" />

      {/* Header */}
      <h3 className="font-['Lilita_One'] text-lg text-white mb-5 flex items-center gap-2 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <span className="text-xl drop-shadow-[0_0_8px_rgba(78,192,250,0.8)]">🏆</span> {t('masteryTitle')}
        <InfoTooltip className="ml-1.5 opacity-70 hover:opacity-100" text={t('tipMastery')} />
      </h3>

      <div className="relative z-10">
        {/* Brawler selector (Roster style) */}
        <BrawlerSelector
          brawlers={data}
          selectedId={selected.brawlerId}
          onSelect={setSelectedId}
        />

        <div className="flex items-center gap-2 mb-4 mt-2">
          <span className="w-1.5 h-6 bg-[#FFC91B] rounded-sm drop-shadow-[0_0_5px_rgba(255,201,27,0.8)]" />
          <p className="font-['Lilita_One'] text-lg text-[#FFC91B] tracking-wide drop-shadow-md">
            {selected.brawlerName}
          </p>
        </div>

        {/* Chart or fallback */}
        {hasEnoughPoints ? (
          <div className="bg-[#0A0E1A] p-4 rounded-xl border border-white/5 shadow-inner">
            <MasteryAreaChart points={selected.points} />
            <SummaryStats points={selected.points} t={t} />
          </div>
        ) : (
          <div className="bg-[#0A0E1A] p-8 rounded-xl border border-white/5 shadow-inner flex justify-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">
              {t('masteryEmpty')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
