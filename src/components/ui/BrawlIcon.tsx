/**
 * BrawlIcon — typed wrapper around the upgrade-category icons stored
 * in `public/assets/icons/`. Use this anywhere you need to show the
 * canonical icon for gadgets, star powers, hypercharges, gears or
 * prestige. The asset paths and import are centralized here so the
 * next icon refresh only touches this file + the PNG.
 *
 * Sprint D 2026-04-13 — replaced the generic emoji set
 * (🔧 ⭐ ⚡ 🔩 👑) with the user's custom icon set.
 *
 * For the "currency" gem itself, use `<GemIcon />` from `./GemIcon`.
 * For game-mode icons, use `<ModeIcon mode={...} />`.
 */

const ICON_SRC: Record<BrawlIconName, string> = {
  gadget: '/assets/icons/gadget.png',
  starpower: '/assets/icons/starpower.png',
  hypercharge: '/assets/icons/hypercharge.png',
  gear: '/assets/icons/gear.png',
  prestige: '/assets/icons/prestige.png',
  buffies: '/assets/icons/buffies.png',
}

/**
 * `buffies` is the GENERIC buffies icon — only use it where buffies
 * are referenced in aggregate (e.g. the stats details grid). Do NOT
 * use it inside individual brawler cards where the buffies belong
 * to a specific brawler — those still need brawler-specific imagery.
 */
export type BrawlIconName = 'gadget' | 'starpower' | 'hypercharge' | 'gear' | 'prestige' | 'buffies'

interface Props {
  name: BrawlIconName
  className?: string
  alt?: string
}

export function BrawlIcon({ name, className = 'w-6 h-6', alt = '' }: Props) {
  return (
    <img
      src={ICON_SRC[name]}
      alt={alt}
      aria-hidden={alt ? undefined : 'true'}
      className={`inline-block object-contain ${className}`}
      loading="lazy"
    />
  )
}
