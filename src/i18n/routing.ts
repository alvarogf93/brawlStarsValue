import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh'],
  defaultLocale: 'es',
  // Disable the HTTP `Link: <...>; hreflang=...` header that next-intl
  // injects by default. It sets `x-default` to the bare URL (e.g.
  // `https://brawlvision.com/`), which conflicts with the HTML `<link
  // rel="alternate" hreflang="x-default">` we emit from layouts and
  // with the sitemap, both of which point to `/es`. Two conflicting
  // hreflang sources confuse Google and produced canonicalization
  // noise in Search Console. The HTML metadata is the single source
  // of truth.
  alternateLinks: false,
})

import { createNavigation } from 'next-intl/navigation'
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing)
