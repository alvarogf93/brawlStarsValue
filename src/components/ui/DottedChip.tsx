import type { ReactNode } from 'react'

interface DottedChipProps {
  /** Background color (hex or CSS value) */
  bg?: string
  /** Use light dots on dark backgrounds */
  dark?: boolean
  /** Additional className */
  className?: string
  children: ReactNode
}

/**
 * Chip with colored dotted background — part of the Brawl Stars design system.
 * Default: white background with gray dots.
 * Use `bg` to set a custom color and `dark` for light dots on dark backgrounds.
 */
export function DottedChip({ bg = 'white', dark = false, className = '', children }: DottedChipProps) {
  const textColor = dark ? 'text-white' : 'text-[#121A2F]'
  const dotColor = dark ? 'rgba(255,255,255,0.15)' : 'rgba(18,26,47,0.15)'

  return (
    <span
      className={`relative inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-[var(--color-brawl-dark)] text-[10px] font-['Lilita_One'] shadow-[0_2px_0_rgba(18,26,47,1)] overflow-hidden ${textColor} ${className}`}
      style={{ backgroundColor: bg }}
    >
      <span
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(${dotColor} 1px, transparent 1px)`,
          backgroundSize: '6px 6px',
        }}
      />
      <span className="relative">{children}</span>
    </span>
  )
}
