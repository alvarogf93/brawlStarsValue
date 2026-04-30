# Session Prompt — AdSense compliance + brawler-page monetization

> **Para la próxima sesión de Claude.** Este documento es self-contained.
> Léelo completo, aplica los pasos en orden, y verifica con los quality
> gates al final de cada fase.

---

## 1. Misión

Resolver la sanción de Google AdSense del **2026-04-30** y, **al mismo
tiempo**, maximizar la monetización de las páginas públicas de brawlers
sin volver a infringir las políticas. Las dos cosas no son contradictorias
si el orden es correcto:

> **Más contenido editorial → más slots de ads compliant → más ingresos.**
>
> NO al revés.

El usuario quiere **explícitamente**:
1. Cumplir las normas de Google (paramos la sanción).
2. Monetizar **todas las páginas públicas de brawlers** que se puedan
   monetizar de forma compliant.

---

## 2. Lectura obligatoria antes de tocar código

| # | Fichero | Por qué |
|---|---|---|
| 1 | `docs/audits/2026-04-30-adsense/README.md` | El audit completo. Contiene los 11 hallazgos AD-01..AD-11, el diagnóstico de cada `<SafeAdSlot>` callsite, y el plan Tier 1/2/3. **Esto es el contrato base.** |
| 2 | `CLAUDE.md` sección "Ads van por SafeAdSlot" | La decisión-record actual. Hay que actualizarla al final. |
| 3 | `src/components/ui/SafeAdSlot.tsx` | El gate técnico. NO modificar — el contrato `hasContent` es bueno. |
| 4 | `src/components/ui/AdPlaceholder.tsx` | Cómo se renderizan los slots. Solo leer. |
| 5 | `src/lib/brawler-metadata.ts` | Helper que ya genera descripciones por brawler con datos PRO. Punto de extensión central. |
| 6 | `src/app/[locale]/brawler/page.tsx` y `[brawlerId]/page.tsx` | Las dos páginas brawler públicas — donde más impacto tiene la fase 2. |

---

## 3. Estado actual del repo

- Branch: `main` en commit `9b911ed` (después de `docs(adsense)`).
- Tests: **945 vitest passing**, tsc 0 errores.
- Última versión deployada: revisar Vercel antes de empezar.
- Sanción AdSense: **activa**. No solicitar revisión hasta que Fase 1
  + Fase 2 estén en main y desplegadas. Una rejection hace más difícil
  la siguiente.

Estado por superficie:

| Superficie | Ads hoy | Acción |
|---|---|---|
| `/profile/[tag]/cosmetics` | 1 slot **prohibido** (calculadora) | **Quitar inmediatamente** |
| `/profile/[tag]/share` | 1 slot **arriesgado** (acción única) | Quitar |
| `/profile/[tag]/stats` | **3 slots** (ad density alta) | Reducir a 1 |
| `/brawler` (roster grid) | 1 slot, navegación pura | Reescribir + monetizar mejor |
| `/brawler/[id]` (detalle) | 1 slot, contenido fino | **Ampliar contenido + 2 slots** |
| `/picks` | 1 slot, tabla sin comentario | Añadir análisis editorial |
| `/leaderboard` | 1 slot, lista sin contexto | Añadir contexto editorial |
| `/battle-history` | 1 slot, página promocional | Convertir en artículo |

---

## 4. Investigación previa ya hecha (no repetir)

Documentación oficial Google fetched verbatim 2026-04-30 (referencias en
`README.md` apéndice). Conclusiones consolidadas:

- **No hay word-count oficial**, pero industria 2026 consensus:
  - **≥ 500 palabras ANTES del primer ad** ← *crítico*
  - 1500-2000 palabras = óptimo para artículos profundos
  - Originalidad ≥ 30% (lo que aporta análisis propio)
- **Densidad máxima compliant:**
  - Desktop: 3 ads/página visible simultáneamente
  - Mobile: 1 above-fold + 1-2 in-content
  - **Nunca** `>50% de píxeles visibles = ads`
- **Posiciones óptimas (Google Offerwall 2026):**
  - Above-the-fold (después del intro editorial)
  - Mid-article (entre secciones largas)
  - End-of-article (footer del cuerpo, antes de comentarios/footer del site)
- **EXPLÍCITAMENTE FORBIDDEN sin excepciones:**
  - Calculadoras / formularios de edición
  - Pantallas de acción única (share, download, login, thank-you)
  - Pantallas de error / loading / skeleton / empty state
  - Pantallas de navegación pura sin comentario propio
- **AI no está prohibida.** Solo "low quality regardless of producer".
- **E-E-A-T** es el framework de los reviewers humanos:
  Experience-Expertise-Authoritativeness-Trustworthiness.

---

## 5. Plan de ejecución por fases

> Ejecuta las fases EN ORDEN. No saltar. No mezclar fase 2 con fase 1.

### FASE 1 — Compliance crítica (≈ 6 h total)

**Objetivo:** quitar todas las infracciones obvias. Después de esta fase
el sitio ya cumple lo mínimo, pero todavía no hemos solicitado revisión
porque el contenido sigue siendo fino.

#### 1.1 — Quitar ads de pantallas forbidden (30 min)

Ficheros a editar:

- `src/app/[locale]/profile/[tag]/cosmetics/page.tsx` — eliminar el
  `<SafeAdSlot hasContent={data.totalGems !== undefined} />` y su
  import. Las calculadoras NO pueden tener ads.
- `src/app/[locale]/profile/[tag]/share/page.tsx` — eliminar el
  `<SafeAdSlot hasContent={!!data.player} />` y su import. Las pantallas
  de acción única tampoco.

Test gate:

- Añadir test E2E o unit que verifique que NINGUNO de los dos ficheros
  importa `SafeAdSlot`. Patrón:
  ```ts
  it('cosmetics page never imports an ad slot (FORBIDDEN by AdSense policy)', () => {
    const source = fs.readFileSync('src/app/[locale]/profile/[tag]/cosmetics/page.tsx', 'utf-8')
    expect(source).not.toMatch(/SafeAdSlot|AdPlaceholder/)
  })
  ```
  Lo mismo para share.

#### 1.2 — Reducir ad density en stats (15 min)

Fichero: `src/app/[locale]/profile/[tag]/stats/page.tsx`. Tiene 3 slots
en líneas 75, 259, 353. **Mantener solo el del medio (~259)**, borrar
los otros dos. Ese slot debe estar entre dos bloques densos de
contenido (verificar visualmente).

#### 1.3 — Crear página `/methodology` (3-4 h)

Nueva ruta: `src/app/[locale]/methodology/page.tsx`. **Mínimo 1500
palabras en español**, traducidas a los 13 locales vía un script
`scripts/add-methodology-translations.js`.

Contenido obligatorio (E-E-A-T):

1. **Experience** — quién mantiene el sitio (autor, contacto).
2. **Expertise** — metodología de cada cálculo:
   - Bayesian Win Rate (con fórmula y ejemplo numérico)
   - Comfort Score y sus pesos (60/30/10 — ya documentado en
     `compute.ts`, traer aquí)
   - Tilt analysis y umbrales
   - Cómo se construye la lista PRO (`/api/cron/meta-poll`,
     ranking Supercell + sampling probabilístico)
   - Ventana de 14 días, source filter `global`, etc.
3. **Authoritativeness** — fuentes:
   - Supercell official API (`developer.brawlstars.com`)
   - Brawlify CDN para imágenes
   - Cron pg_cron para precomputaciones
4. **Trustworthiness** — links a privacy / terms / contact.

Footer site-wide debe linkar `/methodology` y `/about`. **Esto es
crítico: Google y los reviewers humanos buscan estas páginas como
señal de que es un sitio serio.**

#### 1.4 — Auditoría de errores/loading sin ads (1 h)

Para cada `<SafeAdSlot>` que sobreviva tras 1.1 y 1.2, verificar a
mano que `hasContent` cubre los siguientes estados:

- `isLoading === true` → `false`
- `error !== null` → `false`
- `data === null` → `false`
- Empty state (data.battles.length === 0, etc.) → `false`

Es probable que la mayoría ya lo haga. Documentar excepciones.

#### 1.5 — `CLAUDE.md` decision-record actualizada

Reemplazar la sección actual de ads (ver `README.md` apéndice
"Decisión-record que hay que actualizar"). Esto es importante para
que en sesiones futuras Claude no vuelva a romper la regla.

#### Quality gate Fase 1

```bash
# Tests
npx tsc --noEmit
npx vitest run

# Verificación manual
npm run dev
# Abrir cada página con ads y confirmar visualmente:
#   - Ningún ad en cosmetics, share, error, loading
#   - Stats con 1 solo ad
#   - Page /methodology accesible y con > 1500 palabras
#   - Footer site-wide linkea /methodology
```

NO seguir a Fase 2 hasta que el quality gate pase 100%.

---

### FASE 2 — Monetización compliant de páginas brawler (≈ 12-15 h)

> **Esta es la fase que el usuario pidió específicamente** ("intentar
> monetizar todas las páginas de los brawlers que sean publicas").
> Estrategia: profundizar el contenido editorial de las páginas brawler
> hasta que admitan **2-3 slots compliant** cada una, en lugar de los
> 0-1 slots ariesgados de hoy.

#### 2.1 — Reformar `/[locale]/brawler/[brawlerId]` como artículo profundo (6-8 h)

Página actual: ~300-400 palabras (datos del meta + intro corta + CTA).
**Objetivo: 1500-2000 palabras, dos slots compliant, schema.org Article.**

Estructura nueva (orden vertical):

```
┌─────────────────────────────────────────────────────────┐
│ <h1> {BRAWLER NAME}                                     │
│ <p> {dynamic 80-150 word lead — buildBrawlerMeta...    │
│      ampliada con contexto histórico, class, etc.}      │
│ ✦ Hero portrait + rarity badge + stats summary cards    │
│ <p> [continuación lead, 50 palabras más]                │
├─────────────────────────────────────────────────────────┤
│ ╔═ AD SLOT 1 (above-the-fold, in-content) ═╗            │
│ ║ Solo render si knownRarity && stats.total>=10 ║       │
│ ╚════════════════════════════════════════════╝          │
├─────────────────────────────────────────────────────────┤
│ <h2> Mejor mapa: {MAP} ({MODE})                         │
│ <p> 150-200 palabras — por qué ese mapa, qué             │
│     características lo hacen óptimo, comparación con    │
│     2-3 mapas peores. Usa datos reales del brawler.    │
│ ✦ MetaIntelligence component (ya existe)                │
├─────────────────────────────────────────────────────────┤
│ <h2> Counters de {BRAWLER}                              │
│ <p> 120-180 palabras — qué brawlers le ganan y por qué │
│     (range, mobility, damage type). Usa datos PRO.     │
│ ✦ Lista de top counters con WR                          │
├─────────────────────────────────────────────────────────┤
│ ╔═ AD SLOT 2 (mid-content) ═╗                           │
│ ║ Solo render si counters.length >= 3 ║                 │
│ ╚═══════════════════════════════════════╝               │
├─────────────────────────────────────────────────────────┤
│ <h2> Star Powers, Gadgets y Hypercharge                 │
│ <p> 200-250 palabras — análisis de cada SP/Gadget,     │
│     cuál es meta-pick, por qué.                         │
│ ✦ Iconos + nombres con descripción breve                │
├─────────────────────────────────────────────────────────┤
│ <h2> Cómo calculamos estos datos                        │
│ <p> 150 palabras — ventana 14d, fuente PRO,            │
│     enlace a /methodology.                              │
├─────────────────────────────────────────────────────────┤
│ <h2> Análisis del meta semanal                          │
│ <p> 200-300 palabras AUTO-GENERADO de los datos:       │
│     "WR de {BRAWLER} subió/bajó X% esta semana,         │
│      ahora es la pick #{N} en {MODE}, etc."             │
│      Esto es contenido único e impossible de copiar.    │
├─────────────────────────────────────────────────────────┤
│ ╔═ AD SLOT 3 (footer, opcional) ═╗                      │
│ ║ Solo si total content > 1500 palabras ║               │
│ ╚════════════════════════════════════════╝             │
├─────────────────────────────────────────────────────────┤
│ <h2> CTA: linkea tu cuenta                              │
│ <button>...                                             │
└─────────────────────────────────────────────────────────┘
```

Implementación técnica:

- Crear `src/lib/brawler-detail/article.ts` con `buildBrawlerArticle(
  brawlerId, name, locale, meta, brawlifyMetadata)` que devuelve un
  objeto con secciones `{ leadParagraph, mapsAnalysis, countersAnalysis,
  upgradesAnalysis, weeklyTrend }`. Cada sección produce el texto
  dinámico basado en datos reales — eso garantiza originalidad.
- El template del page consume el objeto y renderiza secciones
  condicionalmente según data disponible.
- Schema.org `Article` JSON-LD con `dateModified` y `author`.

Internacionalización:

- El TEMPLATE de cada sección está en messages/<locale>.json
- Los DATOS (nombres de brawlers, números) van interpolados con
  `{param}` placeholders.
- Esto significa que el contenido FUNCIONAL es por brawler × locale =
  104 × 13 = 1352 variaciones únicas. Eso es contenido único masivo
  para Google.

#### 2.2 — Reformar `/[locale]/brawler` (roster grid) (3-4 h)

Página actual: solo grid de portraits + nombres → puro navigation.

Nueva estructura:

```
<h1> Roster completo Brawl Stars 2026
<p> Lead 200 palabras: contexto general del meta semanal,
    cuántos brawlers hay (DINÁMICO desde registry), cómo se
    distribuyen por rareza.

<section>
  <h2> Distribución por rareza
  Tabla auto-generada: rareza | count | % | top-5 brawlers
                                          de esa rareza por WR.
</section>

╔═ AD SLOT 1 (después de 600+ palabras de cuerpo) ═╗

<section>
  <h2> Tendencias del meta — esta semana
  3-5 observaciones AUTO-GENERADAS:
    "DAMIAN sube X% — el #N de Mythic ahora"
    "Tank class lidera WR este {DÍA-DEL-MES}"
    Etc. Originalidad pura.
</section>

<section>
  <h2> Roster (104)
  Grid actual aquí.
</section>
```

Quitar el slot actual (gating fino con `brawlerIds.length > 0` no
basta). Reemplazar por slot que solo render si `wordCountAbove >= 600`.

#### 2.3 — `/[locale]/picks` (3 h)

Añadir bloque editorial above-the-fold:

- 200 palabras intro: explicación de la rotación + metodología
- 3-5 observaciones del meta semanal auto-generadas

El slot actual queda DESPUÉS del bloque editorial.

#### 2.4 — Sub-páginas opcionales `/brawler/[id]/maps` y `/brawler/[id]/counters`

**Decisión de producto** (no mecánica): si quieres EXPANDIR la inventory
de páginas monetizables, generar:

- `/brawler/[id]/maps` — análisis profundo de los 5 mejores mapas para
  ese brawler. 800+ palabras.
- `/brawler/[id]/counters` — análisis de counters detallado. 800+ palabras.

Cada una abre 1-2 slots compliant adicionales. Coste: contenido extra
a generar dinámicamente. Beneficio: 104 × 2 = 208 páginas nuevas
indexables, todas monetizables.

**Recomendación:** primero 2.1 + 2.2 + 2.3 (lo seguro). Si el RPM
sube tras la reapertura, añadir 2.4 en una sesión posterior.

#### Quality gate Fase 2

Por cada página con ads (después de Fase 2):

```ts
// Test E2E nuevo: ad-content-ratio.spec.ts
test('every page with ads has ≥500 words BEFORE the first ad', async ({ page }) => {
  for (const url of PUBLIC_AD_PAGES) {
    await page.goto(url)
    const wordsBeforeAd = await page.evaluate(() => {
      const ad = document.querySelector('.adsbygoogle')
      if (!ad) return Infinity
      // Walk DOM up to the ad node, sum word counts
      const before = document.body.cloneNode(true) as HTMLElement
      // ... implementation
    })
    expect(wordsBeforeAd).toBeGreaterThanOrEqual(500)
  }
})
```

Métricas binarias:

- [ ] `/brawler/[id]` rinde ≥1500 palabras visibles
- [ ] `/brawler` rinde ≥800 palabras visibles antes del grid
- [ ] `/picks` rinde ≥200 palabras antes del slot
- [ ] Schema.org `Article` JSON-LD presente en `/brawler/[id]`
- [ ] Cada slot tiene contenido visible above y below
- [ ] Lighthouse Best Practices ≥ 95 en cada página

---

### FASE 3 — Sostenibilidad (≈ 6 h)

#### 3.1 — Resto del Tier 2 del audit

- `/battle-history` reescrita como artículo (4 h)
- `/leaderboard` con contexto editorial (2 h)

Ya documentado en `README.md` Tier 2.

#### 3.2 — Página `/about`

Quién mantiene el sitio, contacto, links a privacy/terms. Nueva ruta
`src/app/[locale]/about/page.tsx`. ~400 palabras. Linkado desde footer.

#### 3.3 — Test E2E "ad-content ratio"

Ya bocetado en quality gate Fase 2. Implementar de verdad.

#### 3.4 — Solicitud de revisión a AdSense

Cuando todo lo anterior esté en `main` + deployado a prod + indexado
en Search Console:

1. Esperar **14 días** desde el último cambio editorial. Google
   necesita re-crawlear. Verificar en Search Console que las nuevas
   páginas aparecen y tienen impressions.
2. Solicitar revisión en AdSense usando la **plantilla de respuesta**
   que está en `README.md` apéndice "Plantilla de respuesta a Google".
3. Esperar 2-4 semanas para resolución.

---

## 6. Anti-patrones — NO HACER

1. **NO solicitar revisión hasta Fase 1+2 desplegadas y 14 días
   estabilizadas.** Una rejection cuenta contra ti.
2. **NO IA-generar 1500 palabras y dejarlo.** Detectable, low-quality,
   sancionable. La regla: la IA puede AUMENTAR el contenido pero la
   metodología, números y observaciones deben venir de los datos
   reales del repo (eso es originalidad real).
3. **NO añadir un 4º slot a `/brawler/[id]`** aunque las palabras
   alcancen. La regla industria es 3 max.
4. **NO meter ads en estados loading / error / empty.** Verificable:
   `if (!data || error) return <ErrorState />` debe estar antes que
   `<SafeAdSlot>`. Patron canónico.
5. **NO modificar `SafeAdSlot.tsx`** para hacer el `hasContent`
   opcional. La rigidez es su valor.
6. **NO añadir más ads a páginas privadas** (`/profile/[tag]/*`)
   esperando que escale. Las páginas de perfil son thin por
   naturaleza — la monetización principal va por las páginas
   públicas de brawlers.
7. **NO copiar texto de Brawlify ni del wiki.** Plagio = sanción
   inmediata. Generar TODO el copy desde nuestros datos +
   nuestra interpretación.

---

## 7. Verificación final pre-revisión

Checklist binario antes de pulsar "Solicitar revisión" en AdSense:

```
COMPLIANCE
[ ] /profile/[tag]/cosmetics: 0 imports de SafeAdSlot
[ ] /profile/[tag]/share:    0 imports de SafeAdSlot
[ ] /profile/[tag]/stats:    1 sola instancia de SafeAdSlot
[ ] /[locale]/methodology    existe, > 1500 palabras
[ ] /[locale]/about          existe, > 400 palabras
[ ] Footer site-wide linkea  /methodology y /about

CONTENIDO BRAWLER PAGES
[ ] /brawler/[id]            > 1500 palabras visibles
[ ] /brawler/[id]            tiene 2-3 slots compliant
[ ] /brawler/[id]            tiene schema.org Article JSON-LD
[ ] /brawler                 tiene > 800 palabras antes del grid
[ ] /picks                   tiene > 200 palabras antes del slot

TESTS
[ ] npx tsc --noEmit         exit 0
[ ] npx vitest run           exit 0, todos passing
[ ] new test ad-content-ratio.spec.ts passing

DEPLOY
[ ] main desplegado a prod
[ ] Search Console muestra nuevas páginas indexadas
[ ] Lighthouse Best Practices ≥ 95 en /brawler, /brawler/[id]

DOCUMENTACIÓN
[ ] CLAUDE.md actualizado con la nueva decisión-record
[ ] docs/audits/2026-04-30-adsense/SESSION_PROMPT.md (este fichero)
    actualizado con cualquier desviación al plan original
```

Solo cuando 100% de checks ✓, ejecutar:

> AdSense Dashboard → Site → Request Review → Pegar texto de la
> "Plantilla de respuesta a Google" del README.md.

---

## 8. Estimación de impacto en ingresos

Si Fase 1+2+3 ejecutan según plan:

| Métrica | Antes | Estimado post |
|---|---|---|
| Páginas con ads (públicas) | 4 (brawler, brawler/[id], picks, leaderboard, battle-history) | 5 mismas, con más slots |
| Slots de ads totales (públicas) | 5 | 8-10 |
| Slots privadas (free user) | 8 | 5 (reducción por compliance) |
| Total inventory | ~13 | ~13-15 |
| Compliant rate (ad gates correctos) | ~70% (estimado por audit) | 100% |
| RPM esperado | -- (sancionado) | normal |

La cuenta importante: **dejar de estar sancionado vale más que cualquier
optimización de density**. Sin aprobación, el inventory total = 0.

---

## 9. Cambios al CLAUDE.md (post-Fase 1)

Reemplazar la sección actual sobre ads por la versión que está en
`README.md` apéndice "Decisión-record". Resumen:

```
**Páginas con ads (post-2026-04-30 sanción):**
- Públicas: /brawler/[id] (2-3 slots), /brawler (1), /picks (1),
  /battle-history (1), /leaderboard (1)
- Privadas (free user): /profile/[tag] (1), /profile/[tag]/battles
  (gate ≥10 batallas), /profile/[tag]/brawlers (1),
  /profile/[tag]/club (1), /profile/[tag]/stats (1)
- EXPLÍCITAMENTE SIN ADS: /profile/[tag]/cosmetics,
  /profile/[tag]/share, landing, subscribe, login, error pages,
  loading/skeleton states.

**Reglas duras (Google AdSense, ref:**
docs/audits/2026-04-30-adsense/README.md**):**
1. Cada página con ads ≥300 palabras visibles above-the-fold
   (idealmente ≥500 antes del primer slot).
2. Calculadoras / formularios / share-cards / acciones puntuales
   NO llevan ads, sin excepciones.
3. Densidad: máximo 3 slots/página, mobile máximo 1 above-the-fold.
4. Cada página con ads tiene <h1> propio + estructura semántica.
5. Agregaciones de datos de terceros NO bastan — añadir comentario,
   metodología, ejemplos propios.
6. /methodology y /about deben existir y estar linkadas desde el
   footer site-wide.
```

---

## 10. Cuándo NO seguir este plan

- Si Google te aprueba la apelación SIN haber tocado nada (raro pero
  posible si la sanción fue automatizada y se revierte) → cierra solo
  Fase 1, mantén Fase 2 como mejora opcional.
- Si en mitad de Fase 2 detectas que el contenido auto-generado
  resulta repetitivo entre brawlers (mismo template, datos similares),
  PARA y rediseña el template para garantizar diferencias claras.
  Texto repetitivo = "templated" = low quality según Google.
- Si Lighthouse Best Practices baja por debajo de 90 en alguna
  página tras añadir ads, revertir el slot — Lighthouse mide CLS y
  ads mal placed lo arruinan.

---

## 11. Información para arrancar la próxima sesión rápido

```bash
# Sincronizar
cd /c/Proyectos_Agentes/brawlValue
git fetch origin
git checkout main
git pull origin main

# Verificar estado
npx tsc --noEmit
npx vitest run
git log --oneline -10  # debe terminar en ...9b911ed (docs adsense audit)

# Empezar Fase 1
git checkout -b adsense/phase-1-compliance
# ... implementar 1.1 → 1.2 → 1.3 → 1.4 → 1.5
```

Branch naming sugerido:
- `adsense/phase-1-compliance` — todos los cambios de Fase 1
- `adsense/phase-2-brawler-monetization` — Fase 2
- `adsense/phase-3-sustainability` — Fase 3

Una PR por fase. Cada PR debe pasar quality gate antes de merge.

---

## Apéndice A — Comandos útiles para esta misión

```bash
# Auditar ads en cada página
grep -rn "SafeAdSlot\|AdPlaceholder" src/app --include="*.tsx" \
  | grep -v "test.tsx\|SafeAdSlot.tsx\|AdPlaceholder.tsx"

# Word count rápido de un page renderizado (manual, requiere npm run dev)
curl http://localhost:3000/es/brawler/16000104 | \
  pandoc -f html -t plain | \
  wc -w

# Listar páginas indexadas en sitemap
curl https://brawlvision.com/sitemap.xml | grep '<loc>' | head -20

# Verificar que CLAUDE.md está actualizado
grep -A 5 "Páginas con ads" CLAUDE.md | head -20
```

---

## Apéndice B — Cuando termines, deja el siguiente prompt

Crea `docs/audits/2026-04-30-adsense/SESSION_2_PROMPT.md` con:

- Estado real al cerrar (qué fases se completaron)
- Issues encontrados durante la implementación que no estaban en el
  plan
- Métricas reales (word counts, lighthouse scores)
- Si ya se solicitó revisión a AdSense: fecha, plantilla usada,
  estado actual

Eso permite que la siguiente sesión continue sin re-investigar.
