import type { CommandHandler } from '../types'

const HELP_MESSAGE = `🤖 <b>BrawlVision Bot</b>

Comandos disponibles:

/stats — resumen global del sistema
/batallas — estado del battle sync
/premium — métricas de monetización
/cron — estado de los cron jobs
/mapa &lt;nombre&gt; — datos de un mapa específico
/mapa — listado de mapas con datos hoy

/help — este mensaje

Formato de nombres de mapa:
  case-insensitive + prefix match
  /mapa side → "Sidetrack"
  /mapa heal → "Healthy Middle Ground"`

export const handleHelp: CommandHandler = async () => HELP_MESSAGE
