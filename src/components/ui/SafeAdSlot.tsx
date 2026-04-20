'use client'

import { AdPlaceholder } from './AdPlaceholder'

interface Props {
  /**
   * The caller must affirm that the surrounding page has
   * substantial rendered content when this slot is reached.
   *
   * AdSense's "Valuable Inventory" policy forbids ads on screens
   * without publisher content (loading states, empty results,
   * error boxes, auth gates). Rather than hoping every callsite
   * remembers to gate its `<AdPlaceholder>`, this component
   * makes the gate a required prop — forgetting it is a type
   * error, and passing `false` returns `null`.
   *
   * For each new ad slot on a public page, the caller should
   * derive `hasContent` from the same condition that proves
   * meaningful content is visible above the slot:
   *   - a data hook returned `data && !error`
   *   - a server-rendered list has `items.length > 0`
   *   - a static section's translated array is non-empty
   *
   * Never pass a literal `true` — that defeats the defensive
   * design. If there's genuinely no condition to check, the
   * page probably shouldn't have an ad.
   */
  hasContent: boolean
  className?: string
}

export function SafeAdSlot({ hasContent, className }: Props) {
  if (!hasContent) return null
  return <AdPlaceholder className={className} />
}
