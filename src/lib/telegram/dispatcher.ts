import { handleBatallas } from './commands/batallas'
import { handleCron } from './commands/cron'
import { handleHelp } from './commands/help'
import { handleMapa } from './commands/mapa'
import { handlePremium } from './commands/premium'
import { handleStats } from './commands/stats'
import type { CommandHandler } from './types'

export interface ParsedCommand {
  commandName: string  // e.g. '/stats', '' when not a command
  args: string[]
}

/**
 * Parse a Telegram message text into a command name and arg list.
 *
 *  - Case-insensitive: /STATS and /stats are equal.
 *  - Strips `@BotName` suffix that Telegram adds in group chats.
 *  - Non-command text returns an empty `commandName`.
 */
export function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim()
  if (!trimmed.startsWith('/')) return { commandName: '', args: [] }
  const parts = trimmed.split(/\s+/)
  const head = parts[0]
  const atIdx = head.indexOf('@')
  const commandName = (atIdx >= 0 ? head.slice(0, atIdx) : head).toLowerCase()
  return { commandName, args: parts.slice(1) }
}

// Registry: command name → handler.
// Keys must match the lowercase form produced by parseCommand().
export const commandRegistry: Map<string, CommandHandler> = new Map([
  ['/stats',    handleStats],
  ['/batallas', handleBatallas],
  ['/premium',  handlePremium],
  ['/cron',     handleCron],
  ['/mapa',     handleMapa],
  ['/help',     handleHelp],
])
