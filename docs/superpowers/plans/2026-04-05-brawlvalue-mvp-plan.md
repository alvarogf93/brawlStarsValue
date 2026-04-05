# BrawlValue MVP Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-language, dashboard-style BrawlValue app — enter a Player Tag on the landing page, enter a profile dashboard with sidebar navigation showing Gem Score, brawler breakdown, stats, and share options across multiple explorable pages.

**Architecture:** Next.js 16 App Router with `next-intl` for i18n (es/en). Landing page → Dashboard with persistent Header + Sidebar. Each profile section is a separate route (= separate page view for ad monetization). API route calculates 4-vector Gem Score from mock data. TDD throughout.

**Tech Stack:** Next.js 16.2, TypeScript 6.0 (strict), next-intl, Tailwind v4.1, shadcn/ui, TanStack Query v5, Vitest, Motion 12.x

---

## Task 1: Project Scaffolding + i18n Setup

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/middleware.ts`, `src/i18n/request.ts`, `src/i18n/routing.ts`, `messages/es.json`, `messages/en.json`, `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`, `src/app/globals.css`, `.env.example`, `.gitignore`, `vitest.config.ts`, `src/test/setup.ts`

- [ ] **Step 1: Create Next.js project**

```bash
cd C:/Proyectos_Agentes/brawlValue
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Accept defaults. Say yes to Turbopack if prompted.

- [ ] **Step 2: Install all dependencies**

```bash
npm install next-intl @tanstack/react-query framer-motion @radix-ui/react-slot class-variance-authority clsx
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event c8 @vitejs/plugin-react
```

- [ ] **Step 3: Add test scripts to package.json**

In the `"scripts"` section, add:

```json
"test": "vitest",
"test:ui": "vitest --ui",
"test:coverage": "vitest --coverage",
"type-check": "tsc --noEmit"
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 5: Create test setup**

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 6: Create i18n routing config**

```typescript
// src/i18n/routing.ts
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['es', 'en'],
  defaultLocale: 'es',
})
```

- [ ] **Step 7: Create i18n request config**

```typescript
// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !routing.locales.includes(locale as 'es' | 'en')) {
    locale = routing.defaultLocale
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
```

- [ ] **Step 8: Create locale middleware**

```typescript
// src/middleware.ts
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  matcher: ['/', '/(es|en)/:path*'],
}
```

- [ ] **Step 9: Update next.config.ts for next-intl**

```typescript
// next.config.ts
import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default withNextIntl(nextConfig)
```

- [ ] **Step 10: Create message files**

```json
// messages/es.json
{
  "landing": {
    "title": "¿Cuánto poder tiene tu cuenta?",
    "subtitle": "Ingresa tu Player Tag y descubre tu Puntuación de Poder en Gemas",
    "placeholder": "#2P0Q8C2C0",
    "cta": "Calcular Poder",
    "calculating": "Calculando...",
    "invalidTag": "Formato inválido. Ejemplo: #2P0Q8C2C0",
    "error": "Error de conexión"
  },
  "nav": {
    "overview": "Vista General",
    "brawlers": "Brawlers",
    "stats": "Estadísticas",
    "share": "Compartir"
  },
  "profile": {
    "gemEquivalent": "Gemas Equivalentes",
    "base": "Base",
    "assets": "Inventario",
    "enhance": "Mejoras",
    "elite": "Elite",
    "trophies": "Trofeos",
    "victories": "Victorias 3vs3",
    "brawlerCount": "Brawlers",
    "gadgets": "Gadgets",
    "starPowers": "Star Powers",
    "hypercharges": "Hipercargas",
    "buffies": "Buffies",
    "prestige": "Prestigio",
    "calculateAnother": "Calcular otra cuenta"
  },
  "share": {
    "title": "Mi Puntuación de Poder en Brawl Stars",
    "text": "¡Mi cuenta tiene un poder equivalente a {gems} Gemas! Tengo {prestige} Brawlers en Prestigio. ¿Puedes superarme?",
    "button": "Compartir resultado",
    "copied": "¡Copiado al portapapeles!"
  },
  "footer": {
    "disclaimer": "Este material no es oficial y no está respaldado por Supercell. Para obtener más información, consulte la {link}.",
    "policyLink": "Política de contenido de los fans de Supercell"
  }
}
```

```json
// messages/en.json
{
  "landing": {
    "title": "How powerful is your account?",
    "subtitle": "Enter your Player Tag to discover your Gem Power Score",
    "placeholder": "#2P0Q8C2C0",
    "cta": "Calculate Power",
    "calculating": "Calculating...",
    "invalidTag": "Invalid format. Example: #2P0Q8C2C0",
    "error": "Connection error"
  },
  "nav": {
    "overview": "Overview",
    "brawlers": "Brawlers",
    "stats": "Stats",
    "share": "Share"
  },
  "profile": {
    "gemEquivalent": "Gem Equivalent",
    "base": "Base",
    "assets": "Assets",
    "enhance": "Upgrades",
    "elite": "Elite",
    "trophies": "Trophies",
    "victories": "3vs3 Victories",
    "brawlerCount": "Brawlers",
    "gadgets": "Gadgets",
    "starPowers": "Star Powers",
    "hypercharges": "Hypercharges",
    "buffies": "Buffies",
    "prestige": "Prestige",
    "calculateAnother": "Calculate another account"
  },
  "share": {
    "title": "My Brawl Stars Power Score",
    "text": "My Brawl Stars account has a power equivalent to {gems} Gems! I have {prestige} Brawlers at Prestige. Can you beat me?",
    "button": "Share result",
    "copied": "Copied to clipboard!"
  },
  "footer": {
    "disclaimer": "This content is not official and is not endorsed by Supercell. For more information, see the {link}.",
    "policyLink": "Supercell Fan Content Policy"
  }
}
```

- [ ] **Step 11: Create globals.css**

Replace `src/app/globals.css`:

```css
@import "tailwindcss";

:root {
  --color-brawl-dark: #0F172A;
  --color-brawl-blue: #3B82F6;
  --color-brawl-gold: #FBBF24;
  --color-brawl-purple: #A855F7;
  --color-brawl-light: #F8FAFC;
  --sidebar-width: 240px;
  --sidebar-collapsed: 64px;
  --header-height: 56px;
}

body {
  background-color: var(--color-brawl-dark);
  color: var(--color-brawl-light);
  font-family: 'Inter', system-ui, sans-serif;
}
```

- [ ] **Step 12: Create root locale layout**

```tsx
// src/app/[locale]/layout.tsx
import { NextIntlClientProvider, useMessages } from 'next-intl'
import { getMessages } from 'next-intl/server'
import type { Metadata } from 'next'
import '../globals.css'

export const metadata: Metadata = {
  title: 'BrawlValue — Gem Power Score',
  description: 'Calculate your Brawl Stars account power in Gem Equivalent',
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className="min-h-screen">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 13: Create placeholder landing page**

```tsx
// src/app/[locale]/page.tsx
import { useTranslations } from 'next-intl'

export default function LandingPage() {
  const t = useTranslations('landing')

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-2 text-slate-400">{t('subtitle')}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 14: Create .env.example**

```env
# Supercell Brawl Stars API (server-only)
BRAWLSTARS_API_KEY=your_api_key_here

# Upstash Redis (server-only, rate limiting)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Google Analytics (public)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

- [ ] **Step 15: Delete the default src/app/layout.tsx and src/app/page.tsx**

The locale layout at `src/app/[locale]/layout.tsx` replaces the root layout. Delete the original files that `create-next-app` generated at `src/app/layout.tsx` and `src/app/page.tsx` (our locale versions replace them).

Keep only a minimal root layout if Next.js requires it:

```tsx
// src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
```

- [ ] **Step 16: Verify it builds and runs**

```bash
npm run build && npm run dev
```

Open http://localhost:3000 — should redirect to `/es` and show the landing page title in Spanish.

- [ ] **Step 17: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 with next-intl (es/en), Tailwind v4, Vitest, TanStack Query"
```

---

## Task 2: Types + Constants + Utils (TDD)

**Identical to v1 plan Tasks 2-4.** The algorithm layer has no i18n — it's pure TypeScript.

**Files:**
- Create: `src/lib/types.ts`, `src/lib/constants.ts`, `src/lib/utils.ts`, `src/test/mocks.ts`
- Test: `src/__tests__/unit/lib/utils.test.ts`

- [ ] **Step 1-3: Create types.ts, constants.ts** — Copy exactly from v1 plan Tasks 2-3 (no changes needed — these have no UI text).

- [ ] **Step 4: Write failing utils tests** — Copy from v1 plan Task 4 Step 1.

- [ ] **Step 5: Implement utils.ts** — Copy from v1 plan Task 4 Step 3.

- [ ] **Step 6: Create mock data** — Copy from v1 plan Task 5 Step 1.

- [ ] **Step 7: Run tests**

```bash
npx vitest src/__tests__/unit/lib/utils.test.ts --run
```

Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ src/test/ src/__tests__/unit/lib/utils.test.ts
git commit -m "feat: add types, constants, utils with TDD — algorithm layer"
```

---

## Task 3: Core Algorithm (TDD)

**Identical to v1 plan Task 5.** No i18n impact.

**Files:**
- Create: `src/lib/calculate.ts`
- Test: `src/__tests__/unit/lib/calculate.test.ts`

- [ ] **Step 1: Write failing tests** — Copy from v1 plan Task 5 Step 2.

- [ ] **Step 2: Implement calculate.ts** — Copy from v1 plan Task 5 Step 4.

- [ ] **Step 3: Run tests**

```bash
npx vitest src/__tests__/unit/lib/calculate.test.ts --run
```

Expected: All 9 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/calculate.ts src/__tests__/unit/lib/calculate.test.ts
git commit -m "feat: implement 4-vector Gem Score algorithm with TDD"
```

---

## Task 4: API Route (TDD)

**Identical to v1 plan Task 6.** API routes don't go through locale routing.

**Files:**
- Create: `src/app/api/calculate/route.ts`
- Test: `src/__tests__/integration/api/calculate.test.ts`

- [ ] **Step 1: Write failing tests** — Copy from v1 plan Task 6 Step 1.

- [ ] **Step 2: Implement route.ts** — Copy from v1 plan Task 6 Step 3.

- [ ] **Step 3: Run all tests**

```bash
npx vitest --run
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ src/__tests__/integration/
git commit -m "feat: add POST /api/calculate route with mock data and validation (TDD)"
```

---

## Task 5: Layout Components — Header, Sidebar, Footer

**Files:**
- Create: `src/components/layout/Header.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/common/Footer.tsx`, `src/components/common/LocaleSwitcher.tsx`

- [ ] **Step 1: Create Footer with disclaimer**

```tsx
// src/components/common/Footer.tsx
import { useTranslations } from 'next-intl'

export function Footer() {
  const t = useTranslations('footer')

  return (
    <footer className="w-full py-4 px-4 text-center text-xs text-slate-500 border-t border-white/5">
      <p className="max-w-lg mx-auto">
        {t.rich('disclaimer', {
          link: (chunks) => (
            <a
              href="https://supercell.com/en/fan-content-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-400"
            >
              {t('policyLink')}
            </a>
          ),
        })}
      </p>
    </footer>
  )
}
```

- [ ] **Step 2: Create LocaleSwitcher**

```tsx
// src/components/common/LocaleSwitcher.tsx
'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  function switchLocale(newLocale: string) {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPath)
  }

  return (
    <div className="flex gap-1 text-sm">
      <button
        onClick={() => switchLocale('es')}
        className={`px-2 py-1 rounded ${locale === 'es' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
      >
        ES
      </button>
      <button
        onClick={() => switchLocale('en')}
        className={`px-2 py-1 rounded ${locale === 'en' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
      >
        EN
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create Header**

```tsx
// src/components/layout/Header.tsx
'use client'

import { LocaleSwitcher } from '@/components/common/LocaleSwitcher'

interface HeaderProps {
  playerTag?: string
  onMenuToggle?: () => void
}

export function Header({ playerTag, onMenuToggle }: HeaderProps) {
  return (
    <header className="h-[var(--header-height)] border-b border-white/5 bg-[var(--color-brawl-dark)] flex items-center justify-between px-4 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button onClick={onMenuToggle} className="md:hidden p-2 text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <span className="font-bold text-lg">BrawlValue</span>
        {playerTag && (
          <span className="text-sm text-slate-400 hidden sm:inline">{playerTag}</span>
        )}
      </div>
      <LocaleSwitcher />
    </header>
  )
}
```

- [ ] **Step 4: Create Sidebar**

```tsx
// src/components/layout/Sidebar.tsx
'use client'

import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface SidebarProps {
  tag: string
  locale: string
  isOpen: boolean
  onClose: () => void
}

const NAV_ITEMS = [
  { key: 'overview', path: '', icon: '★' },
  { key: 'brawlers', path: '/brawlers', icon: '⚔' },
  { key: 'stats', path: '/stats', icon: '📊' },
  { key: 'share', path: '/share', icon: '📤' },
] as const

export function Sidebar({ tag, locale, isOpen, onClose }: SidebarProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const basePath = `/${locale}/profile/${encodeURIComponent(tag)}`

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed top-[var(--header-height)] left-0 h-[calc(100vh-var(--header-height))]
          w-[var(--sidebar-width)] bg-[var(--color-brawl-dark)] border-r border-white/5
          z-50 transition-transform duration-200
          md:translate-x-0 md:static
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <nav className="flex flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => {
            const href = `${basePath}${item.path}`
            const isActive = pathname === href || (item.path === '' && pathname === basePath)

            return (
              <Link
                key={item.key}
                href={href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                  ${isActive
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'}
                `}
              >
                <span className="text-base">{item.icon}</span>
                <span>{t(item.key)}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: add Header, Sidebar, Footer, LocaleSwitcher — dashboard layout components"
```

---

## Task 6: Dashboard Layout + Profile Routes

**Files:**
- Create: `src/app/[locale]/profile/[tag]/layout.tsx`, `src/app/[locale]/profile/[tag]/page.tsx`, `src/app/[locale]/profile/[tag]/brawlers/page.tsx`, `src/app/[locale]/profile/[tag]/stats/page.tsx`, `src/app/[locale]/profile/[tag]/share/page.tsx`

- [ ] **Step 1: Create dashboard layout (header + sidebar + content)**

```tsx
// src/app/[locale]/profile/[tag]/layout.tsx
'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { Footer } from '@/components/common/Footer'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const params = useParams<{ tag: string; locale: string }>()

  const tag = decodeURIComponent(params.tag)
  const locale = params.locale

  return (
    <div className="min-h-screen flex flex-col">
      <Header playerTag={tag} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex">
        <Sidebar tag={tag} locale={locale} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 md:ml-0 p-4 sm:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
      <Footer />
    </div>
  )
}
```

- [ ] **Step 2: Create Overview page (hero gem score)**

```tsx
// src/app/[locale]/profile/[tag]/page.tsx
'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import type { GemScore } from '@/lib/types'

export default function OverviewPage() {
  const params = useParams<{ tag: string }>()
  const t = useTranslations('profile')
  const tag = decodeURIComponent(params.tag)
  const [data, setData] = useState<GemScore | null>(null)

  useEffect(() => {
    fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerTag: tag }),
    })
      .then((res) => res.json())
      .then(setData)
  }, [tag])

  if (!data) return <div className="animate-pulse text-slate-500">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-slate-400">{data.playerName}</p>
      <p className="mt-2 text-6xl font-bold text-[var(--color-brawl-gold)]">
        {data.gemEquivalent.toLocaleString()}
      </p>
      <p className="text-xl text-slate-300">{t('gemEquivalent')}</p>

      <div className="mt-8 grid grid-cols-2 gap-4">
        {(['base', 'assets', 'enhance', 'elite'] as const).map((key) => (
          <div key={key} className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-slate-500">{t(key)}</p>
            <p className="text-2xl font-semibold">{data.breakdown[key].value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create Brawlers page (placeholder)**

```tsx
// src/app/[locale]/profile/[tag]/brawlers/page.tsx
import { useTranslations } from 'next-intl'

export default function BrawlersPage() {
  const t = useTranslations('nav')
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold">{t('brawlers')}</h2>
      <p className="mt-2 text-slate-400">Brawler list coming next sprint.</p>
    </div>
  )
}
```

- [ ] **Step 4: Create Stats page (placeholder)**

```tsx
// src/app/[locale]/profile/[tag]/stats/page.tsx
import { useTranslations } from 'next-intl'

export default function StatsPage() {
  const t = useTranslations('nav')
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold">{t('stats')}</h2>
      <p className="mt-2 text-slate-400">Detailed stats breakdown coming next sprint.</p>
    </div>
  )
}
```

- [ ] **Step 5: Create Share page (placeholder)**

```tsx
// src/app/[locale]/profile/[tag]/share/page.tsx
import { useTranslations } from 'next-intl'

export default function SharePage() {
  const t = useTranslations('share')
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold">{t('button')}</h2>
      <p className="mt-2 text-slate-400">Share card coming next sprint.</p>
    </div>
  )
}
```

- [ ] **Step 6: Verify build and navigation**

```bash
npm run build && npm run dev
```

1. Go to http://localhost:3000/es/profile/%232P0Q8C2C0
2. Should see Header + Sidebar + Overview with Gem Score
3. Click sidebar items — should navigate between sections
4. On mobile viewport — sidebar should be hamburger menu
5. Footer with Supercell disclaimer should be visible

- [ ] **Step 7: Commit**

```bash
git add src/app/
git commit -m "feat: add dashboard layout with sidebar + Overview, Brawlers, Stats, Share routes"
```

---

## Task 7: Landing Page with Navigation to Dashboard

**Files:**
- Modify: `src/app/[locale]/page.tsx`
- Create: `src/components/landing/InputForm.tsx`

- [ ] **Step 1: Create InputForm component**

```tsx
// src/components/landing/InputForm.tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { isValidPlayerTag } from '@/lib/utils'

interface InputFormProps {
  onSubmit: (playerTag: string) => void
  isLoading: boolean
}

export function InputForm({ onSubmit, isLoading }: InputFormProps) {
  const t = useTranslations('landing')
  const [tag, setTag] = useState('')
  const isValid = tag.length > 0 && isValidPlayerTag(tag)
  const showError = tag.length > 0 && !isValid

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isValid && !isLoading) {
      onSubmit(tag.toUpperCase())
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto flex flex-col gap-4">
      <div>
        <input
          type="text"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder={t('placeholder')}
          aria-label="Player Tag"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brawl-gold)]"
        />
        {showError && <p className="mt-1 text-sm text-red-400">{t('invalidTag')}</p>}
      </div>
      <button
        type="submit"
        disabled={!isValid || isLoading}
        className="w-full py-3 rounded-xl bg-[var(--color-brawl-gold)] text-slate-900 font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
      >
        {isLoading ? t('calculating') : t('cta')}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Update landing page to navigate to dashboard**

```tsx
// src/app/[locale]/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { InputForm } from '@/components/landing/InputForm'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/common/Footer'

export default function LandingPage() {
  const t = useTranslations('landing')
  const locale = useLocale()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  function handleSubmit(playerTag: string) {
    setIsLoading(true)
    router.push(`/${locale}/profile/${encodeURIComponent(playerTag)}`)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4">
        <main className="w-full max-w-lg flex flex-col items-center gap-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
            <p className="mt-2 text-slate-400">{t('subtitle')}</p>
          </div>
          <InputForm onSubmit={handleSubmit} isLoading={isLoading} />
        </main>
      </div>
      <Footer />
    </div>
  )
}
```

- [ ] **Step 3: Build and test full flow**

```bash
npm run build && npm run dev
```

1. Go to http://localhost:3000 → redirects to /es
2. Enter `#TEST123` → click "Calcular Poder"
3. Navigates to `/es/profile/%23TEST123`
4. Dashboard loads with Header + Sidebar + Gem Score
5. Switch language ES/EN — all text updates
6. Click sidebar items — navigate between sections

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/ src/app/
git commit -m "feat: add Landing page with InputForm that navigates to profile dashboard"
```

---

## Task 8: Run Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
npx vitest --run
```

Expected: All tests pass.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Production build**

```bash
npm run build
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "chore: fix any remaining lint/type issues"
```

---

## Summary of What MVP Delivers

1. **Landing page** — clean input with real-time validation
2. **Instant navigation** to profile dashboard (no delay)
3. **Dashboard layout** — Header + Sidebar (responsive) + Main content
4. **Overview page** — Hero Gem Score + 4-vector breakdown
5. **3 placeholder pages** — Brawlers, Stats, Share (ready for next sprint)
6. **i18n** — Full Spanish + English with one-click switcher
7. **Supercell disclaimer** — on every page
8. **TDD** — Utils, Algorithm, API Route all test-covered
9. **Scalable structure** — Adding new sections = new file in profile directory

## Post-MVP Tasks (next sprints)

| Task | Dependency |
|------|-----------|
| Fill Brawlers page with per-brawler cards | None |
| Fill Stats page with detailed breakdown + charts | Recharts or similar |
| Fill Share page with Web Share API | None |
| Real Supercell API | API key + Vercel IP whitelist |
| Upstash rate limiting | Upstash account |
| AdSense integration | Google approval |
| Motion animations (progressive reveal) | None |
| Playwright E2E tests | After UI stabilizes |
| Dynamic OG meta tags | None |
