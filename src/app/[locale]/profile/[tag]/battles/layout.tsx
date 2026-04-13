import type { Metadata } from 'next'

// Private dashboard sub-route — exclude from Google's index but
// keep links followable. The parent profile layout's canonical is
// inherited unchanged. See docs/superpowers/plans/2026-04-13-sprint-d-implemented.md
// (SEO fixes) for the rationale.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
