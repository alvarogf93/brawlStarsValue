import { describe, it, expect } from 'vitest'
import { parseCommand, commandRegistry } from '@/lib/telegram/dispatcher'

describe('parseCommand', () => {
  it('parses a simple /stats into name and empty args', () => {
    expect(parseCommand('/stats')).toEqual({ commandName: '/stats', args: [] })
  })

  it('lowercases the command name', () => {
    expect(parseCommand('/STATS')).toEqual({ commandName: '/stats', args: [] })
  })

  it('splits args by whitespace', () => {
    expect(parseCommand('/mapa sidetrack')).toEqual({ commandName: '/mapa', args: ['sidetrack'] })
  })

  it('collapses multiple spaces', () => {
    expect(parseCommand('/mapa   healthy   middle')).toEqual({
      commandName: '/mapa',
      args: ['healthy', 'middle'],
    })
  })

  it('strips a @BotName suffix from the command name', () => {
    expect(parseCommand('/stats@BrawlVisionBot')).toEqual({ commandName: '/stats', args: [] })
    expect(parseCommand('/mapa@BrawlVisionBot side')).toEqual({
      commandName: '/mapa',
      args: ['side'],
    })
  })

  it('returns empty commandName for non-command text', () => {
    expect(parseCommand('hola')).toEqual({ commandName: '', args: [] })
  })

  it('trims leading and trailing whitespace', () => {
    expect(parseCommand('   /stats   ')).toEqual({ commandName: '/stats', args: [] })
  })
})

describe('commandRegistry', () => {
  it('registers 6 commands including /help', () => {
    expect(commandRegistry.has('/stats')).toBe(true)
    expect(commandRegistry.has('/batallas')).toBe(true)
    expect(commandRegistry.has('/premium')).toBe(true)
    expect(commandRegistry.has('/cron')).toBe(true)
    expect(commandRegistry.has('/mapa')).toBe(true)
    expect(commandRegistry.has('/help')).toBe(true)
  })

  it('does not register unknown commands', () => {
    expect(commandRegistry.has('/foo')).toBe(false)
  })
})
