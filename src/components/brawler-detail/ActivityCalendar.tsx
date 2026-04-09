'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { CalendarDay } from '@/lib/brawler-detail/types'

interface Props {
  calendarDays: CalendarDay[]
}

/** Map game count to a Tailwind color class based on activity intensity */
function intensityClass(games: number): string {
  if (games === 0) return 'bg-white/5'
  if (games === 1) return 'bg-[#FFC91B]/20'
  if (games <= 3) return 'bg-[#FFC91B]/40'
  if (games <= 5) return 'bg-[#FFC91B]/70'
  return 'bg-[#FFC91B]'
}

/** Format an ISO date string for display in tooltip */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

export function ActivityCalendar({ calendarDays }: Props) {
  const t = useTranslations('brawlerDetail')

  const grid = useMemo(() => {
    // Index calendar days by date for O(1) lookup
    const dayIndex = new Map<string, CalendarDay>()
    for (const d of calendarDays) {
      dayIndex.set(d.date, d)
    }

    // Build 90-day grid from today backwards
    const today = new Date()
    const cells: { date: string; games: number; wins: number }[] = []

    for (let i = 89; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const iso = d.toISOString().slice(0, 10)
      const entry = dayIndex.get(iso)
      cells.push({
        date: iso,
        games: entry?.games ?? 0,
        wins: entry?.wins ?? 0,
      })
    }

    // Arrange into columns (weeks). Each column has 7 rows (Mon=0 .. Sun=6).
    // The first column may have leading empty slots if day 0 doesn't start on Monday.
    const firstDate = new Date(cells[0].date)
    // getDay(): 0=Sun, convert to Mon=0 format
    const firstDayOfWeek = (firstDate.getDay() + 6) % 7

    const columns: (typeof cells[number] | null)[][] = []
    let currentCol: (typeof cells[number] | null)[] = []

    // Pad the first column with null slots
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentCol.push(null)
    }

    for (const cell of cells) {
      currentCol.push(cell)
      if (currentCol.length === 7) {
        columns.push(currentCol)
        currentCol = []
      }
    }

    // Push any remaining partial column
    if (currentCol.length > 0) {
      columns.push(currentCol)
    }

    return columns
  }, [calendarDays])

  return (
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">{'\uD83D\uDCC5'}</span> {t('calendar')}
      </h3>

      <div className="grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: 'repeat(7, 1fr)' }}>
        {grid.map((column, colIdx) =>
          column.map((cell, rowIdx) => {
            if (!cell) {
              return (
                <div
                  key={`empty-${colIdx}-${rowIdx}`}
                  className="w-3 h-3"
                />
              )
            }

            const tooltip = `${formatDate(cell.date)}: ${cell.games} ${t('games')}, ${cell.wins} wins`

            return (
              <div
                key={cell.date}
                className={`w-3 h-3 rounded-sm ${intensityClass(cell.games)} transition-colors`}
                title={tooltip}
              />
            )
          }),
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="font-['Lilita_One'] text-[10px] text-slate-500">0</span>
        <div className="w-3 h-3 rounded-sm bg-white/5" />
        <div className="w-3 h-3 rounded-sm bg-[#FFC91B]/20" />
        <div className="w-3 h-3 rounded-sm bg-[#FFC91B]/40" />
        <div className="w-3 h-3 rounded-sm bg-[#FFC91B]/70" />
        <div className="w-3 h-3 rounded-sm bg-[#FFC91B]" />
        <span className="font-['Lilita_One'] text-[10px] text-slate-500">6+</span>
      </div>
    </div>
  )
}
