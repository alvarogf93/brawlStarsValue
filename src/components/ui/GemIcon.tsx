/**
 * GemIcon — the canonical "currency gem" of BrawlVision.
 *
 * This is the green/teal star-gem the app uses to represent the
 * unified gem-value currency (powerLevels + gadgets + SPs + HCs +
 * gears + buffies → totalGems). It is NOT the gem-grab game-mode
 * gem (which is purple and lives in ModeIcon for that mode).
 *
 * Sprint D 2026-04-13: replaced the inline SVG (a flat green
 * diamond) with the user's custom asset stored at
 * `public/assets/icons/gem.png` so we have a single source of truth
 * for the currency icon across every screen + the app's brand.
 *
 * USE THIS COMPONENT — never the `💎` literal — anywhere a gem
 * count is shown to a user. The only places that still keep `💎`
 * are: CSV exports (text-only), Telegram bot messages (text-only),
 * and the gem-grab MODE icon's emoji fallback.
 */
export function GemIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <img
      src="/assets/icons/gem.png"
      alt=""
      aria-hidden="true"
      className={`inline-block object-contain drop-shadow-[0_3px_0_rgba(18,26,47,0.8)] ${className}`}
      loading="lazy"
    />
  )
}
