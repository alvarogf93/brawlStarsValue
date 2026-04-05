import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['es', 'en', 'fr', 'pt', 'de'],
  defaultLocale: 'es',
})

import { createNavigation } from 'next-intl/navigation'
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing)
