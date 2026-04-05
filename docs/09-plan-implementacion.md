# 9. Plan de Implementación (Roadmap Básico)

## 📅 Fases de Desarrollo

---

## 🚀 FASE 1: MVP (Semana 1-2)
**Objetivo**: Core funcional, deployable en Vercel

### Sprint 1.1: Setup & Infraestructura (Día 1-3)

- [ ] **Proyecto Next.js 16**
  - `npx create-next-app@latest`
  - TypeScript Strict mode ON
  - Tailwind v4 + ESLint
  
- [ ] **Git + GitHub**
  - Crear repo en GitHub
  - Ignorar .env.local, .vercel/
  
- [ ] **Variables de Entorno**
  - Crear `.env.example`
  - Setup Vercel secrets
  - Validar en Vercel dashboard

- [ ] **Estructura de Carpetas**
  - `/src/app`, `/src/components`, `/src/lib`
  - Seguir estructura del doc 08-arquitectura-proyecto.md

### Sprint 1.2: Landing Page (Día 3-5)

- [ ] **Componentes UI (shadcn/ui)**
  - `Button` component
  - `Input` component
  - Copy desde Visual Builder
  
- [ ] **Landing Page (`app/page.tsx`)**
  - Layout glassmorphism
  - Input Player Tag + validación Regex
  - Botón CTA (disabled logic)
  - Meta tags estáticas (SEO)
  
- [ ] **Paleta de Colores**
  - Implementar `tailwind.config.ts` con colores Cyber-Brawl
  - Tipografía (Lilita One, Righteous, Inter)

**Deliverable**: Página estática bonita, validación input en cliente

---

### Sprint 1.3: Backend API Route (Día 5-7)

- [ ] **Supercell API Client**
  - `lib/api.ts`: función `fetchPlayer(playerTag)`
  - Manejo de errores (404 player not found, 401 API key invalid, etc)
  - TypeScript types para respuesta Supercell
  
- [ ] **Algoritmo de Valoración**
  - `lib/calculate.ts`: función `calculateValue(playerData)`
  - Implementar fórmula (trofeos, exp, brawlers, victorias)
  - Tests unitarios simples
  
- [ ] **Rate Limiting (Upstash)**
  - `lib/ratelimit.ts`: setup @upstash/ratelimit
  - 5 req/min por IP
  - Middleware para proteger `/api/calculate`
  
- [ ] **API Route Handler**
  - `app/api/calculate/route.ts`: POST
  - Validación input (Player Tag format)
  - Rate limit check
  - Llamar Supercell → Calcular → Response JSON
  - Error handling (429, 400, 404, 500)

**Deliverable**: Endpoint funcional, testeable, protegido

---

### Sprint 1.4: Results Page (Día 7-10)

- [ ] **Componentes Results**
  - `ResultCard.tsx`: mostrar "$XXX.XX"
  - `Breakdown.tsx`: desglose visual
  - Animaciones Motion (fade in, scale)
  
- [ ] **State Management**
  - TanStack Query setup
  - `useCalculateValue()` hook
  - Caché automático
  
- [ ] **Loading State**
  - `setTimeout(4500)` artificial delay
  - Mensajes rotativos cada 1s
  - Loading spinner con Rive (o CSS)
  - AdSense placeholder (reservar espacio, no cargar aún)

**Deliverable**: Flujo Landing → Loading → Results completamente funcional

---

### Sprint 1.5: Sharing & Pulido (Día 10-14)

- [ ] **Web Share API**
  - `ShareButton.tsx`
  - Detectar HTTPS + browser support
  - Fallback: clipboard copy
  - Mensaje predefinido
  
- [ ] **Google Analytics 4**
  - @next/third-parties/google setup
  - Track event "calculate_value" con amount
  - (Sin CMP aún, solo tracking básico)
  
- [ ] **Sentry Setup**
  - @sentry/nextjs initialization
  - Catch errors automáticamente
  
- [ ] **Core Web Vitals Optimization**
  - Image optimization (next/image)
  - Lazy loading
  - CSS optimization (Tailwind purging)
  - Run Lighthouse

- [ ] **Deploy a Vercel**
  - Conectar GitHub repo
  - Environment variables
  - Auto-preview URLs en PRs
  - Deploy a production

**Deliverable**: MVP completo, deployado, funcional

---

## 📊 FASE 2: Compliance & Monetización (Semana 2-3)
**Objetivo**: Legal + AdSense approval

### Sprint 2.1: CMP & Privacy (Día 15-17)

- [ ] **Consent Management Platform**
  - Integrar OneTrust CMP o similar
  - Popup de consentimiento
  - TCF v2.3 compliance (obligatorio March 2026)
  - Bloquear GA4/AdSense hasta consentimiento
  
- [ ] **Privacy Policy & Terms**
  - Redactar privacy policy
  - Agregar a footer
  - GDPR/CCPA compliance

- [ ] **Disclaimer**
  - Nota legal: "Este es un valor ficticio de entretenimiento"
  - Ubicación: modal o footer

**Deliverable**: Compliance legal certificado

---

### Sprint 2.2: Google AdSense Integration (Día 17-21)

- [ ] **AdSense Approval**
  - Solicitar approval en Google AdSense
  - Add sitio a AdSense account
  - Esperar aprobación (usualmente 3-7 días)
  
- [ ] **Auto Ads Implementation**
  - Script AdSense en `app/layout.tsx`
  - Google coloca automáticamente
  - Monitoreo de Layout Shift
  
- [ ] **Custom Ad Placements**
  - Banner fijo durante loading (250px min-height)
  - Anuncio en resultados (opcional)
  - Responsive design

**Deliverable**: Ads funcionando, ingresos activos

---

## 🔄 FASE 3: SEO & Tracking (Semana 3-4)
**Objetivo**: Posicionamiento en Google

### Sprint 3.1: Dynamic SEO (Día 22-25)

- [ ] **Meta Tags Dinámicos**
  - `generateMetadata()` por Player Tag
  - OG image dinámica (simple, color by valor)
  - Structured data (Schema.org SoftwareApplication)
  
- [ ] **Sitemap & Robots**
  - `public/sitemap.xml` (estático + dinámico después)
  - `public/robots.txt`
  - Google Search Console setup
  
- [ ] **Content Hub (3 artículos)**
  - "Guía: Cómo calcular valor de tu cuenta Brawl Stars"
  - "Top 10 cuentas más valiosas"
  - "¿Cuánto vale realmente tu Brawler legendario?"
  - (Linkear a calculadora)

**Deliverable**: Ranking inicial en Google

---

### Sprint 3.2: Analytics & Monitoring (Día 25-28)

- [ ] **GA4 Dashboard Setup**
  - Eventos custom (calculate_value, share_success, etc)
  - Audiencias (new vs returning)
  - Tracking de conversions (share = micro-conversion)
  
- [ ] **Sentry Alerting**
  - Alerts en Slack/email para errores críticos
  - Performance monitoring
  
- [ ] **Vercel Analytics**
  - Enable Web Analytics
  - Core Web Vitals tracking

**Deliverable**: Dashboard operacional, alertas activas

---

## 🎁 FASE 4: Optimizaciones & Launch (Semana 4-5)
**Objetivo**: Máximo performance y viralidad

### Sprint 4.1: Performance Tuning (Día 29-32)

- [ ] **Lighthouse 95+**
  - Optimizar imágenes
  - Minify CSS/JS
  - Server-side rendering optimization
  
- [ ] **Core Web Vitals Perfection**
  - LCP < 2.5s
  - CLS = 0 (ad space reservation!)
  - FID < 100ms
  
- [ ] **Bundle Size**
  - Check Next.js build output
  - Lazy load Rive si es necesario
  - Code splitting automático

**Deliverable**: Production-grade performance

---

### Sprint 4.2: Viral Mechanics & Polish (Día 32-35)

- [ ] **Share Flow Polish**
  - OG preview optimization
  - Custom message A/B test
  - Mobile share flow smooth
  
- [ ] **Loading Experience**
  - Mensajes más entretenidos
  - Rive micro-interacciones perfeccionadas
  - Tiempo artificial optimizado
  
- [ ] **Error Handling**
  - Rate limit (429) → mensajes amigables
  - Network errors → retry logic
  - Invalid player → sugerencias
  
- [ ] **Mobile Optimization**
  - Responsive design perfeccionado
  - Touch targets 48px+
  - Viewport optimization

**Deliverable**: UX Premium, lista para viral

---

### Sprint 4.3: Launch & Promotion (Día 35-42)

- [ ] **Testing Final**
  - QA checklist completo
  - Testing en múltiples devices
  - A/B testing (delay time, messages)
  
- [ ] **Go-Live Checklist**
  - Dominio apuntando a Vercel ✅
  - HTTPS ✅
  - Analytics funcionando ✅
  - AdSense live ✅
  - Sentry monitoring ✅
  
- [ ] **Promoción Inicial**
  - Contactar YouTubers Brawl Stars (5-10)
  - Tweet inicial en Twitter/X
  - Post en r/brawlstars
  - Discord communities

**Deliverable**: Producto vivo, en manos de usuarios

---

## 🔮 FASE 5: Post-MVP Expansions (Semana 6+)
**Objetivo**: Viralidad y diferenciación

### v1.1: Database + Leaderboard (Semana 6-7)

- [ ] **Supabase Setup**
  - PostgreSQL database
  - Table: `player_valuations`
  
- [ ] **Leaderboard Page**
  - Top 100 cuentas más valiosas
  - Refresca cada hora
  - Linkeable (share ranking posición)
  
- [ ] **User History** (sin auth aún)
  - Guardar últimas búsquedas en localStorage
  - "Tus últimas valoraciones"

---

### v1.2: Authentication & Comparisons (Semana 8-9)

- [ ] **Discord/Google Login**
  - NextAuth.js setup
  - User profiles básicos
  
- [ ] **Compare Friends**
  - Mi valor vs. amigos
  - Share comparison
  - Genera competencia sana

---

### v1.3: Advanced Features (Semana 10+)

- [ ] **Trending Accounts**
  - Mostrar qué cuentas son trending
  - Notification si alguien batea tu record
  
- [ ] **Predicciones**
  - Estimar valor en 1 mes (basado en trofeos)
  - Proyecciones
  
- [ ] **Mobile App** (React Native)
  - iOS + Android native
  - Push notifications

---

## 📊 Estimaciones por Sprint

| Sprint | Tarea | Horas | Días |
|--------|-------|-------|------|
| 1.1 | Setup | 8 | 1 |
| 1.2 | Landing | 16 | 2-3 |
| 1.3 | Backend API | 20 | 2-3 |
| 1.4 | Results UI | 16 | 2 |
| 1.5 | Polish | 12 | 2 |
| **MVP Total** | | **72 horas** | **10-14 días** |
| 2.1 | CMP | 8 | 1 |
| 2.2 | AdSense | 4 | 0.5 |
| 3.1 | SEO | 12 | 2 |
| 3.2 | Analytics | 8 | 1 |
| 4.1 | Performance | 12 | 1-2 |
| 4.2 | Viral Polish | 16 | 2 |
| 4.3 | Launch | 8 | 1 |

**Total Fase 1-4**: ~170 horas (~5 semanas working 8h/day)

---

## 🎯 Checklist Pre-Launch

### Infraestructura
- [ ] GitHub repo creado
- [ ] Vercel proyecto linked
- [ ] Environment variables configuradas
- [ ] API Key Supercell whitelisted

### Código
- [ ] TypeScript strict mode todo el codebase
- [ ] Tests unitarios para calculate.ts, api.ts
- [ ] Linting pass (ESLint)
- [ ] Build sin warnings

### Performance
- [ ] Lighthouse 95+
- [ ] Core Web Vitals green
- [ ] Mobile responsivo (320px-1200px)

### SEO
- [ ] Meta tags dinámicos funcionan
- [ ] robots.txt presente
- [ ] sitemap.xml presente
- [ ] Google Search Console verificado

### Monitoreo
- [ ] GA4 tracking funcionando
- [ ] Sentry alerting setup
- [ ] Vercel Analytics enabled
- [ ] AdSense ads displaying

### Legal
- [ ] CMP popup funcionando
- [ ] Privacy policy en site
- [ ] Disclaimer de "valor ficticio"
- [ ] GDPR/CCPA compliant

### QA Final
- [ ] Landing → validación input
- [ ] Input válido → POST a API
- [ ] Loading 4-5 segundos con mensajes
- [ ] Resultados mostrados correctamente
- [ ] Share funciona en mobile + desktop
- [ ] Error handling (404, 429, etc)
- [ ] Ads mostrando sin layout shift

---

## 🚨 Riesgos Identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| API Key Supercell rate limit | Media | Alto | Rate limiting propio + caché |
| AdSense approval lenta | Baja | Bajo | Solicitar temprano en Fase 2 |
| Core Web Vitals CLS > 0 | Media | Alto | Reservar espacios para ads |
| Supercell API changes | Baja | Alto | API wrapper versioned |
| Low organic traffic | Media | Medio | SEO + content marketing |

---

## 📚 Documentos de Soporte

Una vez aprobado este plan:
1. Crear `docs/superpowers/specs/YYYY-MM-DD-implementation-spec.md` detallado
2. Invocar `superpowers:writing-plans` para plan step-by-step
3. Comenzar Fase 1.1
