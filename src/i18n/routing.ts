import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['es', 'en'],
  defaultLocale: 'es',
})

import { createNavigation } from 'next-intl/navigation'
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing)
