# 8. Arquitectura del Proyecto

## 📁 Estructura de Carpetas (Propuesta)

```
brawlValue/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Tests + linting
│       └── deploy.yml          # Deploy a Vercel (auto con git)
│
├── .vercel/                    # Config Vercel (auto-generado)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout + metadata
│   │   ├── page.tsx            # Landing page (/)
│   │   ├── globals.css         # Tailwind + custom CSS
│   │   ├── api/
│   │   │   └── calculate/
│   │   │       └── route.ts    # POST /api/calculate
│   │   └── results/
│   │       └── page.tsx        # Ruta de resultados (futuro)
│   │
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   └── ...
│   │   ├── landing/
│   │   │   ├── InputForm.tsx   # Input Player Tag
│   │   │   └── CTA.tsx         # Call-to-action button
│   │   ├── results/
│   │   │   ├── ResultCard.tsx
│   │   │   ├── Breakdown.tsx
│   │   │   └── ShareButton.tsx
│   │   └── common/
│   │       ├── Header.tsx
│   │       ├── Footer.tsx
│   │       └── Loading.tsx
│   │
│   ├── lib/
│   │   ├── api.ts              # Supercell API client
│   │   ├── calculate.ts        # Algoritmo de valoración
│   │   ├── ratelimit.ts        # Upstash rate limiting
│   │   ├── types.ts            # TypeScript types
│   │   └── constants.ts        # Constantes globales
│   │
│   └── hooks/
│       ├── useCalculateValue.ts
│       ├── useShare.ts
│       └── useAnalytics.ts
│
├── public/
│   ├── og-image.png            # OG image estática
│   ├── favicon.ico
│   └── robots.txt              # Para SEO
│
├── docs/
│   ├── README.md
│   ├── 01-vision-general.md
│   ├── 02-stack-tecnologico.md
│   ├── 03-especificaciones-funcionales.md
│   ├── 04-diseño-ux.md
│   ├── 05-algoritmo-valoracion.md
│   ├── 06-preguntas-pendientes.md
│   ├── 07-research-stack-tecnologico.md
│   ├── 08-arquitectura-proyecto.md
│   └── 09-plan-implementacion.md
│
├── .env.local                  # ⚠️ NO COMMIT
├── .env.example                # Template (COMMIT)
├── .gitignore
├── package.json
├── tsconfig.json               # Strict mode ✅
├── next.config.ts
├── tailwind.config.ts
└── README.md
```

---

## 🔌 Flujo de Datos

```
User (Frontend)
     ↓
[Landing Page]
  - Input Player Tag (#2P0Q...)
  - Validación Regex
  - Botón CTA (disabled si inválido)
     ↓
[Click CTA] → POST /api/calculate
     ↓
[Loading State]
  - setTimeout 4-5 segundos
  - Mensajes rotativos
  - Cargar anuncios (AdSense)
     ↓
[Backend Route Handler]
  ├─ Rate limit check (Upstash)
  ├─ Validar Player Tag
  ├─ Fetch Supercell API
  ├─ Calcular valor (algoritmo)
  ├─ Cache result (TanStack Query + Upstash)
  └─ Return JSON
     ↓
[Results Page]
  - Mostrar valor: "$XXX.XX"
  - Desglose: trofeos, brawlers, etc
  - Botón "Compartir" (Web Share API)
     ↓
[Share Flow]
  - Copiar enlace con resultado
  - Abrir native share (mobile)
  - Fallback: clipboard (desktop)
     ↓
[Analytics]
  - GA4: track "valor_calculado"
  - Sentry: monitor errores
```

---

## 🔐 Seguridad

### API Key de Supercell
- ✅ Guardada en variable de entorno (Vercel secrets)
- ✅ Solo usada en servidor (api/calculate/route.ts)
- ✅ Nunca expuesta al cliente
- ✅ IP whitelisting en Supercell dashboard

### Rate Limiting
- ✅ 5 req/minuto por IP (Upstash Redis)
- ✅ 429 response si se excede
- ✅ Anti-bot nativo

### CORS
- ✅ Next.js maneja automáticamente
- ✅ Solo requests desde mismo origin

### Input Validation
- ✅ Regex en frontend (UX)
- ✅ Validación en backend (seguridad)
- ✅ TypeScript types (type safety)

---

## 🔄 CI/CD Pipeline

### Git → Vercel (Automatic)

```yaml
1. Commit a main → Vercel detecta
2. npm install (Next.js + deps)
3. npm run build (Turbopack)
4. npm run lint (TypeScript + ESLint)
5. Deploy a preview URL
6. Merge a main → Deploy a production
```

### GitHub Actions (Opcional pero recomendado)

```yaml
on: [push, pull_request]

jobs:
  test:
    - npm run test (Vitest)
    - npm run lint
    - npm run build
```

---

## 📊 Monitoreo

### Google Analytics 4
- Inicialización automática (@next/third-parties)
- Track: "calculate_value" event
- CMP popup antes de tracking (obligatorio 2026)

### Sentry
- Catch errores en frontend y backend
- Performance monitoring automático
- Session replay para debugging

### Upstash Redis
- Monitor rate limit hits
- Dashboard de uso

---

## 🎯 Caché Strategy

### Backend (Upstash Redis)
```
Key: "player:{playerTag}:{hash}"
Value: { value, breakdown, timestamp }
TTL: 1 hour
```

### Frontend (TanStack Query)
```
queryKey: ["calculate", playerTag]
staleTime: 5 minutes
gcTime: 10 minutes
```

---

## 🌍 SEO Architecture

### Dynamic Meta Tags
```typescript
// pages/page.tsx
export async function generateMetadata({ searchParams }) {
  const playerTag = searchParams.tag
  const data = await fetchPlayerValue(playerTag)
  
  return {
    title: `¿Cuánto vale mi cuenta Brawl Stars? $${data.value}`,
    description: `Mi cuenta vale $${data.value}...`,
    openGraph: {
      image: `/og/${playerTag}.png` // Dynamic OG image
    }
  }
}
```

### Sitemap
```xml
<!-- public/sitemap.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url>
    <loc>https://brawlvalue.com/</loc>
    <changefreq>daily</changefreq>
  </url>
  <!-- Dinámicas por Player Tags populares -->
</urlset>
```

### robots.txt
```
User-agent: *
Allow: /
Disallow: /api/
```

---

## 🧪 Testing Strategy

### Unit Tests (Vitest)
- `lib/calculate.ts` → test algoritmo
- `lib/api.ts` → mock Supercell API
- Componentes React → RTL

### E2E Tests (Playwright)
- Landing → Input → Loading → Results → Share
- Validación de input (inválido)
- Error handling

### Performance
- Lighthouse CI en cada PR
- Core Web Vitals monitoring (Sentry)

---

## 📦 Build & Deploy

### Local Development
```bash
npm run dev          # http://localhost:3000
npm run build        # Turbopack
npm run start        # Production build
npm run test         # Vitest
npm run lint         # ESLint
```

### Vercel Production
```
main branch push → auto-deploy a production
preview URLs automáticas en cada PR
Environment variables en Vercel dashboard
Logs automáticos en Vercel dashboard
```

---

## 🔧 Environment Variables

### `.env.local` (desarrollo)
```env
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX       # GA4 (público)
BRAWLSTARS_API_KEY=...              # Supercell (secreto)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
SENTRY_AUTH_TOKEN=...               # Solo para build
```

### Vercel Secrets
- BRAWLSTARS_API_KEY
- UPSTASH_REDIS_REST_TOKEN
- SENTRY_AUTH_TOKEN

---

## 🎛️ Configuración de Componentes

### Tailwind Config
```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        'brawl-dark': '#0F172A',
        'brawl-blue': '#3B82F6',
        'brawl-gold': '#FBBF24',
        'brawl-purple': '#A855F7',
      },
      fontFamily: {
        'display': ['Lilita One', 'Righteous'],
        'sans': ['Inter', 'Geist'],
      }
    }
  }
}
```

### Next.js Config
```typescript
// next.config.ts
const nextConfig = {
  swcMinify: true,
  experimental: {
    optimizePackageImports: ['@radix-ui/*'],
  }
}
```

---

## 🚦 Requisitos Previos para Deploy

- [ ] API Key Supercell (whitelisted IPs)
- [ ] Upstash Redis cuenta + tokens
- [ ] Google AdSense approval
- [ ] CMP (OneTrust o similar) configurada
- [ ] Dominio DNS apuntando a Vercel
- [ ] GitHub repo conectado
- [ ] Vercel proyecto creado
- [ ] Environment variables configuradas

---

## 📈 Métricas de Éxito

### Performance
- LCP: < 2.5s
- FID: < 100ms
- CLS: 0
- Lighthouse Score: 95+

### Business
- Bounce rate: < 30%
- Share rate: > 40%
- Time on page: > 30s
- Retention (7 days): > 15%

### SEO
- Ranking en "Brawl value calculator": Top 10
- Monthly organic traffic: 10k+ (Mes 3)
