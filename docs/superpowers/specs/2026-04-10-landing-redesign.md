# Landing Page Redesign + Analytics Trial CTA

**Date:** 2026-04-10
**Status:** Spec
**Scope:** Reestructurar la landing con las nuevas features + CTA de trial en analytics

---

## 1. Principios de Diseño (inmutables)

- **Estética de videojuego de dibujos** — brawl-card, brawl-card-dark, brawl-button, Lilita_One, sombras 3D, bordes gruesos. NUNCA diseño corporativo.
- **Imágenes > texto** — Si hay un nombre de mapa, mostrar la imagen del mapa. Si hay un nombre de brawler, mostrar su retrato. Siempre.
- **Mobile-first** — Todo funciona en 375px.
- **13 locales** — Todo texto usa `useTranslations()`, nada hardcoded.

---

## 2. Estructura Landing Actual vs Nueva

### ACTUAL (10 secciones):
1. Hero (logo + search + sign-in link)
2. StatsTicker
3. FeaturesGrid (6 cards con emojis)
4. Picks banner
5. Brawler Explorer banner
6. BrawlerParade (scroll infinito)
7. HowItWorks (3 pasos)
8. PremiumTeaser (free vs pro)
9. FinalCTA (Google sign-in)
10. Footer

### NUEVA (8 secciones — más directo, menos scroll):
1. **Hero** — Logo + search input + **banner "3 días gratis" debajo** (brawl-button dorado, no texto suelto)
2. **TrialBanner** — NUEVO: card destacado explicando FREE (básico: batallas + gem value) vs TRIAL PRO (analytics avanzados, 3 días gratis). Con imágenes de brawlers.
3. **FeaturesGrid** — Reducir a 4 cards con **imágenes de brawlers** en vez de emojis. Cada card muestra un brawler portrait relevante.
4. **Picks + Brawler Explorer** — Unificar en un bloque visual con **imágenes de mapas** de fondo. Dos cards lado a lado en desktop, apiladas en móvil.
5. **BrawlerParade** — Mantener (ya es clickable).
6. **PremiumTeaser** — Simplificar: no duplicar features free. Solo mostrar las **5 features PRO** con imágenes. CTA "Prueba 3 días gratis".
7. **FinalCTA** — Simplificar a search + Google sign-in. Sin repetir features.
8. **Footer** — Mantener.

### Secciones ELIMINADAS de la landing (archivos conservados):
- **StatsTicker** — Ruido visual sin valor. Nadie lee "X batallas analizadas".
- **HowItWorks** — Obvio por la UX. Si necesitas explicar cómo funciona, el diseño falla.

### Orden de secciones optimizado para conversión:
1. Hero → "qué es esto" (5 segundos)
2. TrialBanner → "qué gano gratis vs registrándome" (decisión)
3. FeaturesGrid → "qué hace la app en detalle" (confianza)
4. ExploreSection → "quiero probarlo ahora" (acción gratuita)
5. BrawlerParade → "wow, todos los brawlers" (visual impact)
6. PremiumTeaser → "si me gusto, cuánto cuesta" (conversión)
7. FinalCTA → "último empujón" (cierre)
8. Footer

---

## 3. Componentes a Modificar/Crear

### 3.1 Hero (MODIFICAR `page.tsx` + `HeroSignIn.tsx`)

Mantener: Logo, título, subtitle, InputForm.
Cambiar: `HeroSignIn` ya tiene el brawl-button "Prueba 3 días gratis" (hecho en sesión anterior). Pero aclarar: **"Analytics avanzados"** no "todo PRO".

Cambio en HeroSignIn:
```
Botón: "Prueba 3 días gratis"
Subtítulo: "Accede a analytics avanzados sin compromiso"
```

### 3.2 TrialBanner (NUEVO `src/components/landing/TrialBanner.tsx`)

Card dividido en dos columnas (desktop), apiladas (móvil):

**Columna FREE (izquierda):**
- Título: "Gratis con tu #tag"
- 3 puntos con iconos:
  - 🏆 Últimas 25 batallas
  - 💎 Valor de gemas de tu cuenta
  - 📊 Stats básicos
- Color: borde verde

**Columna TRIAL PRO (derecha):**
- Título: "3 días PRO gratis"
- Badge dorado "GRATIS" en la esquina
- 4 puntos con imágenes de brawlers (portraits 32x32):
  - Historial ilimitado de batallas
  - Analytics avanzados (win rate, matchups, comfort)
  - Meta PRO: qué juegan los mejores
  - Recomendaciones personalizadas
- Color: borde dorado `#FFC91B`
- CTA: brawl-button "Registrarme con Google"

### 3.3 FeaturesGrid (MODIFICAR)

Reducir de 6 a 4 cards. Cada card tiene un **brawler portrait** (40x40) como icono visual en vez de emoji:

1. 💎 Gem Calculator → mostrar portrait de brawler con más gemas
2. ⚔️ Battle Analytics → portrait de un brawler luchando
3. 🗺️ Map Performance → mini-mapa de fondo con overlay
4. 🤝 Team Synergy → 3 brawler portraits en fila

Usar brawler IDs fijos para los portraits (ej: 16000000 Shelly, 16000001 Colt, 16000003 Brock, 16000015 Crow).

### 3.4 ExploreSection (NUEVO — unifica Picks + Brawlers)

Reemplaza los dos banners separados con un bloque visual:

```
┌──────────────────────────────────────────────┐
│  EXPLORE                                      │
│  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ 📍 PICKS HOY    │  │ 🔍 BRAWLER STATS    │ │
│  │ [map bg image]  │  │ [brawler portraits] │ │
│  │ "Best picks     │  │ "Stats, counters,   │ │
│  │  por mapa"      │  │  mejores mapas"     │ │
│  │        →        │  │           →         │ │
│  └─────────────────┘  └─────────────────────┘ │
└──────────────────────────────────────────────┘
```

Cada card tiene imagen de fondo (mapa o brawler parade) con overlay oscuro + texto.

### 3.5 PremiumTeaser (MODIFICAR)

Eliminar la columna FREE (ya se explica arriba en TrialBanner). Solo mostrar PRO features con imágenes:

- Historial ilimitado de batallas → icono visual
- Analytics avanzados (7 tabs) → screenshot o iconos
- Comparador vs PROs → portrait de brawler con badge
- Draft Simulator → icono visual
- Recomendaciones "Juega ahora" → icono visual

CTA: "Prueba 3 días gratis" (abre AuthModal)

### 3.6 FinalCTA (SIMPLIFICAR)

Solo: search input + Google button. Sin texto extra. El usuario ya vio todo.

---

## 4. Analytics Trial CTA (para usuarios sin cuenta)

### Cambio en `analytics/page.tsx`

**ANTES:** Redirect ciego a `/subscribe` para no-premium.

**AHORA:** Si el usuario no está autenticado O no es premium, mostrar un **preview con blur** + CTA:

- Skeleton del dashboard de analytics (datos fake/estáticos para dar idea de lo que verían)
- Overlay con blur
- Card central:
  - "🔓 Analytics Avanzados"
  - "Regístrate con Google y vincula tu #tag para obtener 3 días de analytics PRO gratis"
  - Botón: "Prueba 3 días gratis" (abre AuthModal)
  - Link secundario: "Ya tengo cuenta → Iniciar sesión"

Esto reemplaza el redirect a `/subscribe`. El usuario ve lo que se pierde y tiene el CTA in-situ.

---

## 5. Traducciones Nuevas

Namespace `landing`:
```
trialBannerFreeTitle: "Gratis con tu #tag"
trialBannerFreeP1: "Últimas 25 batallas"
trialBannerFreeP2: "Valor de gemas de tu cuenta"
trialBannerFreeP3: "Stats básicos de rendimiento"
trialBannerProTitle: "3 días PRO gratis"
trialBannerProBadge: "GRATIS"
trialBannerProP1: "Historial ilimitado de batallas"
trialBannerProP2: "Analytics avanzados"
trialBannerProP3: "Meta PRO: qué juegan los mejores"
trialBannerProP4: "Recomendaciones personalizadas"
trialBannerCta: "Registrarme con Google"
exploreTitle: "Explora"
explorePicksTitle: "Picks de hoy"
explorePicksDesc: "Los mejores picks para cada mapa en rotación"
exploreBrawlersTitle: "Stats de Brawlers"
exploreBrawlersDesc: "Counters, mejores mapas y matchups"
```

Namespace `analytics`:
```
trialPreviewTitle: "Analytics Avanzados"
trialPreviewDesc: "Regístrate y vincula tu #tag para obtener 3 días de analytics PRO gratis"
trialPreviewCta: "Prueba 3 días gratis"
trialPreviewLogin: "Ya tengo cuenta"
```

---

## 6. Archivos a Crear/Modificar

| Archivo | Acción |
|---------|--------|
| `src/app/[locale]/page.tsx` | Restructurar secciones, quitar StatsTicker y HowItWorks |
| `src/components/landing/TrialBanner.tsx` | CREAR — free vs trial PRO |
| `src/components/landing/ExploreSection.tsx` | CREAR — picks + brawlers unificado |
| `src/components/landing/FeaturesGrid.tsx` | MODIFICAR — 4 cards con brawler portraits |
| `src/components/landing/PremiumTeaser.tsx` | MODIFICAR — solo PRO features |
| `src/components/landing/FinalCTA.tsx` | SIMPLIFICAR — solo search + Google |
| `src/components/landing/HeroSignIn.tsx` | AJUSTAR texto subtitle |
| `src/app/[locale]/profile/[tag]/analytics/page.tsx` | Reemplazar redirect con preview+blur+CTA |
| `messages/*.json` (13 locales) | Añadir nuevas keys |

NO eliminar: `StatsTicker.tsx`, `HowItWorks.tsx` — dejar como archivos muertos por si se reutilizan. Solo quitar de `page.tsx`.

---

## 7. Mobile Responsiveness

- TrialBanner: 2 columnas → 1 columna apilada
- ExploreSection: 2 cards lado a lado → apiladas
- FeaturesGrid: 4 cards → 2×2 en mobile
- Hero: mantener centrado vertical
- Analytics preview: blur + card centrado funciona igual

---

## 8. Edge Cases

- Usuario ya autenticado y premium viendo la landing → no mostrar trial CTA, mostrar "Ir a mi perfil"
- Usuario con trial expirado → mostrar "Tu trial expiró, suscríbete"
- BrawlerParade sin registry cargado → mantener fallback con IDs
- Analytics preview sin datos → skeleton estático (no datos reales)
