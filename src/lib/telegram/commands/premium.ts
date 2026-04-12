import { fmtNumber, section } from '../formatters'
import type { CommandHandler } from '../types'

function pct(num: number, denom: number): string {
  if (denom === 0) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

export const handlePremium: CommandHandler = async ({ queries }) => {
  const p = await queries.getPremium()
  const now = new Date()
  const nowLabel = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  const estado = [
    `  Premium activos: ${fmtNumber(p.premiumActive)}`,
    `  En trial:        ${fmtNumber(p.trialActive)}`,
    `  Free:            ${fmtNumber(p.freeUsers)}`,
  ].join('\n')

  const funnel = [
    `  Nuevos signups:              ${fmtNumber(p.signupsLast30d)}`,
    `  Activaron trial:             ${fmtNumber(p.trialsActivatedLast30d)}  (${pct(p.trialsActivatedLast30d, p.signupsLast30d)})`,
    `  Trial → premium:             ${fmtNumber(p.trialToPremiumLast30d)}   (${pct(p.trialToPremiumLast30d, p.trialsActivatedLast30d)})`,
    `  Trials expirados:            ${fmtNumber(p.trialsExpiredLast30d)}`,
    `  Churn (premium cancelados):  — (requiere tabla subscriptions)`,
  ].join('\n')

  const revenue = [
    '  — ninguna detectada',
    '  (Requiere integración con tabla de subscriptions',
    '   de PayPal — v2 cuando se active)',
  ].join('\n')

  const ltv = [
    '  (Requiere tabla de payments — ver docs/crons/README.md',
    '   para el plan de integración)',
  ].join('\n')

  return [
    '💎 <b>PREMIUM</b>',
    nowLabel,
    '',
    section('✨', 'ESTADO ACTUAL', estado),
    '',
    section('📈', 'FUNNEL 30 DÍAS', funnel),
    '',
    section('📅', 'PRÓXIMAS RENOVACIONES (próximos 7d)', revenue),
    '',
    section('⭐', 'LTV / REVENUE', ltv),
  ].join('\n')
}
