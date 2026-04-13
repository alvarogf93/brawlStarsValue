'use client'

import { useState, useMemo, useId } from 'react'
import { useTranslations } from 'next-intl'
import { getGameModeImageUrl } from '@/lib/utils'
import { MODE_DISPLAY_NAMES } from '@/lib/constants'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BattleEntry {
  battleTime: string
  battle: {
    result: 'victory' | 'defeat' | 'draw'
    trophyChange?: number
    mode: string
    starPlayer?: {
      tag: string
      name: string
      brawler: { id: number; name: string; power: number; trophies: number }
    }
  }
  event: { mode: string; map: string }
}

interface TrophyChartProps {
  battles: BattleEntry[]
  playerTag: string
}

/* ------------------------------------------------------------------ */
/*  Data helpers                                                       */
/* ------------------------------------------------------------------ */

interface DataPoint {
  index: number
  battle: BattleEntry
  change: number
  cumulative: number
  result: 'victory' | 'defeat' | 'draw'
  isStarPlayer: boolean
}

function buildDataPoints(
  battles: BattleEntry[],
  playerTag: string,
): DataPoint[] {
  // Oldest first so the chart reads left-to-right chronologically
  const ordered = [...battles].reverse()
  let cumulative = 0

  return ordered.map((b, i) => {
    const change = b.battle.trophyChange ?? 0
    cumulative += change
    return {
      index: i,
      battle: b,
      change,
      cumulative,
      result: b.battle.result,
      isStarPlayer: b.battle.starPlayer?.tag === playerTag,
    }
  })
}

/* ------------------------------------------------------------------ */
/*  SVG geometry                                                       */
/* ------------------------------------------------------------------ */

const CHART_PADDING_X = 48
const CHART_PADDING_TOP = 32
const CHART_PADDING_BOTTOM = 40
const DOT_RADIUS = 6
const DOT_HOVER_RADIUS = 9

function useChartGeometry(points: DataPoint[], width: number, height: number) {
  return useMemo(() => {
    if (points.length === 0) {
      return { coords: [], yMin: 0, yMax: 0, zeroY: height / 2, yLabels: [] }
    }

    const values = points.map((p) => p.cumulative)
    const rawMin = Math.min(0, ...values)
    const rawMax = Math.max(0, ...values)
    const range = rawMax - rawMin || 1
    const padFraction = 0.15
    const yMin = rawMin - range * padFraction
    const yMax = rawMax + range * padFraction

    const plotW = width - CHART_PADDING_X * 2
    const plotH = height - CHART_PADDING_TOP - CHART_PADDING_BOTTOM

    const toX = (i: number) =>
      CHART_PADDING_X +
      (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2)

    const toY = (v: number) =>
      CHART_PADDING_TOP + plotH - ((v - yMin) / (yMax - yMin)) * plotH

    const coords = points.map((p) => ({
      x: toX(p.index),
      y: toY(p.cumulative),
      point: p,
    }))

    const zeroY = toY(0)

    // Y-axis labels: generate ~5 nice round labels
    const step = niceStep(rawMin, rawMax, 5)
    const yLabels: { value: number; y: number }[] = []
    const labelMin = Math.ceil(yMin / step) * step
    const labelMax = Math.floor(yMax / step) * step
    for (let v = labelMin; v <= labelMax; v += step) {
      yLabels.push({ value: v, y: toY(v) })
    }

    return { coords, yMin, yMax, zeroY, yLabels }
  }, [points, width, height])
}

/** Pick a "nice" tick step for roughly `count` ticks between min and max. */
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

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Tooltip({
  point,
  x,
  y,
  chartWidth,
  t,
}: {
  point: DataPoint
  x: number
  y: number
  chartWidth: number
  t: (key: string) => string
}) {
  const mode = point.battle.battle.mode || point.battle.event.mode
  const map = point.battle.event.map
  const sign = point.change >= 0 ? '+' : ''

  const tooltipW = 180
  const tooltipH = point.isStarPlayer ? 88 : 72
  const flipped = x > chartWidth * 0.65

  // Position: above the dot, flipped horizontally if near edge
  const tx = flipped ? x - tooltipW - 10 : x + 10
  const ty = Math.max(4, y - tooltipH - 16)

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Connector line from dot to tooltip */}
      <line
        x1={x} y1={y - DOT_HOVER_RADIUS}
        x2={flipped ? tx + tooltipW : tx} y2={ty + tooltipH}
        stroke="rgba(255,255,255,0.2)" strokeWidth={1}
      />

      {/* HTML tooltip via foreignObject — auto-sizes to content */}
      <foreignObject x={tx} y={ty} width={tooltipW} height={tooltipH}>
        <div
          style={{
            background: 'rgba(18,26,47,0.96)',
            border: '2px solid rgba(255,255,255,0.15)',
            borderRadius: 10,
            padding: '8px 12px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <p style={{ margin: 0, fontFamily: "'Lilita One', sans-serif", fontSize: 12, color: '#FFC91B', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 6 }}>
            {(() => {
              const url = getGameModeImageUrl(mode)
              return url ? <img src={url} alt="" width={14} height={14} style={{ verticalAlign: 'middle' }} /> : null
            })()}
            {(MODE_DISPLAY_NAMES[mode] ?? mode).toUpperCase()}
          </p>
          <p style={{ margin: '2px 0 0', fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#94a3b8', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {map}
          </p>
          <p style={{ margin: '4px 0 0', fontFamily: "'Lilita One', sans-serif", fontSize: 13, color: point.change >= 0 ? '#4ade80' : '#f87171', lineHeight: 1.2 }}>
            {sign}{point.change} 🏆
          </p>
          {point.isStarPlayer && (
            <p style={{ margin: '2px 0 0', fontFamily: "'Lilita One', sans-serif", fontSize: 10, color: '#FFC91B', lineHeight: 1.2 }}>
              ⭐ {t('starPlayer')}
            </p>
          )}
        </div>
      </foreignObject>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function TrophyChart({ battles, playerTag }: TrophyChartProps) {
  const t = useTranslations('battles')
  const uid = useId()
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const points = useMemo(
    () => buildDataPoints(battles, playerTag),
    [battles, playerTag],
  )

  // Responsive: use viewBox so the SVG scales naturally
  const svgW = 720
  const svgH = 340

  const { coords, zeroY, yLabels } = useChartGeometry(points, svgW, svgH)

  if (points.length === 0) return null

  const finalCumulative = points[points.length - 1].cumulative
  const trendUp = finalCumulative > 0
  const trendDown = finalCumulative < 0

  /* ---- Path strings ---- */

  const lineD = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
    .join(' ')

  // Area: close down to zero line, sweep back
  const areaD =
    lineD +
    ` L ${coords[coords.length - 1].x} ${zeroY}` +
    ` L ${coords[0].x} ${zeroY} Z`

  // Approximate total path length for animation
  let pathLen = 0
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i].x - coords[i - 1].x
    const dy = coords[i].y - coords[i - 1].y
    pathLen += Math.sqrt(dx * dx + dy * dy)
  }
  pathLen = Math.ceil(pathLen)

  /* ---- Color helpers ---- */

  const dotColor = (result: string) => {
    if (result === 'victory') return '#4ade80'
    if (result === 'defeat') return '#f87171'
    return '#facc15'
  }

  const gradIdPos = `${uid}-grad-pos`
  const gradIdNeg = `${uid}-grad-neg`
  const glowId = `${uid}-glow`
  const clipAbove = `${uid}-clip-above`
  const clipBelow = `${uid}-clip-below`

  return (
    <div className="brawl-card-dark p-5 md:p-8 w-full animate-fade-in">
      {/* ---- Inline keyframes ---- */}
      <style>{`
        @keyframes drawLine {
          from { stroke-dashoffset: ${pathLen}; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeInDot {
          from { opacity: 0; transform: scale(0.3); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes pulseGlow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(78,192,250,0.6)); }
          50%      { filter: drop-shadow(0 0 14px rgba(78,192,250,1)) drop-shadow(0 0 24px rgba(78,192,250,0.4)); }
        }
        @keyframes arrowBounce {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes areaReveal {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .trophy-chart__line {
          stroke-dasharray: ${pathLen};
          stroke-dashoffset: ${pathLen};
          animation: drawLine 1.5s ease-out forwards;
        }
        .trophy-chart__area {
          opacity: 0;
          animation: areaReveal 0.6s ease-out 1.2s forwards;
        }
        .trophy-chart__dot {
          opacity: 0;
          transform-origin: center;
          transform-box: fill-box;
        }
        ${coords
          .map(
            (_, i) =>
              `.trophy-chart__dot--${i} { animation: fadeInDot 0.35s ease-out ${0.8 + i * 0.05}s forwards; }`,
          )
          .join('\n')}
        .trophy-chart__dot--last {
          animation: fadeInDot 0.35s ease-out ${0.8 + (coords.length - 1) * 0.05}s forwards,
                     pulseGlow 2s ease-in-out ${0.8 + (coords.length - 1) * 0.05 + 0.4}s infinite !important;
        }
        .trophy-chart__trend-arrow {
          animation: arrowBounce 1.4s ease-in-out 2s infinite;
          transform-origin: center;
        }
        .trophy-chart__dot-hover {
          cursor: pointer;
          transition: r 0.15s ease;
        }
      `}</style>

      {/* ---- Header ---- */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[var(--color-brawl-gold)] border-[3px] border-[#121A2F] rounded-xl flex items-center justify-center shadow-[0_3px_0_0_#121A2F] transform rotate-2">
            <span className="text-xl leading-none">&#127942;</span>
          </div>
          <h2 className="font-['Lilita_One'] text-xl md:text-2xl tracking-wide text-white transform rotate-[-0.5deg]">
            {t('trophyChange')}
          </h2>
        </div>

        {/* Trend indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`font-['Lilita_One'] text-2xl ${trendUp ? 'text-green-400' : trendDown ? 'text-red-400' : 'text-slate-400'}`}
          >
            {finalCumulative >= 0 ? '+' : ''}
            {finalCumulative}
          </span>
          {(trendUp || trendDown) && (
            <span className="trophy-chart__trend-arrow inline-block text-2xl leading-none">
              {trendUp ? (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 22 22"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M11 2L4 13h4.5v7h5v-7H18L11 2z"
                    fill="#4ade80"
                    stroke="#121A2F"
                    strokeWidth={1.5}
                  />
                </svg>
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 22 22"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M11 20L18 9h-4.5V2h-5v7H4l7 11z"
                    fill="#f87171"
                    stroke="#121A2F"
                    strokeWidth={1.5}
                  />
                </svg>
              )}
            </span>
          )}
        </div>
      </div>

      {/* ---- SVG Chart ---- */}
      <div className="w-full overflow-hidden rounded-xl bg-[#121A2F]/60 border border-white/5">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Trophy progression chart showing ${finalCumulative >= 0 ? 'gain' : 'loss'} of ${Math.abs(finalCumulative)} trophies over ${points.length} battles`}
        >
          <defs>
            {/* Positive gradient (green) */}
            <linearGradient id={gradIdPos} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#4ade80" stopOpacity={0.02} />
            </linearGradient>

            {/* Negative gradient (red) */}
            <linearGradient id={gradIdNeg} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f87171" stopOpacity={0.02} />
              <stop offset="100%" stopColor="#f87171" stopOpacity={0.35} />
            </linearGradient>

            {/* Line glow */}
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Clip: above zero line */}
            <clipPath id={clipAbove}>
              <rect x={0} y={0} width={svgW} height={zeroY} />
            </clipPath>

            {/* Clip: below zero line */}
            <clipPath id={clipBelow}>
              <rect x={0} y={zeroY} width={svgW} height={svgH - zeroY} />
            </clipPath>
          </defs>

          {/* ---- Grid lines (subtle) ---- */}
          {yLabels.map((l) => (
            <line
              key={l.value}
              x1={CHART_PADDING_X}
              y1={l.y}
              x2={svgW - CHART_PADDING_X}
              y2={l.y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          ))}

          {/* ---- Zero line (dashed) ---- */}
          <line
            x1={CHART_PADDING_X - 6}
            y1={zeroY}
            x2={svgW - CHART_PADDING_X + 6}
            y2={zeroY}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <text
            x={CHART_PADDING_X - 10}
            y={zeroY + 4}
            textAnchor="end"
            fill="rgba(255,255,255,0.35)"
            fontSize={10}
            fontFamily="Inter, sans-serif"
            fontWeight={600}
          >
            0
          </text>

          {/* ---- Y-axis labels ---- */}
          {yLabels
            .filter((l) => l.value !== 0)
            .map((l) => (
              <text
                key={l.value}
                x={CHART_PADDING_X - 10}
                y={l.y + 4}
                textAnchor="end"
                fill="rgba(255,255,255,0.25)"
                fontSize={10}
                fontFamily="Inter, sans-serif"
                fontWeight={500}
              >
                {l.value > 0 ? `+${l.value}` : l.value}
              </text>
            ))}

          {/* ---- X-axis labels (battle numbers, every few) ---- */}
          {coords.map((c, i) => {
            const showEvery = coords.length <= 12 ? 1 : coords.length <= 25 ? 2 : 4
            if (i % showEvery !== 0 && i !== coords.length - 1) return null
            return (
              <text
                key={i}
                x={c.x}
                y={svgH - 10}
                textAnchor="middle"
                fill="rgba(255,255,255,0.2)"
                fontSize={9}
                fontFamily="Inter, sans-serif"
              >
                {i + 1}
              </text>
            )
          })}

          {/* ---- Area fills (split by zero) ---- */}
          {/* Positive area (green, above zero) */}
          <path
            className="trophy-chart__area"
            d={areaD}
            fill={`url(#${gradIdPos})`}
            clipPath={`url(#${clipAbove})`}
          />
          {/* Negative area (red, below zero) */}
          <path
            className="trophy-chart__area"
            d={areaD}
            fill={`url(#${gradIdNeg})`}
            clipPath={`url(#${clipBelow})`}
          />

          {/* ---- Glowing line ---- */}
          <path
            className="trophy-chart__line"
            d={lineD}
            fill="none"
            stroke="rgba(78,192,250,0.25)"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${glowId})`}
          />
          <path
            className="trophy-chart__line"
            d={lineD}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* ---- Data dots ---- */}
          {coords.map((c, i) => {
            const isLast = i === coords.length - 1
            const isHovered = hoveredIdx === i

            return (
              <g key={i}>
                {/* Outer glow ring on hover */}
                {isHovered && (
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={DOT_HOVER_RADIUS + 4}
                    fill="none"
                    stroke={dotColor(c.point.result)}
                    strokeWidth={2}
                    strokeOpacity={0.3}
                  />
                )}

                {/* Star player ring */}
                {c.point.isStarPlayer && (
                  <circle
                    className={`trophy-chart__dot trophy-chart__dot--${i}${isLast ? ' trophy-chart__dot--last' : ''}`}
                    cx={c.x}
                    cy={c.y}
                    r={DOT_RADIUS + 3}
                    fill="none"
                    stroke="#FFC91B"
                    strokeWidth={2}
                    strokeDasharray="3 2"
                  />
                )}

                {/* Visible dot */}
                <circle
                  className={`trophy-chart__dot trophy-chart__dot--${i}${isLast ? ' trophy-chart__dot--last' : ''}`}
                  cx={c.x}
                  cy={c.y}
                  r={isHovered ? DOT_HOVER_RADIUS : DOT_RADIUS}
                  fill={dotColor(c.point.result)}
                  stroke="#121A2F"
                  strokeWidth={2}
                  style={{ transition: 'r 0.15s ease' }}
                />

                {/* Invisible hit area */}
                <circle
                  className="trophy-chart__dot-hover"
                  cx={c.x}
                  cy={c.y}
                  r={16}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onFocus={() => setHoveredIdx(i)}
                  onBlur={() => setHoveredIdx(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Battle ${i + 1}: ${c.point.result}, ${c.point.change >= 0 ? '+' : ''}${c.point.change} trophies`}
                />
              </g>
            )
          })}

          {/* ---- Pulsing ring on the last point ---- */}
          {coords.length > 0 && (
            <circle
              className="trophy-chart__dot trophy-chart__dot--last"
              cx={coords[coords.length - 1].x}
              cy={coords[coords.length - 1].y}
              r={DOT_HOVER_RADIUS + 6}
              fill="none"
              stroke={trendUp ? '#4ade80' : trendDown ? '#f87171' : '#94a3b8'}
              strokeWidth={1.5}
              strokeOpacity={0.4}
            />
          )}

          {/* ---- Tooltip layer (rendered LAST so it's on top of everything) ---- */}
          {hoveredIdx !== null && coords[hoveredIdx] && (
            <Tooltip
              point={coords[hoveredIdx].point}
              x={coords[hoveredIdx].x}
              y={coords[hoveredIdx].y}
              chartWidth={svgW}
              t={t}
            />
          )}
        </svg>
      </div>

      {/* ---- Legend ---- */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs font-semibold text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" />
          {t('resultVictory')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" />
          {t('resultDefeat')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" />
          {t('resultDraw')}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full border-2 border-dashed border-yellow-400"
          />
          {t('starPlayer')}
        </span>
      </div>
    </div>
  )
}
