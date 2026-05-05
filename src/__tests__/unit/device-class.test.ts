import { describe, it, expect } from 'vitest'
import { classifyUserAgent } from '@/lib/device-class'

describe('classifyUserAgent', () => {
  it('returns null for missing/empty UA', () => {
    expect(classifyUserAgent(null)).toBeNull()
    expect(classifyUserAgent(undefined)).toBeNull()
    expect(classifyUserAgent('')).toBeNull()
  })

  it('flags common bot UAs', () => {
    expect(classifyUserAgent('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe('bot')
    expect(classifyUserAgent('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe('bot')
    expect(classifyUserAgent('curl/7.79.1')).toBe('bot')
    expect(classifyUserAgent('python-requests/2.28.1')).toBe('bot')
    expect(classifyUserAgent('node-fetch/1.0')).toBe('bot')
    expect(classifyUserAgent('Slackbot-LinkExpanding 1.0')).toBe('bot')
    expect(classifyUserAgent('Twitterbot/1.0')).toBe('bot')
  })

  it('flags iPhone as mobile', () => {
    expect(classifyUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15')).toBe('mobile')
  })

  it('flags iPad as tablet', () => {
    expect(classifyUserAgent('Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15')).toBe('tablet')
  })

  it('flags Android phone as mobile (has both "android" and "mobile" tokens)', () => {
    expect(classifyUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile')).toBe('mobile')
  })

  it('flags Android tablet (no "mobile" token) as tablet', () => {
    expect(classifyUserAgent('Mozilla/5.0 (Linux; Android 14; SM-X510) AppleWebKit/537.36')).toBe('tablet')
  })

  it('flags desktop Chrome as desktop', () => {
    expect(classifyUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')).toBe('desktop')
  })

  it('flags macOS Safari as desktop', () => {
    expect(classifyUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15')).toBe('desktop')
  })
})
