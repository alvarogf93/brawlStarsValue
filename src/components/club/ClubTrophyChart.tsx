'use client'

import { useState, useMemo, useId } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { getGameModeImageUrl } from '@/lib/utils'
import { MODE_DISPLAY_NAMES } from '@/lib/constants'
import type { MemberTrophyChange, BattlePoint } from '@/hooks/useClubTrophyChanges'

interface ClubTrophyChartProps {
  members: MemberTrophyChange[]
  playerTag: string
  progress: number
  isLoading: boolean
}

const PALETTE = [
  '#4EC0FA', '#F82F41', '#4ade80', '#a855f7', '#f97316',
  '#ec4899', '#06b6d4', '#84cc16', '#e879f9', '#fb923c',
  '#22d3ee', '#f43f5e', '#34d399', '#818cf8', '#fb7185',
  '#2dd4bf', '#fbbf24', '#c084fc', '#38bdf8', '#a3e635',
  '#f472b6', '#67e8f9', '#d946ef', '#fdba74', '#86efac',
  '#fca5a5', '#93c5fd', '#c4b5fd', '#bef264', '#fda4af',
]

const RESULT_BORDER: Record<string, string> = {
  victory: '#4ade80',
  defeat: '#f87171',
  draw: '#facc15',
}


const PAD_X = 48
const PAD_TOP = 24
const PAD_BOTTOM = 24
const SVG_W = 720
const SVG_H = 360
const DOT_R = 4
const DOT_R_HOVER = 7

function niceStep(min: number, max: number, count: number): number {
  const range = Math.max(Math.abs(max - min), 1)
  const rough = range / count
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const residual = rough / mag
  if (residual <= 1.5) return Math.max(mag, 1)
  if (residual <= 3) return Math.max(2 * mag, 1)
  if (residual <= 7) return Math.max(5 * mag, 1)
  return Math.max(10 * mag, 1)
}

interface LineData {
  tag: string
  name: string
  color: string
  netChange: number
  points: { x: number; y: number; bp: BattlePoint }[]
}

export function ClubTrophyChart({ members, playerTag, progress, isLoading }: ClubTrophyChartProps) {
  const t = useTranslations('battles')
  const uid = useId()
  const playerNorm = `#${playerTag.replace('#', '').toUpperCase()}`

  const [expanded, setExpanded] = useState(true)
  const [visible, setVisible] = useState<Set<string> | null>(null)
  const [hovered, setHovered] = useState<{ tag: string; idx: number } | null>(null)

  // Build sorted member list with colors
  const memberLines = useMemo(() => {
    return members
      .filter(m => m.loaded && m.battlePoints.length > 0)
      .sort((a, b) => b.netChange - a.netChange)
      .map((m, i) => ({
        tag: m.tag,
        name: m.name,
        color: m.tag.toUpperCase() === playerNorm ? '#FFC91B' : PALETTE[i % PALETTE.length],
        netChange: m.netChange,
        battlePoints: m.battlePoints,
      }))
  }, [members, playerNorm])

  // Auto-init visible set
  const activeSet = useMemo(() => {
    if (visible !== null) return visible
    if (memberLines.length < 3) return new Set(memberLines.map(l => l.tag))
    const top = new Set(memberLines.slice(0, 8).map(l => l.tag))
    const pl = memberLines.find(l => l.tag.toUpperCase() === playerNorm)
    if (pl) top.add(pl.tag)
    return top
  }, [visible, memberLines, playerNorm])

  const activeLines = memberLines.filter(l => activeSet.has(l.tag))

  // Geometry
  const { lines, zeroY, yLabels } = useMemo(() => {
    const allVals = activeLines.length > 0
      ? activeLines.flatMap(l => [0, ...l.battlePoints.map(bp => bp.cumulative)])
      : [0, 10, -10]
    const rawMin = Math.min(...allVals)
    const rawMax = Math.max(...allVals)
    const range = rawMax - rawMin || 1
    const yMin = rawMin - range * 0.12
    const yMax = rawMax + range * 0.12
    const plotW = SVG_W - PAD_X * 2
    const plotH = SVG_H - PAD_TOP - PAD_BOTTOM

    const toX = (i: number, total: number) => PAD_X + (total > 1 ? (i / (total - 1)) * plotW : plotW / 2)
    const toY = (v: number) => PAD_TOP + plotH - ((v - yMin) / (yMax - yMin)) * plotH
    const zeroY = toY(0)

    const step = niceStep(rawMin, rawMax, 5)
    const yLabels: { value: number; y: number }[] = []
    for (let v = Math.ceil(yMin / step) * step; v <= Math.floor(yMax / step) * step; v += step) {
      yLabels.push({ value: v, y: toY(v) })
    }

    const lines: LineData[] = activeLines.map(l => {
      const total = l.battlePoints.length + 1 // +1 for starting zero point
      const pts = [
        { x: toX(0, total), y: toY(0), bp: { change: 0, cumulative: 0, result: 'draw' as const, mode: '', map: '', isStarPlayer: false } },
        ...l.battlePoints.map((bp, i) => ({ x: toX(i + 1, total), y: toY(bp.cumulative), bp })),
      ]
      return { tag: l.tag, name: l.name, color: l.color, netChange: l.netChange, points: pts }
    })

    return { lines, zeroY, yLabels }
  }, [activeLines])

  const toggle = (tag: string) => {
    const base = new Set(activeSet)
    if (base.has(tag)) base.delete(tag); else base.add(tag)
    setVisible(base)
  }

  if (memberLines.length === 0 && !isLoading) return null

  // Find hovered point data for tooltip
  const hoveredLine = hovered ? lines.find(l => l.tag === hovered.tag) : null
  const hoveredPt = hoveredLine && hovered ? hoveredLine.points[hovered.idx] : null

  return (
    <div className="brawl-card-dark border-[#090E17] overflow-hidden">
      {/* Accordion Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 md:px-8 md:py-5 hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[var(--color-brawl-gold)] border-[3px] border-[#121A2F] rounded-xl flex items-center justify-center shadow-[0_3px_0_0_#121A2F] transform rotate-2">
            <span className="text-xl">🏆</span>
          </div>
          <h2 className="font-['Lilita_One'] text-xl md:text-2xl tracking-wide text-white">{t('trophyChange')}</h2>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="w-20 h-2 bg-[#0D1321] rounded-full overflow-hidden">
                <div className="h-full bg-[#4EC0FA] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-slate-500 font-bold">{progress}%</span>
            </div>
          )}
          <ChevronDown size={22} className={`text-slate-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Collapsible content */}
      <div className={`transition-all duration-400 ease-in-out overflow-hidden ${expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 md:px-8 pb-5 md:pb-8">

          {/* SVG Chart */}
          <div className="w-full overflow-hidden rounded-xl bg-[#0A101D] border border-white/5">
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto">
              <defs>
                {lines.map(l => (
                  <linearGradient key={`g-${l.tag}`} id={`${uid}-${l.tag.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={l.color} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={l.color} stopOpacity={0.01} />
                  </linearGradient>
                ))}
                <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Grid */}
              {yLabels.map(l => (
                <line key={l.value} x1={PAD_X} y1={l.y} x2={SVG_W - PAD_X} y2={l.y} stroke="rgba(255,255,255,0.05)" />
              ))}

              {/* Zero line */}
              <line x1={PAD_X - 4} y1={zeroY} x2={SVG_W - PAD_X + 4} y2={zeroY} stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} strokeDasharray="6 4" />
              <text x={PAD_X - 10} y={zeroY + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={10} fontFamily="Inter, sans-serif" fontWeight={600}>0</text>

              {yLabels.filter(l => l.value !== 0).map(l => (
                <text key={l.value} x={PAD_X - 10} y={l.y + 4} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize={10} fontFamily="Inter, sans-serif">
                  {l.value > 0 ? `+${l.value}` : l.value}
                </text>
              ))}

              {/* Lines + dots */}
              {lines.map(line => {
                const isPlayer = line.tag.toUpperCase() === playerNorm
                const d = line.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                const last = line.points[line.points.length - 1]

                return (
                  <g key={line.tag}>
                    {/* Area */}
                    <path d={`${d} L ${last.x} ${zeroY} L ${line.points[0].x} ${zeroY} Z`} fill={`url(#${uid}-${line.tag.replace('#', '')})`} />
                    {/* Glow */}
                    <path d={d} fill="none" stroke={line.color} strokeWidth={isPlayer ? 6 : 3} strokeOpacity={0.2} strokeLinecap="round" strokeLinejoin="round" filter={isPlayer ? `url(#${uid}-glow)` : undefined} />
                    {/* Line */}
                    <path d={d} fill="none" stroke={line.color} strokeWidth={isPlayer ? 2.5 : 1.5} strokeLinecap="round" strokeLinejoin="round" />

                    {/* Battle dots (skip index 0 = origin point) */}
                    {line.points.slice(1).map((pt, i) => {
                      const isHov = hovered?.tag === line.tag && hovered.idx === i + 1
                      const r = isHov ? DOT_R_HOVER : (isPlayer ? DOT_R + 1 : DOT_R)
                      const resultColor = RESULT_BORDER[pt.bp.result] ?? '#facc15'

                      return (
                        <g key={i}>
                          {/* Star Player dashed ring */}
                          {pt.bp.isStarPlayer && (
                            <circle cx={pt.x} cy={pt.y} r={r + 4} fill="none" stroke="#FFC91B" strokeWidth={1.5} strokeDasharray="3 2" opacity={0.8} />
                          )}
                          {/* Result border ring (victory=green, defeat=red, draw=yellow) */}
                          <circle cx={pt.x} cy={pt.y} r={r + 2} fill="none" stroke={resultColor} strokeWidth={2} />
                          {/* Player color dot */}
                          <circle cx={pt.x} cy={pt.y} r={r} fill={line.color} stroke="#0A101D" strokeWidth={1.5} style={{ transition: 'r 0.15s' }} />
                          {/* Invisible hit area */}
                          <circle
                            cx={pt.x} cy={pt.y} r={14} fill="transparent" style={{ cursor: 'pointer' }}
                            onMouseEnter={() => setHovered({ tag: line.tag, idx: i + 1 })}
                            onMouseLeave={() => setHovered(null)}
                          />
                        </g>
                      )
                    })}

                    {/* End label */}
                    <text x={last.x + (isPlayer ? 14 : 8)} y={last.y + 4} fill={line.color} fontSize={isPlayer ? 11 : 9} fontFamily="'Lilita One', sans-serif">
                      {line.netChange > 0 ? '+' : ''}{line.netChange}
                    </text>
                  </g>
                )
              })}

              {/* Tooltip (rendered last = on top) */}
              {hoveredPt && hoveredLine && hoveredPt.bp.mode && (() => {
                const tw = 190
                const th = hoveredPt.bp.isStarPlayer ? 92 : 76
                const flipped = hoveredPt.x > SVG_W * 0.65
                const tx = flipped ? hoveredPt.x - tw - 12 : hoveredPt.x + 12
                const ty = Math.max(4, hoveredPt.y - th - 10)
                const sign = hoveredPt.bp.change >= 0 ? '+' : ''
                const modeIconUrl = getGameModeImageUrl(hoveredPt.bp.mode)
                const modeLabel = MODE_DISPLAY_NAMES[hoveredPt.bp.mode] ?? hoveredPt.bp.mode
                const resultColor = RESULT_BORDER[hoveredPt.bp.result] ?? '#facc15'

                return (
                  <g style={{ pointerEvents: 'none' }}>
                    <line x1={hoveredPt.x} y1={hoveredPt.y - DOT_R_HOVER} x2={flipped ? tx + tw : tx} y2={ty + th} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                    <foreignObject x={tx} y={ty} width={tw} height={th}>
                      <div style={{ background: 'rgba(10,16,29,0.97)', border: `2px solid ${hoveredLine.color}40`, borderRadius: 12, padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}>
                        <p style={{ margin: 0, fontFamily: "'Lilita One'", fontSize: 11, color: hoveredLine.color, lineHeight: 1.2 }}>
                          {hoveredLine.name}
                        </p>
                        <p style={{ margin: '3px 0 0', fontFamily: "'Lilita One'", fontSize: 12, color: '#FFC91B', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {modeIconUrl && (
                            <img src={modeIconUrl} alt="" width={14} height={14} style={{ verticalAlign: 'middle' }} />
                          )}
                          {modeLabel.toUpperCase()}
                        </p>
                        <p style={{ margin: '2px 0 0', fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#94a3b8', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {hoveredPt.bp.map}
                        </p>
                        <p style={{ margin: '3px 0 0', fontFamily: "'Lilita One'", fontSize: 14, color: resultColor, lineHeight: 1.2 }}>
                          {sign}{hoveredPt.bp.change} 🏆 <span style={{ fontSize: 10, color: '#94a3b8' }}>({sign}{hoveredPt.bp.cumulative})</span>
                        </p>
                        {hoveredPt.bp.isStarPlayer && (
                          <p style={{ margin: '2px 0 0', fontFamily: "'Lilita One'", fontSize: 10, color: '#FFC91B', lineHeight: 1.2 }}>
                            ⭐ Star Player
                          </p>
                        )}
                      </div>
                    </foreignObject>
                  </g>
                )
              })()}
            </svg>
          </div>

          {/* Toggle legend */}
          <div className="mt-4">
            <div className="flex gap-2 mb-3">
              <button onClick={() => setVisible(new Set(memberLines.map(l => l.tag)))} className="text-[10px] font-bold text-[#4EC0FA] bg-[#4EC0FA]/10 px-3 py-1 rounded-full hover:bg-[#4EC0FA]/20 transition-colors">All</button>
              <button onClick={() => setVisible(new Set())} className="text-[10px] font-bold text-slate-400 bg-white/5 px-3 py-1 rounded-full hover:bg-white/10 transition-colors">None</button>
              <button onClick={() => setVisible(new Set(memberLines.slice(0, 5).map(l => l.tag)))} className="text-[10px] font-bold text-green-400 bg-green-500/10 px-3 py-1 rounded-full hover:bg-green-500/20 transition-colors">Top 5</button>
              <button onClick={() => setVisible(new Set(memberLines.slice(-5).map(l => l.tag)))} className="text-[10px] font-bold text-red-400 bg-red-500/10 px-3 py-1 rounded-full hover:bg-red-500/20 transition-colors">Bottom 5</button>
            </div>

            {/* Legend row: dot color + result colors guide */}
            <div className="flex items-center gap-4 mb-3 text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> {t('resultVictory')}</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> {t('resultDefeat')}</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> {t('resultDraw')}</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-yellow-400 inline-block" /> {t('starPlayer')}</span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
              {memberLines.map(line => {
                const isOn = activeSet.has(line.tag)
                const isPlayer = line.tag.toUpperCase() === playerNorm
                return (
                  <button
                    key={line.tag}
                    onClick={() => toggle(line.tag)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border ${
                      isOn ? 'border-white/20 bg-white/10 text-white' : 'border-transparent bg-white/[0.03] text-slate-600 hover:text-slate-400'
                    } ${isPlayer ? 'ring-1 ring-[#FFC91B]/50' : ''}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: line.color, opacity: isOn ? 1 : 0.3 }} />
                    <span className="truncate max-w-[80px]">{line.name}</span>
                    <span className={`tabular-nums ${line.netChange > 0 ? 'text-green-400' : line.netChange < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {line.netChange > 0 ? '+' : ''}{line.netChange}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
