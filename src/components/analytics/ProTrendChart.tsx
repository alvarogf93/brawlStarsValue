'use client'

import { useState, useMemo } from 'react'
import { getBrawlerPortraitUrl, getBrawlerPortraitFallback } from '@/lib/utils'
import { BrawlImg } from '@/components/ui/BrawlImg'
import type { DailyTrendEntry, TopBrawlerEntry } from '@/lib/draft/pro-analysis'

interface Props {
  dailyTrend: DailyTrendEntry[]
  topBrawlers: TopBrawlerEntry[]
}

const PAD = { top: 10, right: 20, bottom: 30, left: 40 } as const
const CHART_W = 600
const CHART_H = 200
const INNER_W = CHART_W - PAD.left - PAD.right
const INNER_H = CHART_H - PAD.top - PAD.bottom

const COLORS = ['#FFC91B', '#4EC0FA', '#4ade80', '#f472b6', '#a78bfa']

function formatLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
}

function pickLabelIndices(total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  const target = 6
  const step = (total - 1) / (target - 1)
  const indices: number[] = []
  for (let i = 0; i < target; i++) indices.push(Math.round(i * step))
  return indices
}

export function ProTrendChart({ dailyTrend, topBrawlers }: Props) {
  const top5Ids = useMemo(() => topBrawlers.slice(0, 5).map(b => b.brawlerId), [topBrawlers])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(top5Ids.slice(0, 3)))

  const toggleBrawler = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const brawlerSeries = useMemo(() => {
    const series = new Map<number, Array<{ date: string; wr: number }>>()
    for (const id of top5Ids) series.set(id, [])
    for (const day of dailyTrend) {
      for (const b of day.brawlers) {
        if (top5Ids.includes(b.brawlerId)) {
          series.get(b.brawlerId)?.push({ date: day.date, wr: b.winRate })
        }
      }
    }
    return series
  }, [dailyTrend, top5Ids])

  if (dailyTrend.length === 0) return null

  const dates = dailyTrend.map(d => d.date)
  const labelIndices = pickLabelIndices(dates.length)

  const toX = (i: number) =>
    PAD.left + (dates.length === 1 ? INNER_W / 2 : (i / (dates.length - 1)) * INNER_W)

  const yMin = 30
  const yMax = 70
  const yTicks = [30, 40, 50, 60, 70]
  const toY = (v: number) => PAD.top + INNER_H - ((v - yMin) / (yMax - yMin)) * INNER_H

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">{'\uD83D\uDCC8'}</span> PRO Trends (30d)
      </h3>

      <div className="flex flex-wrap gap-2 mb-4">
        {top5Ids.map((id, idx) => {
          const b = topBrawlers.find(x => x.brawlerId === id)
          if (!b) return null
          const isActive = selectedIds.has(id)
          return (
            <button
              key={id}
              onClick={() => toggleBrawler(id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                isActive
                  ? 'border-white/20 bg-white/5'
                  : 'border-transparent bg-transparent opacity-40'
              }`}
            >
              <BrawlImg
                src={getBrawlerPortraitUrl(id)}
                fallbackSrc={getBrawlerPortraitFallback(id)}
                alt={b.name}
                className="w-5 h-5 rounded"
              />
              <span style={{ color: COLORS[idx] }}>{b.name}</span>
            </button>
          )
        })}
      </div>

      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {yTicks.map(tick => (
          <g key={tick}>
            <line x1={PAD.left} y1={toY(tick)} x2={CHART_W - PAD.right} y2={toY(tick)} stroke="#1e293b" strokeWidth={0.5} />
            <text x={PAD.left - 6} y={toY(tick) + 3} textAnchor="end" fontSize={9} fill="#64748b">{tick}%</text>
          </g>
        ))}
        <line x1={PAD.left} y1={toY(50)} x2={CHART_W - PAD.right} y2={toY(50)} stroke="#64748b" strokeWidth={1} strokeDasharray="6 4" opacity={0.6} />
        {labelIndices.map(idx => (
          <text key={idx} x={toX(idx)} y={CHART_H - 4} textAnchor="middle" fontSize={9} fill="#64748b">{formatLabel(dates[idx])}</text>
        ))}
        {top5Ids.map((id, colorIdx) => {
          if (!selectedIds.has(id)) return null
          const series = brawlerSeries.get(id) ?? []
          if (series.length < 2) return null
          const points = series.map(s => {
            const dateIdx = dates.indexOf(s.date)
            if (dateIdx === -1) return null
            return { x: toX(dateIdx), y: toY(Math.max(yMin, Math.min(yMax, s.wr))) }
          }).filter(Boolean) as Array<{ x: number; y: number }>
          return (
            <g key={id}>
              {points.map((p, i) => {
                if (i === 0) return null
                const prev = points[i - 1]
                return <line key={i} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y} stroke={COLORS[colorIdx]} strokeWidth={2} strokeLinecap="round" />
              })}
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill={COLORS[colorIdx]} stroke="#0D1321" strokeWidth={1} />
              ))}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
