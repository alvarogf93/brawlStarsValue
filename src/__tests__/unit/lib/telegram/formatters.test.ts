import { describe, it, expect } from 'vitest'
import {
  sparkline,
  bar,
  fmtTimeAgo,
  fmtNumber,
  section,
  clampToTelegramLimit,
  escapeHtml,
  bucketByDay,
} from '@/lib/telegram/formatters'
import { TELEGRAM_MESSAGE_LIMIT } from '@/lib/telegram/constants'

describe('sparkline', () => {
  it('renders an ascending series with 8 blocks', () => {
    expect(sparkline([0, 1, 2, 3, 4, 5, 6, 7])).toBe('▁▂▃▄▅▆▇█')
  })

  it('renders a flat series using the lowest block', () => {
    expect(sparkline([3, 3, 3, 3])).toBe('▁▁▁▁')
  })

  it('returns empty string for empty input', () => {
    expect(sparkline([])).toBe('')
  })

  it('handles a single-element series', () => {
    expect(sparkline([5])).toBe('▁')
  })
})

describe('bar', () => {
  it('draws a 20-wide bar at 100%', () => {
    expect(bar(1)).toBe('████████████████████')
  })

  it('draws a 10-wide bar at 50%', () => {
    expect(bar(0.5)).toBe('██████████')
  })

  it('draws an empty bar at 0%', () => {
    expect(bar(0)).toBe('')
  })

  it('clamps over 100% to 20 blocks', () => {
    expect(bar(1.5)).toBe('████████████████████')
  })

  it('clamps negative ratio to 0 blocks', () => {
    expect(bar(-0.2)).toBe('')
  })
})

describe('fmtTimeAgo', () => {
  const NOW = new Date('2026-04-12T18:30:00Z').getTime()

  it('returns "ahora" under 60s', () => {
    expect(fmtTimeAgo(new Date(NOW - 20 * 1000).toISOString(), NOW)).toBe('ahora')
  })

  it('returns minutes under 1h', () => {
    expect(fmtTimeAgo(new Date(NOW - 37 * 60 * 1000).toISOString(), NOW)).toBe('hace 37 min')
  })

  it('returns hours and minutes under 24h', () => {
    const iso = new Date(NOW - (15 * 60 + 30) * 60 * 1000).toISOString()
    expect(fmtTimeAgo(iso, NOW)).toBe('hace 15h 30m')
  })

  it('returns days over 24h', () => {
    const iso = new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(fmtTimeAgo(iso, NOW)).toBe('hace 3 días')
  })

  it('returns "(desconocido)" for null', () => {
    expect(fmtTimeAgo(null, NOW)).toBe('(desconocido)')
  })
})

describe('fmtNumber', () => {
  it('inserts comma thousand separators', () => {
    expect(fmtNumber(1234567)).toBe('1,234,567')
  })

  it('returns small numbers unchanged', () => {
    expect(fmtNumber(42)).toBe('42')
  })

  it('handles zero', () => {
    expect(fmtNumber(0)).toBe('0')
  })
})

describe('section', () => {
  it('prefixes a header with an emoji and newline', () => {
    expect(section('📊', 'TITULO', 'body line')).toBe('📊 TITULO\nbody line')
  })
})

describe('clampToTelegramLimit', () => {
  it('returns the text unchanged when under limit', () => {
    const text = 'hello'
    expect(clampToTelegramLimit(text)).toBe(text)
  })

  it('truncates and appends footer when over limit', () => {
    const longText = 'x'.repeat(TELEGRAM_MESSAGE_LIMIT + 500)
    const clamped = clampToTelegramLimit(longText)
    expect(clamped.length).toBeLessThanOrEqual(TELEGRAM_MESSAGE_LIMIT)
    expect(clamped.endsWith('… (output truncado)')).toBe(true)
  })
})

describe('escapeHtml', () => {
  it('escapes the 5 HTML-relevant characters', () => {
    expect(escapeHtml(`<a href="x&y">'foo'</a>`))
      .toBe('&lt;a href=&quot;x&amp;y&quot;&gt;&#39;foo&#39;&lt;/a&gt;')
  })

  it('returns plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

describe('bucketByDay', () => {
  it('buckets ISO timestamps into daily counts over the window', () => {
    const now = new Date('2026-04-12T12:00:00Z').getTime()
    // 3 rows today, 1 row 2 days ago, 0 other days — window of 7 days.
    const rows = [
      { t: new Date(now - 1 * 60 * 60 * 1000).toISOString() },
      { t: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
      { t: new Date(now - 3 * 60 * 60 * 1000).toISOString() },
      { t: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString() },
    ]
    const buckets = bucketByDay(rows, 't', 7, now)
    expect(buckets).toHaveLength(7)
    expect(buckets[6]).toBe(3)  // today → last bucket
    expect(buckets[4]).toBe(1)  // 2 days ago
    expect(buckets[0]).toBe(0)  // 6 days ago
  })

  it('returns an all-zero window when no rows', () => {
    const buckets = bucketByDay([], 't', 5, Date.now())
    expect(buckets).toEqual([0, 0, 0, 0, 0])
  })
})
