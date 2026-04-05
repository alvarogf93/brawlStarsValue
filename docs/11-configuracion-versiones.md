# 11. Configuración de Versiones & Dependencias (April 2026)

Versiones **exactas y validadas** para abril 2026. Basadas en investigación web actual.

---

## 📦 Versiones Principales

### Runtime & Framework

| Paquete | Versión | Razón | Fuente |
|---------|---------|-------|--------|
| **Next.js** | `16.2.x` | Latest stable (Turbopack stable, React Compiler 1.0) | [Next.js 16.2 Release](https://nextjs.org/blog/next-16) |
| **React** | `19.2.4` | Latest (Dec 2024 release, security updates) | [React Releases](https://github.com/facebook/react/releases) |
| **react-dom** | `19.2.4` | Must match React version | ^React |
| **TypeScript** | `^6.0.2` | Latest major (MS rewrite, optimizations) | [TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) |

**⚠️ IMPORTANTE**: TypeScript 6.0 es JavaScript-based (último). TypeScript 7.0 vendrá en Go, pero no está ready aún.

---

### CSS & Styling

| Paquete | Versión | Razón |
|---------|---------|-------|
| **tailwindcss** | `^4.1.0` | Latest (v4.1 en April 2026, Rust engine) |
| **postcss** | `^8.4.41` | Peer dep Tailwind |
| **autoprefixer** | `^10.4.20` | Peer dep Tailwind |

**Tailwind v4 Breaking Changes**:
- `bg-gradient-to-*` → `bg-linear-to-*`
- `@tailwind` directives no necesarias (solo `@import "tailwindcss"`)
- Container queries nativas (no plugin)

---

### UI Components & Accessibility

| Paquete | Versión | Razón |
|---------|---------|-------|
| **@radix-ui/react-slot** | `^2.1.3` | shadcn/ui primitive (copy-paste) |
| **class-variance-authority** | `^0.7.1` | Component className management |
| **clsx** | `^2.1.1` | Conditional className utility |

**Nota**: shadcn/ui NO es npm package, se copia código a `/components/ui/`

---

### State Management & Data Fetching

| Paquete | Versión | Razón |
|---------|---------|-------|
| **@tanstack/react-query** | `^5.96.2` | Latest (Suspense stable, DevTools) |

**Características v5**:
- `useSuspenseQuery` (no experimental)
- DevTools para debugging
- NextJS 16 compatible

---

### Animations

| Paquete | Versión | Razón |
|---------|---------|-------|
| **framer-motion** | `^12.3.0` | Motion.dev (rebranded Framer Motion) |

**Nota**: Rive será instalado vía CDN (no npm) por tamaño mínimo

---

### Rate Limiting & Redis

| Paquete | Versión | Razón |
|---------|---------|-------|
| **@upstash/ratelimit** | `^1.2.0` | Serverless rate limiting (HTTP-based) |
| **@upstash/redis** | `^1.35.0` | Upstash Redis client (REST API) |

---

## 🧪 Testing & Quality

### Testing Framework

| Paquete | Versión | Razón |
|---------|---------|-------|
| **vitest** | `^2.0.5` | Jest replacement (3x faster) |
| **@vitest/ui** | `^2.0.5` | Vitest visual dashboard |
| **jsdom** | `^24.1.1` | DOM environment para tests |
| **c8** | `^10.1.2` | Code coverage |

---

### React Testing

| Paquete | Versión | Razón |
|---------|---------|-------|
| **@testing-library/react** | `^16.0.1` | Component testing |
| **@testing-library/jest-dom** | `^6.6.3` | DOM matchers (required) |
| **@testing-library/user-event** | `^14.5.2` | User interaction simulation |

---

### E2E Testing

| Paquete | Versión | Razón |
|---------|---------|-------|
| **@playwright/test** | `^1.45.1` | E2E browser testing |

---

## 🔍 Linting & Code Quality

| Paquete | Versión | Razón |
|---------|---------|-------|
| **eslint** | `^8.57.1` | Code linting |
| **eslint-config-next** | `16.2.0` | Next.js ESLint config |

---

## 📋 package.json Exacto

```json
{
  "name": "brawlvalue",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "next": "16.2.0",
    "@radix-ui/react-slot": "^2.1.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "framer-motion": "^12.3.0",
    "@tanstack/react-query": "^5.96.2",
    "@upstash/ratelimit": "^1.2.0",
    "@upstash/redis": "^1.35.0"
  },
  "devDependencies": {
    "typescript": "^6.0.2",
    "@types/node": "^20.14.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^4.1.0",
    "postcss": "^8.4.41",
    "autoprefixer": "^10.4.20",
    "eslint": "^8.57.1",
    "eslint-config-next": "16.2.0",
    "vitest": "^2.0.5",
    "@vitest/ui": "^2.0.5",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/user-event": "^14.5.2",
    "@playwright/test": "^1.45.1",
    "jsdom": "^24.1.1",
    "c8": "^10.1.2"
  }
}
```

---

## 🔧 tsconfig.json (Strict Mode Completo)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    
    // *** STRICT MODE - ALL FLAGS ENABLED ***
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true,
    
    // Module Resolution
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    
    // JSX
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    
    // No Emit (Next.js compiles)
    "noEmit": true,
    
    // Paths
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".next", "dist", "build"]
}
```

---

## ⚙️ next.config.ts (Optimizado)

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // Turbopak default (auto en dev/build)
  
  // Optimizaciones
  swcMinify: true,
  
  // Experimental optimizations
  experimental: {
    optimizePackageImports: [
      '@radix-ui/*',
      '@upstash/*'
    ]
  },
  
  // Image optimization
  images: {
    remotePatterns: [
      // Supabase bucket (futuro)
      // {
      //   protocol: 'https',
      //   hostname: '**.supabase.co'
      // }
    ]
  },
  
  // Headers
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, s-maxage=60'
          }
        ]
      }
    ]
  }
}

export default nextConfig
```

---

## 🎨 tailwind.config.ts (Cyber-Brawl)

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        'brawl-dark': '#0F172A',
        'brawl-blue': '#3B82F6',
        'brawl-gold': '#FBBF24',
        'brawl-purple': '#A855F7',
        'brawl-light': '#F8FAFC'
      },
      fontFamily: {
        'display': ['Lilita One', 'Righteous', 'sans-serif'],
        'sans': ['Inter', 'Geist', 'system-ui', 'sans-serif']
      },
      backdropBlur: {
        'md': '12px'
      },
      opacity: {
        '10': '0.1'
      }
    }
  },
  plugins: []
}

export default config
```

---

## .eslintrc.json (Next.js Config)

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
  "rules": {
    "@next/next/no-img-element": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```

---

## vitest.config.ts (Testing Setup)

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

---

## 📝 .env.example (Variables Plantilla)

```env
# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google Analytics (public - sin guiones)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Supercell Brawl Stars API (secreto - servidor)
BRAWLSTARS_API_KEY=your_api_key_here
BRAWLSTARS_API_BASE_URL=https://api.brawlstars.com/v1

# Upstash Redis (secreto - rate limiting)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Sentry (secreto - error tracking)
NEXT_PUBLIC_SENTRY_DSN=https://...
SENTRY_AUTH_TOKEN=...
```

---

## 🔄 .gitignore (Completo)

```
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
.nyc_output/

# Production
.next/
out/
dist/
build/

# Misc
.DS_Store
*.pem
.env.local
.env.*.local
.env

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
Thumbs.db
```

---

## ✅ Validación de Versiones

| Componente | Version | Stable | April 2026 | Recomendado |
|-----------|---------|--------|-----------|-------------|
| Next.js | 16.2.x | ✅ | ✅ | **SÍ** |
| React | 19.2.4 | ✅ | ✅ | **SÍ** |
| TypeScript | 6.0.2 | ✅ | ✅ | **SÍ** |
| Tailwind | 4.1.x | ✅ | ✅ | **SÍ** |
| TanStack Query | 5.96.x | ✅ | ✅ | **SÍ** |
| Vitest | 2.0.5 | ✅ | ✅ | **SÍ** |

---

## 🚨 Cambios Importantes v4 → Tailwind

Si tienes code Tailwind v3, considerar:

```
v3: bg-gradient-to-right
v4: bg-linear-to-r

v3: @tailwind base; @tailwind components; @tailwind utilities;
v4: @import "tailwindcss"
```

---

## 📚 Fuentes

- [Next.js 16.2 Release Notes](https://nextjs.org/blog/next-16)
- [React 19.2 Release](https://react.dev/versions)
- [TypeScript 6.0 Announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [Tailwind CSS v4 Guide](https://tailwindcss.com/blog/tailwindcss-v4)
- [TanStack Query v5 Docs](https://tanstack.com/query/latest)
- [Vitest Documentation](https://vitest.dev)
