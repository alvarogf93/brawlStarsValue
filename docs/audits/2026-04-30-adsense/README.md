# Auditoría AdSense — Infracción 2026-04-30

> Estado: análisis. Implementación pendiente en sesión dedicada.
> Branch base de revisión: `main` (commit `ea358ce`).
> Fuente: notificación de infracción de AdSense recibida el 2026-04-30.

## Cómo retomar este documento

1. Leer la sección "Lo que Google dijo" verbatim — es nuestro contrato.
2. Cruzar con "Auditoría página por página" — eso lista qué páginas
   tienen ads hoy y por qué cada una puede o no estar infringiendo.
3. Atacar las acciones por orden de prioridad (Tier 1 → 3).
4. Después de cada Tier, **eliminar `Content-Security-Policy-Report-Only`
   de la respuesta de revisión a Google** — esa frase suele llegar a
   gatos mal entrenados; explico debajo cómo se separa.
5. Solicitar revisión solo cuando los tres Tiers estén cerrados. Una
   solicitud rechazada hace más difícil la siguiente.

---

## Lo que Google dijo (verbatim)

> Asegúrate de que tu sitio sigue las Políticas del Programa AdSense.
> Podrás solicitar que lo revisemos cuando hayas enmendado la infracción.
>
> **Anuncios servidos por Google en pantallas sin contenido del editor.**
> No se permiten los anuncios servidos por Google en pantallas que:
> - No tengan contenido o su contenido sea de poco valor.
> - Se estén creando o editando.
> - Se usen para enviar alertas, navegar u otros fines de comportamiento.
>
> **Contenido de poco valor.** Su sitio web aún no cumple los requisitos
> de uso de la red de editores de Google.

Son **dos infracciones distintas**, atadas por causa común. Hay que
arreglar ambas explícitamente:

| Infracción | Naturaleza | Severidad |
|------------|------------|-----------|
| Ads en pantallas sin contenido | Técnica (callsites de `SafeAdSlot`) | Alta — bloquea ingresos |
| Contenido de poco valor | Editorial (texto, originalidad) | Alta — bloquea aprobación |

---

## Recursos oficiales que Google referenció

URLs canónicas (en orden de relevancia para esta infracción):

1. **Política — pantallas sin contenido:** https://support.google.com/publisherpolicies/answer/11036238
2. **Política — contenido de poco valor:** https://support.google.com/publisherpolicies/answer/11112688
3. **Requisitos mínimos AdSense (es):** https://support.google.com/adsense/answer/9335564?hl=es
4. **Mismo (anchor minimum_content_requirements):** https://support.google.com/adsense/answer/9335564#minimum_content_requirements
5. **Calidad webmaster (thin content anchor):** https://support.google.com/webmasters/answer/9044175#thin-content
6. **Webmaster Guidelines:** https://developers.google.com/search/docs/advanced/guidelines/webmaster-guidelines
7. **AdSense calidad general:** https://support.google.com/adsense/answer/48182
8. **AdMob policies:** https://support.google.com/admob/answer/6128543
9. **AdSense más info contenido:** https://support.google.com/adsense/answer/10015918
10. **AdSense más info contenido (alt):** https://support.google.com/adsense/answer/1348737

URLs históricas que ahora son secundarias (referenciadas pero de 2012,
mantener como contexto):

11. http://adsense.blogspot.com/2012/04/tips-for-creating-high-quality-sites.html
12. http://adsense.blogspot.com/2012/09/tips-for-creating-high-quality-sites.html

---

## Investigación oficial — qué exige Google realmente en 2026

Resumen extraído de las URLs anteriores y de fuentes públicas de 2026:

### Política sobre "ads en pantallas sin contenido"

> *"No se permiten anuncios servidos por Google en pantallas con contenido
> incrustado o copiado de otros sin comentarios adicionales, curaduría, o
> que añada valor a ese contenido. Tampoco se permiten en pantallas con
> más anuncios o material promocional pagado que contenido del editor.
> Tampoco en pantallas que están en construcción, dead-end (login,
> thank-you, exit, error), o donde el usuario mira deliberadamente
> para otro lado (e.g. apps de linterna)."*

Patrones FORBIDDEN explícitos:

- Pantallas de login / auth gates
- Pantallas de error
- Pantallas "thank you" / confirmación post-acción
- Pantallas de carga (skeleton sin contenido)
- Pantallas en blanco mientras se decide a dónde redirigir
- Calculadoras puras / formularios de edición
- Páginas que solo agregan datos de terceros sin comentario propio
- Páginas donde los ads ocupan más espacio que el contenido

### Política sobre "contenido de poco valor"

> *"El contenido que provees debe ser de valor para el usuario y debe ser
> el foco de atención de los visitantes del sitio."*

Sin un word-count oficial, pero el consenso de la industria 2026
(coincide con feedback de los reviewers de AdSense):

| Métrica | Umbral mínimo recomendado |
|---|---|
| Palabras únicas por página con ads | **≥ 300** (mejor 600+) |
| Originalidad (contenido único, no copiable de Brawlify/Supercell) | **≥ 30 %** del texto |
| Páginas con ads vs páginas con contenido | nunca **>50%** ads |
| Estructura semántica | H1, H2, H3, listas, imágenes con alt |

E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) —
el framework que los reviewers humanos aplican:

- **Experience:** ¿el autor demuestra haber usado el contenido del que
  habla? Para BrawlVision: ¿hay análisis que solo alguien que juega Brawl
  Stars escribiría?
- **Expertise:** ¿hay metodología explicada? ¿se cita el dataset?
- **Authoritativeness:** ¿hay autor visible? ¿"about" page real?
- **Trustworthiness:** ¿hay legal / privacy / contact? ¿footer
  identificable?

### IA: NO está prohibida

Google es explícito: *"Nuestra política no prohíbe contenido generado
por IA. Lo que prohibimos es contenido low-quality — thin, templated,
o no útil — sin importar cómo se produjo."*

Esto importa porque BrawlVision tiene contenido derivado/calculado.
La salida de un cálculo NO es "low quality" si se presenta con
contexto, metodología, y narrativa.

---

## Auditoría página por página

Cada entrada lista:
- callsite del `SafeAdSlot`
- `hasContent` actual
- diagnóstico (¿está bien gated? ¿tiene contenido editorial suficiente?)
- riesgo (alto/medio/bajo)
- acción concreta

### Páginas públicas con ads

#### A1. `/[locale]/battle-history` (página informativa)
- **callsite:** `src/app/[locale]/battle-history/page.tsx:189`
- **hasContent:** `benefits.length > 0 && steps.length > 0 && faq.length > 0`
- **Diagnóstico:** página estática promocional sobre la feature de
  histórico de batallas. El texto viene del i18n, son frases cortas
  promocionales. **Riesgo de "promotional content > publisher content".**
- **Riesgo:** ALTO — esta página es uno de los candidatos más probables
  de la sanción. Un reviewer humano la ve como un "landing de upsell"
  con banner publicitario, no como contenido informativo.
- **Acción:**
  - Reescribir como ARTÍCULO con análisis: "Por qué guardar histórico
    de batallas mejora tu juego — datos concretos del meta actual"
  - Añadir 600+ palabras de cuerpo: explicar tilt, sesiones, uso real
    de battle history vs trofeo road, ejemplos concretos.
  - Mover el ad SOLO si el cuerpo del artículo está rendered.
  - Añadir H2/H3, alt text en imágenes, fecha de publicación.

#### A2. `/[locale]/brawler` (grid roster)
- **callsite:** `src/app/[locale]/brawler/page.tsx:80`
- **hasContent:** `brawlerIds.length > 0`
- **Diagnóstico:** grid de 104 brawlers (portrait + nombre). Pura
  navegación. **Riesgo "navigation page".** Justo lo que la política
  llama "screens used for navigation" → forbidden.
- **Riesgo:** ALTO.
- **Acción:**
  - Convertir el header de la página en un artículo: "Roster completo
    Brawl Stars 2026 — distribución por rareza, análisis del meta".
  - Añadir 800+ palabras de análisis ANTES del grid: distribución de
    rareza con porcentajes, brawlers más jugados según los datos
    propios, ranking semanal de WR top con explicación.
  - Mover el ad solo después del bloque de análisis.
  - O bien **quitar el ad de esta página entera** si no hay tiempo
    editorial para mantener el artículo (decisión de producto).

#### A3. `/[locale]/brawler/[brawlerId]` (página individual)
- **callsite:** `src/app/[locale]/brawler/[brawlerId]/page.tsx:140`
- **hasContent:** `!!metaData && !error`
- **Diagnóstico:** datos PRO + meta de un brawler concreto. Mejor caso
  de los que tenemos. La descripción dinámica
  (`buildBrawlerMetaDescription`) ya añade 1 frase única por brawler.
- **Riesgo:** MEDIO — el contenido tiene valor real (mejor mapa, modo,
  WR), pero a un reviewer humano puede parecer "data table sin
  comentario".
- **Acción:**
  - Ampliar `buildBrawlerMetaDescription` a un párrafo de 80-150
    palabras por brawler con análisis: contexto de su rareza, meta
    histórico, comparación con sibling brawlers de la misma class.
  - Añadir H2 "Análisis del meta de [BRAWLER]" sobre el bloque PRO.
  - Añadir un párrafo "Cómo calculamos esto" con metodología
    (Bayesian WR, ventana de 14 días, fuente Supercell + datos PRO
    propios).
  - **Verificar** que la página rinde > 300 palabras de copy en cada
    locale.

#### A4. `/[locale]/leaderboard` (top 200)
- **callsite:** `src/app/[locale]/leaderboard/page.tsx:192`
- **hasContent:** `top3.length >= 3`
- **Diagnóstico:** lista de los top 200 jugadores globales con sus
  trofeos. Pura tabla. Sin análisis. **Igual riesgo que A2: "navigation
  / data table sin comentario".**
- **Riesgo:** ALTO.
- **Acción:**
  - Añadir bloque introductorio: "Cómo se forma el ranking global,
    explicación de los criterios de Supercell, qué significa un nivel
    de trofeos para un jugador real" (300+ palabras).
  - Añadir bloque cada 50 puestos del ranking con contexto: "El
    rango oro empieza aquí — qué significa", etc.
  - Si no hay capacidad editorial → quitar el ad.

#### A5. `/[locale]/picks` (rotación de mapas + recomendaciones)
- **callsite:** `src/components/picks/PicksContent.tsx:84`
- **hasContent:** `events.length > 0`
- **Diagnóstico:** muestra la rotación actual + top brawlers
  recomendados por mapa. Datos calculados por nosotros (Bayesian WR
  sobre datos PRO). Algo de valor, pero de nuevo: tabla sin comentario.
- **Riesgo:** MEDIO-ALTO.
- **Acción:**
  - Añadir 200+ palabras introductorias arriba del grid: explicar la
    metodología, ventana temporal, fuente de datos, por qué importa.
  - Añadir un bloque debajo: "Tendencias de la semana" con 2-3
    observaciones editoriales (auto-generables de los datos:
    "WR de DAMIAN subió 4% esta semana", etc).
  - Asegurar que el grid de 6 mapas no es lo único visible above
    the fold.

### Páginas privadas con ads (perfil de usuario)

Los usuarios free (no premium) ven ads en sus páginas de perfil.
Críticamente, **estas son las páginas más al filo de la política**.

#### B1. `/profile/[tag]` (overview)
- **callsite:** `src/app/[locale]/profile/[tag]/page.tsx:135 + :142`
- **hasContent:** `!!data.breakdown`
- **Diagnóstico:** el panel de cálculo de gemas + summary. Tiene
  datos reales y un breakdown único.
- **Riesgo:** MEDIO.
- **Acción:**
  - Añadir un párrafo explicando qué significa el "valor en gemas"
    y cómo se calcula. Una frase no es suficiente — añadir un
    "Cómo calculamos este valor" como bloque colapsable + 200
    palabras dentro.

#### B2. `/profile/[tag]/battles` (histórico de batallas)
- **callsite:** `src/app/[locale]/profile/[tag]/battles/page.tsx:223`
- **hasContent:** `data.battles.length > 0`
- **Diagnóstico:** lista de batallas. Útil para el usuario, pero
  para un reviewer humano: "lista de eventos sin análisis".
- **Riesgo:** MEDIO.
- **Acción:**
  - Header del bloque debe incluir un mini-análisis: "Has jugado
    {N} batallas en los últimos 7 días. WR actual: X%". Esto YA
    debería estar — verificar.
  - Considerar gate adicional: **mostrar ad solo si data.battles.length ≥ 10**.
    Una lista de 1-2 batallas con un ad es claramente "thin".

#### B3. `/profile/[tag]/brawlers` (roster del usuario)
- **callsite:** `src/app/[locale]/profile/[tag]/brawlers/page.tsx:412`
- **hasContent:** `filteredAndSorted.length > 0`
- **Diagnóstico:** grid de los brawlers desbloqueados + locked. Tiene
  la novedad de mostrar locked (FAIL-NEW-BRAWLERS), eso es contenido.
- **Riesgo:** MEDIO.
- **Acción:**
  - Añadir un bloque de header con análisis: "Has desbloqueado X de Y
    brawlers — completion: Z%. Tu rareza más jugada es W."
  - Mantener el ad solo si los filtros NO han vaciado el grid
    (ya gateado).

#### B4. `/profile/[tag]/club`
- **callsite:** `src/app/[locale]/profile/[tag]/club/page.tsx:309 + :519`
- **hasContent:** `!enrichLoading && sorted.length > 0`
- **Diagnóstico:** miembros del club + análisis. Buen contenido.
- **Riesgo:** BAJO-MEDIO.
- **Acción:** verificar que los dos slots no están demasiado cerca
  el uno del otro (Google penaliza ad density alta).

#### B5. `/profile/[tag]/cosmetics` (calculadora de cosméticos)
- **callsite:** `src/app/[locale]/profile/[tag]/cosmetics/page.tsx:129`
- **hasContent:** `data.totalGems !== undefined`
- **Diagnóstico:** **CONTRADICE EXPLÍCITAMENTE CLAUDE.md** que dice
  "all edit/form screens (subscribe, cosmetics calculator) intentionally
  have no ads". La política Google dice ads en calculadoras /
  pantallas de edición → forbidden. **Causa probable de la sanción
  más obvia.**
- **Riesgo:** **MUY ALTO — eliminar inmediatamente.**
- **Acción:**
  - **QUITAR el `<SafeAdSlot>` de esta página completamente.**
  - Actualizar CLAUDE.md para que la regla quede explícitamente cerrada.
  - Añadir un test que verifique que la página no importa SafeAdSlot.

#### B6. `/profile/[tag]/share` (viral share card)
- **callsite:** `src/app/[locale]/profile/[tag]/share/page.tsx:99`
- **hasContent:** `!!data.player`
- **Diagnóstico:** página enfocada en generar una imagen de share. El
  contenido principal es UNA imagen + botón "descargar". A los ojos
  de Google: pantalla de "alerta / acción", thin.
- **Riesgo:** ALTO.
- **Acción:**
  - **Quitar el ad de esta página** O añadir un bloque educacional
    de 300+ palabras sobre cómo compartir/usar la card. Lo primero
    es más rápido.

#### B7. `/profile/[tag]/stats` (estadísticas detalladas)
- **callsite:** 3 slots en `src/app/[locale]/profile/[tag]/stats/page.tsx`
- **hasContent:** `!!data.player && !!data.breakdown`
- **Diagnóstico:** análisis profundo, gráficos, brawlers ratios.
  Tiene contenido real y bastante. Pero **3 slots de ads en una sola
  página** es agresivo — eso por sí solo puede gatillar la regla
  "más ads que contenido".
- **Riesgo:** ALTO (por densidad de ads).
- **Acción:**
  - **Reducir a 1 slot** entre las secciones más densas. Actual: 3 slots
    es demasiado.
  - Mantener `hasContent` actual (data + breakdown).

---

## Issues identificados (resumen ejecutivo)

| ID | Categoría | Página | Severidad |
|---|---|---|---|
| AD-01 | Calculadora con ad (PROHIBIDO) | `/profile/[tag]/cosmetics` | 🔴 CRÍT |
| AD-02 | Page densidad ads alta | `/profile/[tag]/stats` (3 slots) | 🔴 CRÍT |
| AD-03 | Pantalla acción/share con ad | `/profile/[tag]/share` | 🟠 ALT |
| AD-04 | Navigation page con ad | `/brawler` (roster grid) | 🟠 ALT |
| AD-05 | Navigation page con ad | `/leaderboard` | 🟠 ALT |
| AD-06 | Promo page con ad sin contenido editorial | `/battle-history` | 🟠 ALT |
| AD-07 | Aggregated data sin commentario | `/picks` | 🟡 MED |
| AD-08 | Per-brawler thin description | `/brawler/[id]` | 🟡 MED |
| AD-09 | Battles list ad cuando hay <10 entries | `/profile/[tag]/battles` | 🟡 MED |
| AD-10 | Header sin análisis | `/profile/[tag]/brawlers` | 🟢 BAJ |
| AD-11 | Falta página "About / Methodology" | site-wide | 🟢 BAJ |

---

## Implementación — plan ejecutable

### Tier 1 — antes de pedir revisión (CRÍTICO)

Estas acciones deben estar en `main` antes de tocar el botón "Solicitar
revisión" en AdSense. Si solicitas con esto sin hacer, Google rechaza y
es más difícil la próxima.

**T1.1 — Eliminar ads de páginas calculadora / share**
- Archivos: `src/app/[locale]/profile/[tag]/cosmetics/page.tsx`,
  `src/app/[locale]/profile/[tag]/share/page.tsx`
- Borrar el `<SafeAdSlot>` y su import.
- Actualizar `CLAUDE.md` "Decisión-record" sobre ads para reflejar que
  share TAMBIÉN está fuera (cosmetics ya estaba documentado como fuera,
  pero el código no respetaba).
- Tests: añadir un test que importe ambas pages y assertee que no
  hay `SafeAdSlot` en su render.
- **Esfuerzo:** 30 min.

**T1.2 — Reducir density en stats**
- Archivo: `src/app/[locale]/profile/[tag]/stats/page.tsx` (3 slots)
- Eliminar 2 de los 3 `<SafeAdSlot>`. Mantener solo el del medio.
- **Esfuerzo:** 15 min.

**T1.3 — Crear página "Metodología / Cómo lo calculamos"**
- Nueva página `/[locale]/methodology` (o `/about` con sub-secciones).
- 1500+ palabras explicando:
  - Cómo se obtienen los datos (Supercell official API + Brawlify CDN).
  - Qué es Bayesian WR y cómo lo calculamos (con fórmula).
  - Cómo se construye la lista PRO (`/api/cron/meta-poll`).
  - Qué significa "tilt" / "comfort score" en nuestros análisis.
  - Frecuencia de actualización de cada dato.
  - Quién está detrás del proyecto (página "About").
  - Privacy + términos (linkar a /privacy si existe, crear si no).
- Footer site-wide debe linkar a esta página.
- **Esfuerzo:** 4-6 h (escribir buen copy en es + traducir a 13 locales
  vía script).

**T1.4 — Auditar que NINGUNA página renderiza ad cuando hay error**
- `grep -rn "SafeAdSlot" src/app | grep -v test` y verificar a mano
  que cada `hasContent` queda `false` en estados de error explícitos.
- Casos a revisar:
  - `usePlayerData` returns `error` → ¿el render condicional sale
    antes del SafeAdSlot? (verificar línea por línea).
  - `useClubEnriched` con `error` flag.
  - 404 / not found.
- **Esfuerzo:** 1 h.

### Tier 2 — esencial para reapertura sostenible

**T2.1 — Reescribir `/battle-history` como artículo informativo**
- 600-800 palabras de cuerpo: contexto del meta, importancia de
  histórico, ejemplos concretos.
- Añadir tabla comparativa: "Sin histórico vs con histórico".
- Mantener CTA pero claramente posicionado como secundario.
- Mover el `<SafeAdSlot>` solo después del cuerpo del artículo.
- **Esfuerzo:** 3 h escribir + 1 h traducir.

**T2.2 — Re-elaborar `/brawler` (roster grid)**
- Antes del grid: bloque "Análisis del roster Brawl Stars 2026":
  distribución por rareza con %, top-10 brawlers más jugados con WR,
  observaciones del meta semanal.
- Auto-generar el contenido basado en datos reales — eso lo hace
  ÚNICO y dinámico.
- 600+ palabras visibles antes del grid.
- **Esfuerzo:** 4 h (incluye plantilla auto-generada + 13 locales
  para los strings invariantes).

**T2.3 — Re-elaborar `/leaderboard`**
- Bloque introductorio: "Cómo se forma el ranking global, criterios
  Supercell" (300 palabras).
- Cada 50 puestos: card con análisis ("Top 50: élite global",
  "Top 100: jugadores serios", etc).
- **Esfuerzo:** 2 h.

**T2.4 — Mejorar `/brawler/[id]` con metodología explícita**
- Ampliar `buildBrawlerMetaDescription` a 80-150 palabras por brawler.
- Añadir bloque "Cómo calculamos esto" — sección colapsable con la
  metodología.
- Añadir H2/H3 hierarchy clara.
- **Esfuerzo:** 3 h.

**T2.5 — Mejorar `/picks` con análisis editorial**
- Bloque introductorio (200 palabras): metodología.
- Bloque "Tendencias de la semana" auto-generado (3 observaciones).
- **Esfuerzo:** 3 h.

### Tier 3 — opcional / nice-to-have

**T3.1 — Añadir `/profile/[tag]/battles` gate stricter**
- Solo mostrar ad si `data.battles.length >= 10`.
- **Esfuerzo:** 5 min.

**T3.2 — Añadir auto-summary en `/profile/[tag]/brawlers`**
- Bloque header con "completion %, rareza más jugada, top brawlers".
- **Esfuerzo:** 1 h.

**T3.3 — Añadir página `/about`**
- Quién hace el sitio, contacto, política privacidad, términos.
- **Esfuerzo:** 2 h.

**T3.4 — Schema.org structured data en todas las páginas con ads**
- `Article` schema en `/battle-history`, `/brawler/[id]`.
- `WebSite` schema site-wide.
- Mejora la señal de "esto es contenido editorial" para los crawlers.
- **Esfuerzo:** 2 h.

---

## Decisión-record que hay que actualizar en `CLAUDE.md`

Reemplazar la sección actual sobre ads:

> **Ads go through `SafeAdSlot`, not `AdPlaceholder` directly** — `SafeAdSlot`
> (`src/components/ui/SafeAdSlot.tsx`) forces every callsite to pass a
> required `hasContent: boolean` prop; it returns `null` when false. (...)

Por esta versión actualizada (post-Tier-1):

> **Páginas con ads (post-2026-04-30 sanción):**
> - **Públicas:** `/brawler/[id]`, `/picks`, `/battle-history`, `/leaderboard`.
>   `/brawler` (roster grid) — bajo revisión, candidato a quitar.
> - **Privadas (free user only):** `/profile/[tag]`, `/profile/[tag]/battles`
>   (con gate `≥10 batallas`), `/profile/[tag]/brawlers`,
>   `/profile/[tag]/club`, `/profile/[tag]/stats` (UN solo slot).
> - **EXPLÍCITAMENTE SIN ADS (forbidden por política):**
>   `/profile/[tag]/cosmetics`, `/profile/[tag]/share`, landing,
>   subscribe, login, error pages, loading/skeleton states.
>
> **Reglas duras (Google AdSense, ref:**
> `docs/audits/2026-04-30-adsense/README.md` **):**
> 1. Cada página con ads debe tener ≥300 palabras de contenido editorial
>    visible above-the-fold.
> 2. Calculadoras / formularios / share-cards / pantallas de acción NO
>    llevan ads, sin excepciones.
> 3. Densidad: máximo 1 slot por viewport visible. Stats reducido de
>    3 a 1 slot.
> 4. Cada página con ads tiene `<h1>` propio + estructura semántica.
> 5. Datos puramente agregados de terceros (Supercell/Brawlify) no
>    bastan — añadir comentario, metodología, ejemplos propios.

---

## Plantilla de respuesta a Google al pedir revisión

Cuando todo Tier 1 + Tier 2 esté en `main` y desplegado:

> Hemos abordado las dos infracciones reportadas:
>
> 1. **Anuncios en pantallas sin contenido del editor:** hemos auditado
>    todas las pantallas con ads y eliminado los ads de:
>    - Calculadora de cosméticos (acción / formulario)
>    - Tarjeta de compartir viral (acción puntual)
>    - 2 de 3 slots redundantes en la página de stats
>    - Cualquier estado de error/loading/skeleton/empty (vía
>      componente `SafeAdSlot` con prop `hasContent` requerida).
>
>    Las pantallas restantes con ads tienen contenido editorial
>    sustantivo (≥300 palabras de análisis original) above the fold,
>    incluyendo metodología explicada y datos derivados originales no
>    disponibles en Supercell/Brawlify.
>
> 2. **Contenido de poco valor:** hemos publicado:
>    - Página de metodología detallada
>      (`https://brawlvision.com/methodology`) explicando cómo se
>      calculan todos los índices propios (Bayesian WR, Comfort Score,
>      tilt analysis).
>    - Página "About"
>      (`https://brawlvision.com/about`) con autoría, contacto,
>      política de privacidad y términos.
>    - 600-1500 palabras de análisis original en cada página con ads,
>      incluyendo ejemplos concretos del meta semanal y tendencias
>      auto-generadas a partir de nuestro dataset propio (cron PRO).
>    - Schema.org `Article` en páginas de tipo artículo.
>
> Estamos a disposición para revisar páginas concretas si fuera útil.

---

## Anti-patrones que NO hay que cometer

1. **Borrar ads sin reemplazar contenido.** Si quitas todos los ads de
   las páginas y solicitas revisión sin añadir contenido, el problema
   "low-value content" sigue.
2. **AI-generar 600 palabras y dejarlo.** Google detecta texto AI sin
   editar y lo penaliza. La política dice: la IA NO está prohibida,
   pero "low quality" sí. Texto IA debe ser revisado, ampliado, con
   ejemplos concretos.
3. **Solicitar revisión en menos de 14 días tras cambios.** Google
   tarda en re-crawlear. Esperar a que el sitemap muestre las nuevas
   páginas indexadas en Search Console antes de pedir revisión.
4. **Cambiar el AD client ID o reinstalar el snippet.** No arregla
   nada, gasta velocidad de re-revisión.

---

## Métricas de éxito post-implementación

Cuando los 3 tiers estén cerrados, verificar:

- [ ] `npm run build` y abrir cada página con ads en preview. Confirmar
      visualmente que hay > 300 palabras de copy visible antes del primer
      ad.
- [ ] `lighthouse` en cada página con ads — score Best Practices ≥ 95.
- [ ] Search Console: 0 manual actions activas.
- [ ] AdSense reports: nuevo intento de aprobación → status "approved".
- [ ] Test E2E nuevo: cada página con `<SafeAdSlot>` debe rendir un
      `<h1>` + ≥3 párrafos en `<main>` antes del slot (DOM order).

---

## Apéndice — investigación realizada (2026-04-30)

Documentación oficial fetched verbatim para este análisis:

- `https://support.google.com/publisherpolicies/answer/11036238` —
  política sobre pantallas sin contenido. Confirmó la lista de
  patrones forbidden (calculadoras, share, navigation, error,
  thank-you, login, embedded-from-others-sin-comentario).
- `https://support.google.com/adsense/answer/9335564?hl=en` —
  requisitos mínimos. Sin word-count oficial pero referencia a
  "value to user".
- `https://support.google.com/publisherpolicies/answer/11112688` —
  contenido de poco valor. Lista dead-end pages, flashlight apps
  (deliberate look-away), automated content sin curaduría.
- `https://support.google.com/webmasters/answer/9044175` — thin
  content definición + ejemplos: thin affiliate, scraped, doorway.

Búsquedas web 2026 que confirman:
- Industry consensus: 300+ palabras / página con ads, 1000-1500 ideal.
- 30%+ contenido único no copiable.
- E-E-A-T framework para reviewers humanos.
- AI no está prohibida — solo low-quality regardless of producer.
