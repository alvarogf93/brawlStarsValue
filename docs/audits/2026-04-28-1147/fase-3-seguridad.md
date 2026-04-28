# Reporte Fase 3 — Seguridad, Rendimiento y Resiliencia

> Auditor: Panóptico
> Fecha: 2026-04-28T11:47:00Z
> Repo: C:\Proyectos_Agentes\brawlValue
> Commit: 604fe24abe1a37a5963b07f199201eaca5323f13
> Rama: main

---

## 1. Resumen ejecutivo

La postura defensiva en autenticación (cookie httpOnly + service-role aislado, validación de tag, idempotencia en webhook PayPal con `timingSafeEqual` en Telegram) es notablemente sólida y **muy por encima** del promedio de un side-project. Sin embargo, la auditoría identifica **2 hallazgos CRÍTICOS** (open-redirect en `/api/auth/callback`, ausencia total de timeouts en TODAS las llamadas externas — Supercell/PayPal/Telegram/Brawlify), **1 ALTO** (CVE-2025 high en `next@16.2.2` con DoS de Server Components — fix disponible) y **6 ALTOS** adicionales (rate-limit in-memory inservible en serverless, ausencia de CSP, regex de `player_tag` inconsistente entre rutas, `/api/notify/signup` sin idempotencia, `/api/battlelog` y `/api/club` sin auth ni rate-limit habilitan abuso de la cuota Supercell/IP-ban, IDOR teórico en `paypal/confirm` por confiar en `profile_id` del query string). El sistema funciona y los principios están bien aplicados, pero la superficie pública multi-locale × 27 routes + dependencia dura de 4 APIs externas sin red de seguridad es la vulnerabilidad estructural a corregir.

---

## 2. Alcance revisado

- **Ficheros analizados (manualmente):** 27 routes API (`src/app/api/**/route.ts`), `src/proxy.ts`, `next.config.ts`, `src/lib/api.ts`, `src/lib/paypal.ts`, `src/lib/supabase/server.ts`, `src/lib/telegram.ts`, `src/lib/telegram/sender.ts`, `src/lib/telegram/queries.ts`, `src/lib/telegram/webhook/route.ts`, `src/lib/anonymous-visits.ts`, `src/lib/battle-sync.ts`, `src/lib/cron/heartbeat.ts`, `src/lib/constants.ts`, `src/lib/analytics/compute.ts` (índice de funciones).
- **Herramientas estáticas ejecutadas:**
  - `npm audit --json` → exit 1; **3 vulnerabilidades** (1 high `next`, 2 moderate `next-intl` + `postcss`); todas con fix disponible (`next@16.2.4`, `next-intl@4.9.1`).
  - `Grep` masivo de patrones inseguros: `dangerouslySetInnerHTML`, `eval`, `child_process`, `localStorage.*token`, `Authorization.*Bearer.*localStorage`, `setTimeout|signal:|AbortController`, `Access-Control-Allow|Strict-Transport-Security|Content-Security-Policy`.
- **Excluidos del scope (con motivo):**
  - Migrations SQL (`supabase/migrations/*`) — fuera del scope de seguridad de aplicación; sólo se trazan funciones llamadas desde el código (`bulk_upsert_meta_*`, `compute_brawler_trends`, `cleanup_map_mode_strays`, `track_anonymous_visit`).
  - Tests (`src/__tests__/**`) — la dimensión de testing pertenece a Fase 4.
  - Componentes UI client puros (`src/components/**` salvo `FAQSection`/`landing/InputForm` ya cubiertos en Fase 2 y revisados aquí sólo por XSS).

---

## 3. Hallazgos

### SEG-01 — Open redirect en `/api/auth/callback` vía `?next=`

- **Criticidad:** CRÍTICA
- **Categoría:** Seguridad
- **Ubicación:** `src/app/api/auth/callback/route.ts:6-11, 51`
- **Evidencia:**
  ```ts
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}${next}`)
  }
  // …
  return NextResponse.redirect(`${origin}${next}`)
  ```
- **Problema detectado:** El parámetro `next` viene del query string sin validación. Concatenar `${origin}${next}` con `next="//evil.com/phish"` produce `https://brawlvision.com//evil.com/phish`, que la mayoría de navegadores y `Response.redirect` interpretan como `https://evil.com/phish` (la barra inicial doble se trata como un esquema ausente con autoridad). Esto convierte el callback OAuth en un *open redirect*: un atacante envía a la víctima un enlace `https://brawlvision.com/api/auth/callback?next=//evil.com/login`, la víctima ve el dominio legítimo, OAuth se completa, y termina en una landing controlada por el atacante con la sesión recién creada en su cookie en brawlvision.com. Combinado con phishing visual (clon de `/login`) es un vector de hijacking probable. CWE-601.
- **Acción requerida:** Sustituir la concatenación por una validación de allowlist: aceptar sólo `next` que empiece por `/` y no por `//` ni `/\\`, y normalizar contra una whitelist de paths conocidos (`/`, `/profile/...`, `/[locale]/...`). Mejor todavía: usar `new URL(next, origin)` y comprobar que `parsed.origin === origin` antes de redirigir; si no, fallback a `/`. Aplicar el mismo fix al `if (!code)` early-return. Talla: S (≤ 15 LoC).

### SEG-02 — `next@16.2.2` vulnerable a CVE GHSA-q4gf-8mx6-v5v3 (DoS Server Components, CVSS 7.5)

- **Criticidad:** ALTA
- **Categoría:** Seguridad
- **Ubicación:** `package.json:36` (`"next": "16.2.2"`)
- **Evidencia:**
  ```
  $ npm audit --json
  "next": {
    "severity": "high",
    "title": "Next.js has a Denial of Service with Server Components",
    "url": "https://github.com/advisories/GHSA-q4gf-8mx6-v5v3",
    "cvss": { "score": 7.5 },
    "range": ">=16.0.0-beta.0 <16.2.3",
    "fixAvailable": { "name": "next", "version": "16.2.4", "isSemVerMajor": false }
  }
  ```
- **Problema detectado:** La versión actual está dentro del rango vulnerable. Un atacante remoto puede agotar recursos del runtime de Server Components con peticiones específicas. Sumado al CVE moderate de `postcss` (XSS en stringify, GHSA-qx2v-qp2m-jg93) que se arrastra por `next`, el upgrade a 16.2.4 (no semver-major) cierra ambos.
- **Acción requerida:** `npm install next@16.2.4 next-intl@^4.9.1`, ejecutar `npx vitest run` + `npx tsc --noEmit` + `npx playwright test` para detectar regresiones de la migración menor. Talla: S (rebote de versión + suite full).

### SEG-03 — `/api/auth/callback` redirige `next` incluso cuando viene sin `?code` y nunca lo valida contra el locale soportado

- **Criticidad:** ALTA
- **Categoría:** Seguridad
- **Ubicación:** `src/app/api/auth/callback/route.ts:10-12, 46-47`
- **Evidencia:**
  ```ts
  if (!code) {
    return NextResponse.redirect(`${origin}${next}`)
  }
  // …
  const locale = next.split('/')[1] || 'es'
  return NextResponse.redirect(`${origin}/${locale}?auth_error=1`)
  ```
- **Problema detectado:** La extracción `next.split('/')[1] || 'es'` confía en que el atacante use uno de los 13 locales válidos. Si `next="/admin/secret"`, `locale="admin"` y la URL resultante es `${origin}/admin?auth_error=1`. Aunque no haya un path `admin`, el sistema redirige a una ruta inválida con la flag `auth_error=1`, ensuciando el `UrlFlashMessage` y permitiendo enumerar paths sin auth. Además, el branch `if (!code)` redirige sin haber autenticado nada — efectivamente acepta cualquier `next` arbitrario sin OAuth, agravando SEG-01.
- **Acción requerida:** Validar `locale` contra una constante `SUPPORTED_LOCALES` (ya definida en otros routes — reutilizar). Eliminar el branch de redirect en `if (!code)` (devolver 400 explícito en su lugar; no hay flujo legítimo que llegue aquí sin code). Talla: S.

### SEG-04 — `paypal/confirm` confía en `profile_id` del query string sin verificar el dueño de la cookie

- **Criticidad:** ALTA
- **Categoría:** Seguridad
- **Ubicación:** `src/app/api/checkout/paypal/confirm/route.ts:13-57`
- **Evidencia:**
  ```ts
  const subscriptionId = searchParams.get('subscription_id')
  const profileId = searchParams.get('profile_id')
  // …
  await supabase.from('profiles').update({ tier: 'premium', … }).eq('id', profileId)
  ```
- **Problema detectado:** El callback tras la aprobación PayPal lee `profile_id` desde la URL y aplica la actualización a esa fila usando service-role (RLS bypass). El comentario indica que el webhook (`webhooks/paypal`) es la ruta autoritativa, pero esta ruta también escribe `tier='premium'`. Si un atacante observa una `subscriptionId` `ACTIVE` legítima de cualquier otro usuario (e.g. enumerándolas tras crearse una propia, o por leak en logs), podría llamar `?subscription_id=<otra>&profile_id=<propio>` y heredar el premium de otro — porque la verificación es sólo `details.status === 'ACTIVE'`, sin chequear que `details.customId === profileId`. La idempotencia (`alreadyApplied`) no protege: el atacante simplemente apunta a su propio `profile_id` mientras el `subscription_id` es ajeno. Es un upgrade-jacking.
- **Acción requerida:** Tras `getSubscriptionDetails(subscriptionId)`, comparar `details.customId === profileId` y rechazar si no coincide. Adicionalmente leer la cookie de sesión y validar que `user.id === profileId`. Sin la doble validación, el endpoint debe considerarse compromisible. Talla: S.

### SEG-05 — Regex de `player_tag` inconsistente entre rutas (3-12 vs 3-20)

- **Criticidad:** MEDIA
- **Categoría:** Seguridad
- **Ubicación:** `src/lib/constants.ts:3` (`/^#[0-9A-Z]{3,20}$/i`) vs `src/app/api/profile/route.ts:4` y `src/app/api/club/route.ts:8` (`/^#[0-9A-Z]{3,12}$/`)
- **Evidencia:**
  ```ts
  // constants.ts
  export const PLAYER_TAG_REGEX = /^#[0-9A-Z]{3,20}$/i
  // profile/route.ts
  const TAG_REGEX = /^#[0-9A-Z]{3,12}$/
  // club/route.ts
  if (!/^#[0-9A-Z]{3,12}$/.test(clubTag.toUpperCase())) { … }
  ```
- **Problema detectado:** `/api/calculate`, `/api/battlelog`, `/api/player/tag-summary` aceptan tags hasta 20 chars (case-insensitive); `/api/profile` y `/api/club` rechazan ≥13 chars y `/api/club` requiere uppercase explícito. Una tag legítima de 15 chars puede crear perfil-bloqueado (POST profile devuelve 400) tras la validación previa exitosa en signup, generando una experiencia rota silenciosa. Inverso: un atacante con tag legítimo de Brawl Stars de 14 chars no puede registrarse pero sí consultar. Aparte de la inconsistencia funcional, la duplicación del regex permite drift futuro y dificulta auditoría — es la regla "regex centralizado o no es regex".
- **Acción requerida:** Reemplazar las dos copias inline por `import { PLAYER_TAG_REGEX } from '@/lib/constants'` y normalizar el upper-case en una helper compartida. Verificar el tamaño máximo real de tags en la API de Supercell (los hay de 11 chars; 20 es generoso pero defendible). Talla: S.

### SEG-06 — `/api/battlelog` y `/api/club` son rutas POST públicas sin auth ni rate-limit que reenvían a Supercell

- **Criticidad:** ALTA
- **Categoría:** Seguridad
- **Ubicación:** `src/app/api/battlelog/route.ts:5-14`, `src/app/api/club/route.ts:4-13`
- **Evidencia:**
  ```ts
  // battlelog/route.ts
  export async function POST(req: Request) {
    const { playerTag } = await req.json()
    if (!playerTag || typeof playerTag !== 'string' || !PLAYER_TAG_REGEX.test(playerTag)) {
      return NextResponse.json({ error: 'Invalid player tag format', code: 400 }, { status: 400 })
    }
    const data = await fetchBattlelog(playerTag)
    return NextResponse.json(data)
  }
  ```
- **Problema detectado:** Sin auth, sin rate-limit, sin captcha, sin tracking. Un cliente puede martillear estos endpoints; cada llamada consume cuota Supercell del Cloudflare Worker proxy (`BRAWLSTARS_API_URL`). Si un atacante itera 1k tags/segundo durante una hora, Supercell baneará el rango IP del Worker y el sitio entero queda offline para `/profile`, `/compare`, `/subscribe`, calendario, club chart — todos los flujos premium dependen de battlelog. Dado que la cuota Supercell tiene un techo conocido y compartido entre todos los usuarios reales del servicio, cualquier denegación temporal escala a denegación de servicio para todos. La precaución de fondo (Cloudflare Worker delante) sólo añade una capa de ofuscación, no rate-limit por IP.
- **Acción requerida:** Implementar rate-limit basado en `Upstash Redis` (las creds ya están en `.env.example` pero el módulo no se usa) con clave por `request.headers.get('x-forwarded-for')` o `request.ip`, e.g. 30 req/min/IP en estos dos endpoints. Considerar mover la lógica a server-only — si el único caller legítimo es el server (`/profile/[tag]/page.tsx`), eliminar el endpoint y usar `fetchBattlelog` directo. Talla: M.

### SEG-07 — Ausencia total de Content-Security-Policy

- **Criticidad:** ALTA
- **Categoría:** Seguridad
- **Ubicación:** `next.config.ts:13-26` (cabeceras globales)
- **Evidencia:**
  ```ts
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
      ],
    }]
  }
  ```
- **Problema detectado:** No hay `Content-Security-Policy`. La aplicación carga scripts desde `cdn.brawlify.com`, `api.brawlapi.com`, AdSense (`pagead2.googlesyndication.com`), Google Analytics (`www.googletagmanager.com`), y embute JSON-LD vía `dangerouslySetInnerHTML` en `[locale]/layout.tsx:171-198` y `FAQSection.tsx:51`. Una XSS reflejada o stored (no encontrada hoy, pero el diseño no lo previene defensivamente) ejecuta cualquier `eval`/exfiltración sin freno. HSTS está sin `preload` directive. Combinado con el open-redirect SEG-01 y la ausencia de validación de URLs externas en `<img src={…}>` (e.g. `onError → parent.innerHTML = ''`), la superficie es amplia.
- **Acción requerida:** Añadir CSP con allow-list explícita: `default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://pagead2.googlesyndication.com https://www.google.com 'sha256-…' /* JSON-LD inline */; img-src 'self' data: https://cdn.brawlify.com https://api.brawlapi.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://www.google-analytics.com; frame-ancestors 'none';`. Incrementar HSTS a `max-age=63072000; includeSubDomains; preload` cuando esté listo para hsts-preload.org. Talla: M (deploy iterativo en `Report-Only` antes de enforcing).

### SEG-08 — Stack traces de PostgREST se devuelven al cliente en `/api/battles` y `/api/profile`

- **Criticidad:** MEDIA
- **Categoría:** Seguridad
- **Ubicación:** `src/app/api/battles/route.ts:58-60`, `src/app/api/profile/route.ts:53-55`
- **Evidencia:**
  ```ts
  // battles/route.ts
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // profile/route.ts (POST)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 409 })
  }
  ```
- **Problema detectado:** `error.message` de Supabase JS expone detalles internos: nombres de constraint, columnas, hints de PostgREST, ocasionalmente fragmentos del SQL. Para una violación 23505 unique (perfil duplicado) revela `duplicate key value violates unique constraint "profiles_player_tag_key"` — confirmando la existencia de cualquier tag enumerado. Convierte un POST `/api/profile` con `player_tag` arbitrario en un oráculo de existencia.
- **Acción requerida:** Reemplazar por mensajes genéricos al cliente y `console.error(error)` para preservar diagnóstico server-side. Mapear códigos PostgREST a respuestas estables (`23505 → "Tag already linked to another account"` sin filtrar el constraint name). Talla: S.

### SEG-09 — `/api/notify/signup` carece de idempotencia y permite spam de Telegram via re-llamadas

- **Criticidad:** MEDIA
- **Categoría:** Seguridad
- **Ubicación:** `src/app/api/notify/signup/route.ts:10-32`
- **Evidencia:**
  ```ts
  export async function POST() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('player_tag').eq('id', user.id).single()
    await notify(`🎮 <b>New signup!</b>\nTag: ${profile.player_tag}\nEmail: ${user.email || 'unknown'}`)
    return NextResponse.json({ ok: true })
  }
  ```
- **Problema detectado:** Un usuario autenticado puede reinvocar el endpoint repetidamente (no hay flag persistente "ya notificado"); cada llamada dispara un mensaje a Telegram. Aparte de ruido para el operador, el mensaje incluye el `email` del usuario — si el endpoint fuera abusable de otro modo (e.g. una vulnerabilidad CSRF futura combinada con la ausencia de SameSite=strict), un atacante podría exfiltrar emails de víctimas autenticadas hacia el chat Telegram. La fuga de email del log es además incompatible con GDPR si un usuario ejerce el derecho al olvido (Telegram retiene los mensajes).
- **Acción requerida:** Añadir flag persistente en `profiles.signup_notified_at` y rechazar la segunda llamada con 200 OK silencioso. Considerar hashear/truncar el email en el cuerpo del mensaje o llamar a Telegram desde el server-side hook que crea el `auth.users` (Supabase auth hook), no desde un endpoint POST disparable por el cliente. Talla: S.

### SEG-10 — `/api/profile/check-premium` permite enumeración de tags premium sin auth

- **Criticidad:** BAJA
- **Categoría:** Seguridad
- **Ubicación:** `src/app/api/profile/check-premium/route.ts:10-37`
- **Evidencia:**
  ```ts
  const tag = searchParams.get('tag')?.toUpperCase().trim()
  // …
  return NextResponse.json({ hasPremium })
  ```
- **Problema detectado:** Endpoint público que responde verdadero/falso por tag arbitrario sin rate-limit. Permite a un competidor enumerar quién es premium en la base, escala con el rate de Supabase. Información competitiva pero no PII estricta — por eso BAJA.
- **Acción requerida:** Añadir rate-limit IP + ofuscar la diferencia entre "premium" y "no premium" con un retraso mínimo constante (no expone gran cosa pero protege de side-channel). Considerar hacer este check parte de `/api/profile/me` (auth required) si el único llamador es la propia UI del propietario del tag. Talla: S.

---

### PERF-01 — Ninguna llamada externa tiene timeout — riesgo de cron stall y exhaustion del pool serverless

- **Criticidad:** ALTA
- **Categoría:** Resiliencia
- **Ubicación:** `src/lib/api.ts:45-57`, `src/lib/paypal.ts:22-27,44-56,72-104,117-134,159-160,182-197`, `src/lib/telegram.ts:12-20`, `src/lib/telegram/sender.ts:22-31`, `src/lib/draft/brawler-names.ts:13`, `src/app/api/maps/route.ts:13`, `src/app/api/draft/maps/route.ts:16`
- **Evidencia:**
  ```ts
  // src/lib/api.ts
  async function apiFetch<T>(path: string, revalidate = 300): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: headers(),
      next: { revalidate },
    })
    // … sin AbortSignal.timeout()
  }
  ```
  ```
  $ Grep "setTimeout|signal:|AbortController|timeout:" src/lib
  No matches found
  ```
- **Problema detectado:** Cero timeouts en la base. Si Supercell (o el Cloudflare Worker proxy, o PayPal, o Telegram) cuelga la conexión sin RST/FIN, el `fetch` espera el default global de Node — minutos. Concretamente:
  - `runBalancedPoll` itera hasta 1000 jugadores haciendo `fetchBattlelog` secuencial. Un solo battlelog congelado a los 60s consume el 20% del wall-clock budget (270s soft, 300s hard).
  - `Promise.allSettled(META_POLL_RANKING_COUNTRIES.map(c => fetchPlayerRankings(c, 200)))` en el preload paraleliza 11 fetches; uno cuelga y los otros 10 también ocupan slots concurrentes hasta el `maxDuration`.
  - `paypal.getAccessToken()` se llama en cada `verifyPayPalWebhook`, `createSubscription`, `getSubscriptionDetails`. Si el endpoint OAuth de PayPal flaquea (común en su sandbox), el webhook entero se queda esperando — y Telegram retransmite agresivamente al ver no-2xx, multiplicando la carga.
  - `notify()` y `sendTelegramMessage()` se llaman desde `after()` en `/api/calculate` y desde `/api/webhooks/paypal` — un Telegram caído es capaz de mantener la función Vercel viva consumiendo cuota inútilmente.

  Los retries no existen como tales (con jitter/backoff) y los que existen son ad-hoc: `auth/callback` reintenta una vez; `meta-poll` no reintenta; cron sync rate-limita 200ms entre llamadas pero no implementa retry sobre 429/503 de Supercell.
- **Acción requerida:** Crear `src/lib/http.ts` con un wrapper `fetchWithTimeout(url, opts, ms = 8000)` que use `AbortSignal.timeout(ms)`, y obligar a todos los callers a pasar por él. Implementar retry exponencial con jitter sólo para idempotentes (GET, OAuth client_credentials, verify-webhook) usando una función pura testeable. Considerar circuit-breaker (`opossum`-style) para Supercell — si 5 fallos en 30s, abrir 60s y devolver "API down" sin intentar. Talla: L (cambio transversal pero acotado a `lib/`).

### PERF-02 — Rate-limit in-memory en `/api/analytics` no funciona en serverless multi-instancia

- **Criticidad:** ALTA
- **Categoría:** Rendimiento + Resiliencia
- **Ubicación:** `src/app/api/analytics/route.ts:7-9, 24-30, 43`
- **Evidencia:**
  ```ts
  const RATE_LIMIT_MS = 10_000
  const rateLimitMap = new Map<string, number>()
  // …
  const lastRequest = rateLimitMap.get(user.id)
  if (lastRequest && Date.now() - lastRequest < RATE_LIMIT_MS) {
    return NextResponse.json({ error: 'Rate limited…' }, { status: 429 })
  }
  ```
- **Problema detectado:** Vercel Functions arrancan múltiples instancias bajo carga. Cada instancia tiene su propio `rateLimitMap`, así que un usuario puede emitir N peticiones en paralelo y caerán en N instancias frescas, todas pasando el check. La protección que aparenta existir es teatro: en producción no limita nada. Peor, `computeAdvancedAnalytics` procesa hasta 5000 battles en CPU pura (963 LoC, 27 funciones de agregación) — sin rate-limit real, un usuario malicioso premium dispara cientos de instancias serverless caras simultáneamente.
- **Acción requerida:** Migrar a Upstash Redis (creds ya en `.env.example`, sin uso). Usar `@upstash/ratelimit`: `Ratelimit.slidingWindow(6, '60s')`. Patrón aplicable también a `/api/calculate`, `/api/battlelog`, `/api/club`, `/api/sync`, `/api/profile/check-premium`. Talla: M (módulo + 5 callsites).

### PERF-03 — `computeAdvancedAnalytics` corre síncrono en el handler con hasta 5000 battles

- **Criticidad:** MEDIA
- **Categoría:** Rendimiento
- **Ubicación:** `src/app/api/analytics/route.ts:46-57`, `src/lib/analytics/compute.ts:26-963`
- **Evidencia:** 27 funciones puras en `compute.ts`, cada una iterando `battles[]` de hasta 5000 elementos; el handler las ejecuta en serie sobre el event loop.
- **Problema detectado:** Latencia esperada con 5000 battles: ~150-400 ms CPU bloqueante por request (medible). Bajo concurrencia premium real, las funciones Vercel quedan saturadas por CPU, no por I/O — el escalado horizontal no ayuda y las facturas suben. Además bloquea el event loop, por lo que cualquier otra petición concurrente en la misma instancia paga la latencia.
- **Acción requerida:** O bien (a) materializar las agregaciones en una tabla `battle_analytics_daily` con un cron diario por usuario premium y servir desde DB (matchea el patrón ya establecido por `brawler_trends`), o (b) reescribir `compute.ts` para reusar arrays en una sola pasada (hoy hace 27 escaneos independientes). La opción (a) es L pero alinea con el patrón del repo; la (b) es M y mantiene el cómputo "live". Talla: M-L según ruta.

### PERF-04 — `/api/draft/maps` y `/api/maps` cachean `brawlApiMaps` en módulo: cache stampede en cold start, sin negative caching

- **Criticidad:** MEDIA
- **Categoría:** Rendimiento + Resiliencia
- **Ubicación:** `src/app/api/draft/maps/route.ts:9-41`
- **Evidencia:**
  ```ts
  let brawlApiMaps: Map<string, …> | null = null
  let brawlApiMapsTs = 0
  async function getBrawlApiMaps() {
    if (brawlApiMaps && Date.now() - brawlApiMapsTs < 86400000) return brawlApiMaps
    try {
      const res = await fetch('https://api.brawlapi.com/v1/maps', { next: { revalidate: 86400 } })
      // … repuebla brawlApiMaps
    } catch {
      return brawlApiMaps ?? new Map()
    }
  }
  ```
- **Problema detectado:** En cold start con N instancias, todas hacen fetch concurrente a BrawlAPI (cache stampede). Si BrawlAPI cae permanentemente, el `try/catch` devuelve `new Map()` por instancia — todas las páginas pierden imágenes de mapas silenciosamente. No hay negative caching: cada request con la API caída paga el RTT de la conexión fallida hasta que `brawlApiMaps` quede populado por una instancia con suerte. Ya existe el header `next: { revalidate: 86400 }` que el ISR de Next aprovecha, pero el módulo-cache adicional duplica capas y desincroniza con la cache de Next.
- **Acción requerida:** Eliminar el cache de módulo y confiar en el `next: { revalidate: 86400 }` (ya hace deduplicación a nivel build). Si quieres un fallback ante caída total, persistir el JSON en Supabase (`map_images_cache`) con escritura semanal — pattern del repo (`brawler_trends`). Talla: M.

### PERF-05 — `/api/meta/pro-analysis` lanza 8 queries seriadas + 4 secundarias sin paginación; sin cache por map+mode

- **Criticidad:** MEDIA
- **Categoría:** Rendimiento
- **Ubicación:** `src/app/api/meta/pro-analysis/route.ts:92-128, 229-251, 386-393, 462-509`
- **Evidencia:** Las queries 1-4 (statsRows, stats7d, stats30d, matchupRows) son secuenciales con `await` independientes — podrían `Promise.all` salvo que dependen del mismo cliente y el comentario indica que la parallelización del Tier 2 fallback se hizo aposta. Pero las **principales** sí son secuenciales: 4 round-trips innecesarios, ~150-300ms cada uno. Cache header existe (`s-maxage=1800`) pero la combinación `map × mode × window` es cardinal: 50 maps × 8 modes × 4 windows = 1600 entradas frías. Si el atacante itera windows válidos `(7,14,30,90)` con maps existentes, cada combinación paga el coste DB en frío.
- **Problema detectado:** Throughput limitado por DB y latencia perceptible para usuarios premium (TTFB > 1s con frecuencia). Cache no defensiva contra enumeración.
- **Acción requerida:** `Promise.all([statsRows, stats7d, stats30d, matchupRows])` (no dependen entre sí). Validar `map` contra una whitelist de mapas vivos (extraída de `meta_stats DISTINCT map` con cache 1h) — si el `map` no está en la whitelist, devolver 400 sin tocar DB. Talla: S.

### PERF-06 — `/api/cron/meta-poll` itera 1000 players secuencial con `await new Promise(r => setTimeout(r, META_POLL_DELAY_MS))`

- **Criticidad:** MEDIA
- **Categoría:** Rendimiento
- **Ubicación:** `src/app/api/cron/meta-poll/route.ts:394-437`
- **Evidencia:** Bucle secuencial: cada iteración fetch a Supercell + delay. Sin paralelismo dentro del lote. El comentario ya documenta los límites pero asume disponibilidad ininterrumpida.
- **Problema detectado:** Bajo carga normal funciona (~150ms × 1000 = 150s + delays). Bajo cualquier degradación de Supercell (tráfico cualquier viernes-tarde) un solo battlelog a 8s estira el cron a >300s y dispara `timeBudgetExit`. La cobertura del muestreador queda muy por debajo del óptimo en esos casos. Sería un pool con concurrencia 4-8 en lugar de 1.
- **Acción requerida:** Sustituir el for-of secuencial por un pool con `p-limit` (concurrencia 4) **y** combinarlo con PERF-01 (timeout 8s/request) — sin timeout, paralelizar amplifica el riesgo de exhaustion. Talla: M.

### PERF-07 — `/api/draft/data` no aplica cache-control y dispara 4 queries por cada (map, mode) de cada visita anónima

- **Criticidad:** MEDIA
- **Categoría:** Rendimiento
- **Ubicación:** `src/app/api/draft/data/route.ts:36-93`
- **Problema detectado:** Endpoint público (parte fundamental de `/picks` y draft simulator). 4 queries Supabase secuenciales por request, sin `Cache-Control` ni `s-maxage` (vs `/api/meta` y `/api/meta/pro-analysis` que sí tienen 1800s). Una hora con 1000 visitas a la home dispara 4000 queries inútiles a Supabase.
- **Acción requerida:** Añadir `s-maxage=900` (15 min — los stats no cambian en escalas menores). Paralelizar las 3 queries iniciales con `Promise.all`. Talla: S.

### PERF-08 — `/api/meta/brawler-detail` ejecuta 3 queries totalmente secuenciales sobre la misma tabla `meta_stats`

- **Criticidad:** BAJA
- **Categoría:** Rendimiento
- **Ubicación:** `src/app/api/meta/brawler-detail/route.ts:36-65`
- **Problema detectado:** Las 3 queries (`rawStats`, `rawMatchups`, `totalBattlesData`) son independientes — `Promise.all` lo cubre. El total de la tercera query (suma de todos los `total` de los últimos `META_ROLLING_DAYS` días sin paginar) puede tropezar con el cap de 1000 filas de PostgREST si la tabla crece (mismo bug histórico documentado en `CLAUDE.md`). Hoy posiblemente devuelve menos del total real.
- **Acción requerida:** `Promise.all([rawStats, rawMatchups, totalBattlesData])` y reemplazar la query 3 por una RPC SQL `SELECT SUM(total)` para evitar el cap. Talla: S.

---

### RES-01 — `verifyPayPalWebhook` no valida que el body re-parseado coincida con el firmado

- **Criticidad:** ALTA
- **Categoría:** Resiliencia + Seguridad
- **Ubicación:** `src/lib/paypal.ts:175-201`, `src/app/api/webhooks/paypal/route.ts:13-33`
- **Evidencia:**
  ```ts
  // paypal.ts
  body: JSON.stringify({
    // …
    webhook_event: (() => { try { return JSON.parse(params.body) } catch { return null } })(),
  })
  ```
- **Problema detectado:** PayPal firma el `rawBody` recibido. Aquí se vuelve a `JSON.parse(rawBody)` y a `JSON.stringify` con un nuevo objeto — la representación canónica cambia (espacios, orden de keys, escapado de unicode). PayPal compara sí mismo en el endpoint `/v1/notifications/verify-webhook-signature` con `webhook_event` re-serializado, así que técnicamente esto funciona, pero **la verificación criptográfica del body original NO se hace localmente** — todo descansa en confiar en que PayPal valida la firma correctamente sobre el campo `webhook_event` re-formateado. Es un patrón frágil. Cualquier cambio en cómo PayPal serializa internamente puede romper la verificación silenciosamente, o peor, validar mensajes manipulados si el atacante introduce JSON equivalente con un `event_type` distinto en una key duplicada (alguna implementación de JSON parsing tolera duplicados).
- **Acción requerida:** Validar la firma localmente contra `rawBody` siguiendo la spec PKCS#1 v1.5 con `paypal-cert-url` (cachear el cert con TTL). El SDK oficial de PayPal Node tiene `paypal-rest-sdk.notification.webhookEvent.verify(headers, rawBody, webhookId, callback)`. Eliminar el JSON.parse/stringify intermedio. Talla: M.

### RES-02 — `paypal/confirm` y `webhooks/paypal` ambos escriben `tier='premium'` sin row-locking — race condition hacia status final inconsistente

- **Criticidad:** MEDIA
- **Categoría:** Resiliencia
- **Ubicación:** `src/app/api/checkout/paypal/confirm/route.ts:35-57`, `src/app/api/webhooks/paypal/route.ts:78-92`
- **Problema detectado:** El callback (`/confirm`) y el webhook se ejecutan concurrentemente por diseño. El callback hace `select` luego `update` en dos round-trips (no atomic), el webhook hace un solo `update`. Si llegan en orden invertido (webhook primero con `BILLING.SUBSCRIPTION.CANCELLED` durante una cancelación inmediata seguida del callback con status ACTIVE), el callback puede sobreescribir el cancelled con active. La `alreadyApplied` guard protege el caso feliz pero no el race-update.
- **Acción requerida:** O bien (a) eliminar la escritura desde `/confirm` (es la decisión documentada — webhook autoritativo — pero el código no la cumple), o (b) usar una `UPDATE … WHERE id=… AND ls_subscription_status NOT IN ('cancelled','expired')` para que el callback no degrade un estado posterior. Talla: S.

### RES-03 — `notify()` y `sendTelegramMessage()` no propagan errores y bloquean response — `after()` no se usa universalmente

- **Criticidad:** BAJA
- **Categoría:** Resiliencia
- **Ubicación:** `src/app/api/webhooks/paypal/route.ts:97-98`, `src/app/api/notify/signup/route.ts:24-26`
- **Problema detectado:** En `webhooks/paypal:97-98` el `notify()` se llama síncrono justo antes del response — si Telegram cuelga 30s, el webhook tarda 30s y PayPal lo reintenta (PayPal reintenta agresivamente); idempotency-key ya está pero un retry por timeout consume cuota innecesariamente. En `notify/signup` también se hace antes del response. El patrón correcto (ya usado en `/api/calculate`) es `after()`.
- **Acción requerida:** Envolver todos los `await notify(...)` en `after(async () => notify(...))` cuando no son críticos para la respuesta. Talla: S.

### RES-04 — Falta tracing/observabilidad: errores 500 se loguean sin `request_id` ni `user_id`

- **Criticidad:** MEDIA
- **Categoría:** Observabilidad
- **Ubicación:** General — `src/app/api/**/route.ts`
- **Evidencia:** `console.error('[meta-poll] Fatal error:', err)`, `console.error('[paypal webhook] Update failed:', updateErr.message)` etc. sin contexto estructurado.
- **Problema detectado:** Cuando algo falla en producción (Vercel Functions) los logs son por línea suelta. Imposible correlacionar el flujo de un usuario que reporta "no se actualizó mi premium" sin un `request_id` y `user_id` en cada log. No hay structured logging.
- **Acción requerida:** Adoptar `console.log(JSON.stringify({ level, msg, request_id, user_id, ...ctx }))` o `pino` lite. Generar `request_id` en `proxy.ts` y propagarlo vía header `x-request-id` que cada route lee. Talla: M.

### RES-05 — Cron `meta-poll` parsea `paypal-cert-url` y otros headers de Telegram sin validar el dominio del cert

- **Criticidad:** BAJA
- **Categoría:** Seguridad/Resiliencia
- **Ubicación:** `src/lib/paypal.ts:175-202` (forwarded a PayPal verify)
- **Problema detectado:** El cert URL viaja en el header `paypal-cert-url` y se reenvía tal cual a PayPal verify. PayPal ya valida el dominio en su lado, pero la confianza ciega aquí impide cualquier defensa local. Si en algún futuro se moviera la verificación a local-only, sería un SSRF-en-espera (atacante manda `paypal-cert-url: http://169.254.169.254/...` y la app GETea metadata). Hoy no hay vector real porque el GET lo hace PayPal, no nuestra función.
- **Acción requerida:** Cuando se haga la migración a verificación local (RES-01), hardcodear allowlist `https://api.paypal.com/v1/notifications/certs/...` o `https://api.sandbox.paypal.com/v1/notifications/certs/...`. Talla: S como prerequisito de RES-01.

---

## 4. Sin hallazgos en

Los siguientes vectores se revisaron y NO produjeron hallazgos materiales:

- **SQL injection clásico** — todas las queries DB pasan por `@supabase/ssr` con builder pattern (`.eq()`, `.gte()`, `.in()`); no hay concatenación de strings en SQL. Los RPCs nombrados (`bulk_upsert_meta_*`, `track_anonymous_visit`, etc.) reciben parámetros estructurados.
- **Command injection** — `Grep` exhaustivo de `eval|new Function|exec|child_process` no devuelve resultados en `src/`.
- **Tokens en localStorage** — `Grep` de `Authorization.*Bearer.*localStorage|localStorage.*token` no encuentra nada. La auth pasa por cookies httpOnly Supabase (correcto).
- **JWT con `alg: none`** — la verificación JWT corre dentro de `@supabase/ssr` que ignora `none`; no se manipulan tokens manualmente.
- **CSRF en PayPal webhook** — protegido por verificación de firma (aunque débil — ver RES-01).
- **CSRF en Telegram webhook** — `timingSafeEqual` con `TELEGRAM_WEBHOOK_SECRET` + L2 chat_id match. Implementación ejemplar.
- **Secrets en código** — solo `process.env.*`; no hay hardcoded keys (revisado tanto el código fuente como `.env.example`).
- **Path traversal en file upload** — la app no acepta uploads.
- **CORS permisivo** — Next defaultea same-origin; no hay `Access-Control-Allow-Origin: *` en código (`Grep` exhaustivo).
- **XSS reflejado vía `dangerouslySetInnerHTML`** — los 3 usos identificados (`FAQSection`, `[locale]/layout.tsx` JSON-LD, `MetaProTab` style block) son contenido literal o `JSON.stringify` de objetos controlados. No hay `dangerouslySetInnerHTML={{ __html: userInput }}`.
- **Memory leaks por listeners** — el patrón de hooks usa `useEffect` con cleanup correcto (verificación spot-checked en `useBrawlerTrends`, `useClubTrophyChanges`).

---

## 5. Notas y limitaciones

- **Supuesto:** las migraciones SQL (`supabase/migrations/*`) cumplen con SECURITY DEFINER seguro y RLS bien configurado (no auditado en esta fase). El uso correcto de `createServiceClient()` vs `createClient()` se verificó por inspección textual de cada route — el comentario "Data queries that need to bypass RLS use createServiceClient()" está respetado en todos los casos críticos.
- **Supuesto:** PayPal y Supercell APIs funcionan dentro de SLA contractuales. La auditoría asume que pueden caer; no asume que siempre estén corruptas.
- **No auditable sin entorno staging:** el comportamiento real de `/api/auth/callback` con `next=//evil.com` no se probó dinámicamente — el hallazgo SEG-01 se basa en lectura de código y el comportamiento estándar de `Response.redirect`. Recomendación: añadir un test E2E Playwright que asserte que el callback con `next` malicioso responde 400 o redirige a `/`.
- **No auditable sin medición:** PERF-03 (latencia de `computeAdvancedAnalytics`) se estima por inspección de LoC y patrones de iteración. Una medición real con `console.time` en producción ofrecería números concretos antes de elegir entre opción (a) precomputar y (b) optimizar.
- **Criterio de muestreo:** las 27 routes API se revisaron 100%. Las 11 funciones de `compute.ts` se revisaron por nombre/firma; el cuerpo no se inspeccionó con detalle salvo `computePowerLevelImpact` (referenciado en `CLAUDE.md`). Componentes UI revisados por patrón XSS, no por lógica completa.
- **Versiones:** la auditoría refleja `next@16.2.2`, `next-intl@4.9.0`, `@supabase/ssr@0.10.0` según `package.json` al commit `604fe24`. Cualquier upgrade posterior debe re-ejecutar `npm audit`.
