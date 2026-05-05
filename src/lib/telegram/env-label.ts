/**
 * Per-environment prefix for admin Telegram alerts.
 *
 * Without this, prod and preview deploys send identical-looking
 * messages to the same chat — when both run the same bot token,
 * an admin can't distinguish "real PayPal subscription cancelled"
 * from "preview testing the webhook". Prefixing every notification
 * with a label makes the source visible at a glance.
 *
 * The function is a pure read of `VERCEL_ENV` (the Vercel-injected
 * environment indicator: 'production', 'preview', or 'development').
 * Returns an empty string in development so local logs aren't
 * cluttered when the bot token is set.
 */

export function getEnvLabel(): string {
  // `||` (not `??`) so empty-string VERCEL_ENV in dev or local CI also
  // falls through to NODE_ENV. Vitest's `vi.stubEnv` sets '' rather
  // than undefined when un-mocking a previously stubbed value.
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV
  switch (env) {
    case 'production':
      return '🟢 prod'
    case 'preview':
      return '🟡 preview'
    case 'development':
      return '🔵 dev'
    default:
      // Unknown — surface it instead of silently swallowing so a
      // misconfigured deploy is visible in the alert itself.
      return env ? `❔ ${env}` : ''
  }
}

/**
 * Produce a one-line header to prepend to admin notifications.
 * Format: `[ENV_LABEL]\n` — ready to be concatenated into an HTML
 * message body. Empty string when there's no label (dev without
 * VERCEL_ENV), so callers can safely use `${envHeader()}rest…`.
 */
export function envHeader(): string {
  const label = getEnvLabel()
  return label ? `<i>${label}</i>\n` : ''
}
