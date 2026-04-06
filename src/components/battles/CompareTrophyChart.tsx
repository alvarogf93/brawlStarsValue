'use client'

import { useState, useMemo, useId } from 'react'
import { useTranslations } from 'next-intl'

interface BattleEntry {
  battleTime: string
  battle: {
    result: 'victory' | 'defeat' | 'draw'
    trophyChange?: number
    mode: string
  }
  event: { mode: string; map: string }
}

interface CompareTrophyChartProps {
  player1Battles: BattleEntry[]
  player2Battles: BattleEntry[]
  player1Name: string
  player2Name: string
  player1Tag: string
  player2Tag: string
}

interface DataPoint {
  index: number
  change: number
  cumulative: number
}

function buildCumulativePoints(battles: BattleEntry[]): DataPoint[] {
  const ordered = [...battles].reverse()
  let cum = 0
  return ordered.map((b, i) => {
    const change = b.battle.trophyChange ?? 0
    cum += change
    return { index: i, change, cumulative: cum }
  })
}

const PAD_X = 48
const PAD_TOP = 32
const PAD_BOTTOM = 44

function niceStep(min: number, max: number, count: number): number {
  const range = Math.max(Math.abs(max - min), 1)
  const rough = range / count
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const residual = rough / mag
  let nice: number
  if (residual <= 1.5) nice = 1
  else if (residual <= 3) nice = 2
  else if (residual <= 7) nice = 5
  else nice = 10
  return Math.max(nice * mag, 1)
}

export function CompareTrophyChart({
  player1Battles,
  player2Battles,
  player1Name,
  player2Name,
}: CompareTrophyChartProps) {
  const t = useTranslations('battles')
  const uid = useId()
  const [hovered, setHovered] = useState<{ player: 1 | 2; idx: number } | null>(null)

  const p1Points = useMemo(() => buildCumulativePoints(player1Battles), [player1Battles])
  const p2Points = useMemo(() => buildCumulativePoints(player2Battles), [player2Battles])

  const svgW = 720
  const svgH = 320

  const geometry = useMemo(() => {
    const allValues = [...p1Points.map(p => p.cumulative), ...p2Points.map(p => p.cumulative), 0]
    const rawMin = Math.min(...allValues)
    const rawMax = Math.max(...allValues)
    const range = rawMax - rawMin || 1
    const yMin = rawMin - range * 0.15
    const yMax = rawMax + range * 0.15

    const plotW = svgW - PAD_X * 2
    const plotH = svgH - PAD_TOP - PAD_BOTTOM

    const maxLen = Math.max(p1Points.length, p2Points.length, 1)

    const toX = (i: number, total: number) =>
      PAD_X + (total > 1 ? (i / (total - 1)) * plotW : plotW / 2)

    const toY = (v: number) =>
      PAD_TOP + plotH - ((v - yMin) / (yMax - yMin)) * plotH

    const p1Coords = p1Points.map((p, i) => ({ x: toX(i, p1Points.length), y: toY(p.cumulative), point: p }))
    const p2Coords = p2Points.map((p, i) => ({ x: toX(i, p2Points.length), y: toY(p.cumulative), point: p }))

    const zeroY = toY(0)

    const step = niceStep(rawMin, rawMax, 5)
    const yLabels: { value: number; y: number }[] = []
    for (let v = Math.ceil(yMin / step) * step; v <= Math.floor(yMax / step) * step; v += step) {
      yLabels.push({ value: v, y: toY(v) })
    }

    return { p1Coords, p2Coords, zeroY, yLabels, maxLen }
  }, [p1Points, p2Points])

  if (p1Points.length === 0 && p2Points.length === 0) return null

  const { p1Coords, p2Coords, zeroY, yLabels } = geometry

  const makePath = (coords: typeof p1Coords) =>
    coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')

  const p1Path = makePath(p1Coords)
  const p2Path = makePath(p2Coords)

  const p1Final = p1Points.length > 0 ? p1Points[p1Points.length - 1].cumulative : 0
  const p2Final = p2Points.length > 0 ? p2Points[p2Points.length - 1].cumulative : 0

  const gradP1 = `${uid}-g1`
  const gradP2 = `${uid}-g2`
  const glowP1 = `${uid}-glow1`
  const glowP2 = `${uid}-glow2`

  return (
    <div className="brawl-card-dark p-5 md:p-8 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[var(--color-brawl-gold)] border-[3px] border-[#121A2F] rounded-xl flex items-center justify-center shadow-[0_3px_0_0_#121A2F] transform rotate-2">
            <span className="text-xl">🏆</span>
          </div>
          <h2 className="font-['Lilita_One'] text-xl md:text-2xl tracking-wide text-white">
            {t('trophyChange')}
          </h2>
        </div>
        <div className="flex items-center gap-4 text-sm font-['Lilita_One']">
          <span className={`${p1Final >= 0 ? 'text-[#4EC0FA]' : 'text-[#4EC0FA]'}`}>
            {p1Final >= 0 ? '+' : ''}{p1Final}
          </span>
          <span className="text-slate-500">vs</span>
          <span className={`${p2Final >= 0 ? 'text-[#F82F41]' : 'text-[#F82F41]'}`}>
            {p2Final >= 0 ? '+' : ''}{p2Final}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full overflow-hidden rounded-xl bg-[#121A2F]/60 border border-white/5">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto">
          <defs>
            <linearGradient id={gradP1} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#4EC0FA" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#4EC0FA" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id={gradP2} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#F82F41" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#F82F41" stopOpacity={0.02} />
            </linearGradient>
            <filter id={glowP1} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            </filter>
            <filter id={glowP2} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            </filter>
          </defs>

          {/* Grid */}
          {yLabels.map(l => (
            <line key={l.value} x1={PAD_X} y1={l.y} x2={svgW - PAD_X} y2={l.y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          ))}

          {/* Zero line */}
          <line x1={PAD_X - 6} y1={zeroY} x2={svgW - PAD_X + 6} y2={zeroY} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} strokeDasharray="6 4" />
          <text x={PAD_X - 10} y={zeroY + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize={10} fontFamily="Inter, sans-serif" fontWeight={600}>0</text>

          {/* Y labels */}
          {yLabels.filter(l => l.value !== 0).map(l => (
            <text key={l.value} x={PAD_X - 10} y={l.y + 4} textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize={10} fontFamily="Inter, sans-serif">
              {l.value > 0 ? `+${l.value}` : l.value}
            </text>
          ))}

          {/* Area fills */}
          {p1Coords.length > 1 && (
            <path d={`${p1Path} L ${p1Coords[p1Coords.length - 1].x} ${zeroY} L ${p1Coords[0].x} ${zeroY} Z`} fill={`url(#${gradP1})`} opacity={0.6} />
          )}
          {p2Coords.length > 1 && (
            <path d={`${p2Path} L ${p2Coords[p2Coords.length - 1].x} ${zeroY} L ${p2Coords[0].x} ${zeroY} Z`} fill={`url(#${gradP2})`} opacity={0.6} />
          )}

          {/* Lines — Player 1 (blue) */}
          {p1Coords.length > 1 && (
            <>
              <path d={p1Path} fill="none" stroke="#4EC0FA" strokeWidth={5} strokeOpacity={0.3} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${glowP1})`} />
              <path d={p1Path} fill="none" stroke="#4EC0FA" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {/* Lines — Player 2 (red) */}
          {p2Coords.length > 1 && (
            <>
              <path d={p2Path} fill="none" stroke="#F82F41" strokeWidth={5} strokeOpacity={0.3} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${glowP2})`} />
              <path d={p2Path} fill="none" stroke="#F82F41" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {/* Dots — Player 1 */}
          {p1Coords.map((c, i) => (
            <g key={`p1-${i}`}>
              <circle cx={c.x} cy={c.y} r={hovered?.player === 1 && hovered.idx === i ? 7 : 4} fill="#4EC0FA" stroke="#121A2F" strokeWidth={2} style={{ transition: 'r 0.15s' }} />
              <circle cx={c.x} cy={c.y} r={14} fill="transparent" onMouseEnter={() => setHovered({ player: 1, idx: i })} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }} />
            </g>
          ))}

          {/* Dots — Player 2 */}
          {p2Coords.map((c, i) => (
            <g key={`p2-${i}`}>
              <circle cx={c.x} cy={c.y} r={hovered?.player === 2 && hovered.idx === i ? 7 : 4} fill="#F82F41" stroke="#121A2F" strokeWidth={2} style={{ transition: 'r 0.15s' }} />
              <circle cx={c.x} cy={c.y} r={14} fill="transparent" onMouseEnter={() => setHovered({ player: 2, idx: i })} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }} />
            </g>
          ))}

          {/* Tooltip */}
          {hovered && (() => {
            const coords = hovered.player === 1 ? p1Coords : p2Coords
            const c = coords[hovered.idx]
            if (!c) return null
            const color = hovered.player === 1 ? '#4EC0FA' : '#F82F41'
            const name = hovered.player === 1 ? player1Name : player2Name
            const sign = c.point.change >= 0 ? '+' : ''
            const tw = 160
            const flipped = c.x > svgW * 0.65
            const tx = flipped ? c.x - tw - 10 : c.x + 10
            const ty = Math.max(4, c.y - 60)
            return (
              <foreignObject x={tx} y={ty} width={tw} height={56} style={{ pointerEvents: 'none' }}>
                <div style={{ background: 'rgba(18,26,47,0.96)', border: `2px solid ${color}40`, borderRadius: 10, padding: '6px 10px' }}>
                  <p style={{ margin: 0, fontFamily: "'Lilita One'", fontSize: 11, color, lineHeight: 1.2 }}>{name}</p>
                  <p style={{ margin: '3px 0 0', fontFamily: "'Lilita One'", fontSize: 14, color: c.point.change >= 0 ? '#4ade80' : '#f87171', lineHeight: 1.2 }}>
                    {sign}{c.point.change} 🏆 ({sign}{c.point.cumulative})
                  </p>
                </div>
              </foreignObject>
            )
          })()}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs font-semibold">
        <span className="flex items-center gap-1.5 text-[#4EC0FA]">
          <span className="inline-block w-3 h-1 rounded-full bg-[#4EC0FA]" />
          {player1Name}
        </span>
        <span className="flex items-center gap-1.5 text-[#F82F41]">
          <span className="inline-block w-3 h-1 rounded-full bg-[#F82F41]" />
          {player2Name}
        </span>
      </div>
    </div>
  )
}
