'use client'

import { useState, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl } from '@/lib/utils'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

/* ─────────────────────── types ─────────────────────── */

interface MasteryPoint {
  date: string
  wins: number
  total: number
  winRate: number
  cumulativeWins: number
  cumulativeTotal: number
}

interface BrawlerMastery {
  brawlerId: number
  brawlerName: string
  points: MasteryPoint[]
}

interface Props {
  data: BrawlerMastery[]
}

/* ─────────────────────── constants ─────────────────────── */

const PAD = { top: 10, right: 20, bottom: 30, left: 40 } as const
const CHART_W = 600
const CHART_H = 200
const INNER_W = CHART_W - PAD.left - PAD.right
const INNER_H = CHART_H - PAD.top - PAD.bottom

const CYAN = '#4EC0FA'
const GREEN = '#4ade80'
const RED = '#ef4444'

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

  const tooltipW = 150
  const tooltipH = 14 + info.lines.length * 16
  const tx =
    info.x + tooltipW + 10 > CHART_W ? info.x - tooltipW - 8 : info.x + 8
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
      className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
    >
      {brawlers.map((b) => (
        <button
          key={b.brawlerId}
          onClick={() => onSelect(b.brawlerId)}
          className={`flex-shrink-0 rounded-lg p-0.5 transition-all ${
            selectedId === b.brawlerId
              ? 'ring-2 ring-[#FFC91B] bg-[#FFC91B]/10'
              : 'ring-1 ring-white/5 hover:ring-white/20'
          }`}
          title={b.brawlerName}
        >
          <img
            src={getBrawlerPortraitUrl(b.brawlerId)}
            alt={b.brawlerName}
            className="w-10 h-10 rounded-md"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  )
}

/* ─────────────────────── SVG line chart ─────────────────────── */

function MasteryLineChart({ points }: { points: MasteryPoint[] }) {
  const [hover, setHover] = useState<TooltipInfo | null>(null)

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

  const polylineStr = chartPoints.map((p) => `${p.x},${p.y}`).join(' ')

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
              {tick}%
            </text>
          </g>
        )
      })}

      {/* 50% reference line */}
      <line
        x1={PAD.left}
        y1={toY(50)}
        x2={CHART_W - PAD.right}
        y2={toY(50)}
        stroke="#64748b"
        strokeWidth={1}
        strokeDasharray="6 4"
        opacity={0.6}
      />

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
          {formatLabel(points[idx].date)}
        </text>
      ))}

      {/* Line segments */}
      {chartPoints.map((seg, i) => {
        if (i === 0) return null
        const prev = chartPoints[i - 1]
        return (
          <line
            key={i}
            x1={prev.x}
            y1={prev.y}
            x2={seg.x}
            y2={seg.y}
            stroke={CYAN}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )
      })}

      {/* Invisible wider polyline for hover */}
      <polyline
        points={polylineStr}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
      />

      {/* Data point dots */}
      {chartPoints.map((cp, i) => {
        const p = points[i]
        const wr = cumulativeWR(p)
        return (
          <g key={i}>
            <circle cx={cp.x} cy={cp.y} r={6} fill={CYAN} opacity={0.15} />
            <circle
              cx={cp.x}
              cy={cp.y}
              r={3.5}
              fill={CYAN}
              stroke="#0D1321"
              strokeWidth={1.5}
            />
            {/* Hit area */}
            <circle
              cx={cp.x}
              cy={cp.y}
              r={14}
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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
      {/* Total Games */}
      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
        <p className="font-['Lilita_One'] text-xl tabular-nums text-white">
          {totalGames}
        </p>
        <p className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">
          {t('totalGames')}
        </p>
      </div>

      {/* Current WR */}
      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
        <p
          className={`font-['Lilita_One'] text-xl tabular-nums ${
            currentWR >= 60
              ? 'text-green-400'
              : currentWR >= 45
                ? 'text-[#FFC91B]'
                : 'text-red-400'
          }`}
        >
          {currentWR.toFixed(1)}%
        </p>
        <p className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">
          {t('currentWR')}
        </p>
      </div>

      {/* First WR */}
      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
        <p className="font-['Lilita_One'] text-xl tabular-nums text-slate-300">
          {firstWR.toFixed(1)}%
        </p>
        <p className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">
          {t('firstWR')}
        </p>
      </div>

      {/* Delta */}
      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
        <p
          className={`font-['Lilita_One'] text-xl tabular-nums ${
            delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-slate-400'
          }`}
        >
          {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'}{' '}
          {Math.abs(delta).toFixed(1)}%
        </p>
        <p className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">
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
      <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
        <h3 className="font-['Lilita_One'] text-lg text-white mb-3 flex items-center gap-2">
          <span className="text-xl">📈</span> {t('masteryTitle')}
          <InfoTooltip className="ml-1.5" text={t('tipMastery')} />
        </h3>
        <p className="text-slate-500 text-sm text-center py-6">
          {t('masteryEmpty')}
        </p>
      </div>
    )
  }

  const selected = data.find((b) => b.brawlerId === selectedId) ?? data[0]
  const hasEnoughPoints = selected.points.length >= 2

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      {/* Header */}
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">📈</span> {t('masteryTitle')}
        <InfoTooltip className="ml-1.5" text={t('tipMastery')} />
      </h3>

      {/* Brawler selector */}
      <BrawlerSelector
        brawlers={data}
        selectedId={selected.brawlerId}
        onSelect={setSelectedId}
      />

      {/* Selected brawler name */}
      <p className="font-['Lilita_One'] text-sm text-[#FFC91B] mt-3 mb-2">
        {selected.brawlerName}
      </p>

      {/* Chart or fallback */}
      {hasEnoughPoints ? (
        <>
          <MasteryLineChart points={selected.points} />
          <SummaryStats points={selected.points} t={t} />
        </>
      ) : (
        <p className="text-slate-500 text-sm text-center py-8">
          {t('masteryEmpty')}
        </p>
      )}
    </div>
  )
}
