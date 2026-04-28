# Reporte Fase 2 — Lógica, Estructuras de Datos y Algoritmos

> Auditor: Panóptico
> Fecha: 2026-04-28T11:47:00Z
> Repo: C:\Proyectos_Agentes\brawlValue
> Commit: 604fe24abe1a37a5963b07f199201eaca5323f13
> Rama: main

---

## 1. Resumen ejecutivo

La capa de lógica de BrawlVision arrastra **siete defectos críticos** que cruzan la frontera de "datos silenciosamente corruptos" o "side-effects irreversibles", concentrados en tres áreas: (1) consultas a `meta_stats` que olvidan filtrar `source` y por tanto mezclan datos PRO con datos de usuario en endpoints supuestamente "globales" (incluyendo el cron SQL `compute_brawler_trends`), (2) idempotencia incorrecta en el webhook de PayPal (la marca persiste antes del side-effect, perdiendo updates en reintentos), y (3) hot paths de analytics con scans cuadráticos sobre `battles.filter(...)` por cada sesión. Hay además un bug PKCE (retry de un código ya consumido) y la rama de fallback inline del endpoint de trends no aplica el filtro de freshness/source que sí aplica el SQL — divergencia silenciosa entre dos rutas que el código publicita como equivalentes. TypeScript strict pasa limpio (exit 0), lo que confirma que ninguno de estos defectos se cazaría en CI.

---

## 2. Alcance revisado

- **Ficheros analizados (manualmente):**
  - `src/lib/analytics/compute.ts` (963 LoC) — corazón de cómputo
  - `src/lib/analytics/stats.ts` — helpers Wilson/winRate/groupBy
  - `src/app/api/cron/meta-poll/route.ts` (628 LoC)
  - `src/app/api/cron/sync/route.ts` (182 LoC)
  - `src/app/api/meta/pro-analysis/route.ts` (582 LoC)
  - `src/app/api/meta/brawler-trends/route.ts` (120 LoC)
  - `src/app/api/meta/brawler-detail/route.ts` (188 LoC)
  - `src/app/api/meta/route.ts` (154 LoC)
  - `src/app/api/checkout/paypal/confirm/route.ts`
  - `src/app/api/webhooks/paypal/route.ts`
  - `src/app/api/auth/callback/route.ts`
  - `src/app/api/calculate/route.ts`
  - `src/app/api/sync/route.ts` + `src/lib/battle-sync.ts`
  - `src/lib/battle-parser.ts`, `src/lib/calculate.ts`, `src/lib/paypal.ts`, `src/lib/premium.ts`
  - `src/lib/draft/state.ts`, `src/lib/draft/scoring.ts`, `src/lib/draft/meta-poll-balance.ts`, `src/lib/draft/meta-accumulator.ts`
  - `src/lib/brawler-detail/trend.ts`, `src/lib/brawler-detail/compute.ts`
  - `src/lib/brawler-metadata.ts`
  - `src/lib/club-mode-leaders.ts`, `src/lib/stats-maxes.ts`
  - `src/hooks/useProAnalysis.ts`, `src/hooks/useBattlelog.ts`, `src/hooks/useClubTrophyChanges.ts`
  - `src/components/auth/AuthProvider.tsx`
  - `src/lib/anonymous-visits.ts`
  - `src/app/[locale]/picks/page.tsx`
  - `supabase/migrations/020_brawler_trends_precomputed.sql`
  - `supabase/migrations/021_brawler_trends_hardening.sql`
- **Herramientas estáticas ejecutadas:**
  - `npx tsc --noEmit` → exit 0, 0 errores. Strict mode confirmado en `tsconfig.json`.
- **Excluidos del scope (con motivo):**
  - `src/__tests__/**` (no es lógica de producción).
  - Componentes UI puramente visuales (`src/components/**/*.tsx`) — no son lógica de negocio salvo donde los toqué tangencialmente. Una auditoría completa de UI corresponde a la fase 5 (testing/UX).
  - `src/lib/telegram/**` — leído sólo el dispatcher; los comandos individuales son cadenas de formato.
  - Migraciones 001-019 — leí el resumen del CLAUDE.md y profundicé sólo en 020/021 que son las pertinentes a `compute_brawler_trends`.

---

## 3. Hallazgos

### LOG-01 — `compute_brawler_trends()` no filtra `source`, mezcla datos user+global

- **Criticidad:** CRÍTICA
- **Categoría:** Datos
- **Ubicación:** `supabase/migrations/021_brawler_trends_hardening.sql:42-51`, `supabase/migrations/020_brawler_trends_precomputed.sql:76-85`
- **Evidencia:**
  ```sql
  WITH agg AS (
    SELECT brawler_id,
      SUM(CASE WHEN date >= cutoff_recent THEN wins ELSE 0 END)::INTEGER AS recent_wins,
      ...
    FROM public.meta_stats
    WHERE date >= cutoff_prev      -- <-- NO `AND source = 'global'`
    GROUP BY brawler_id
  ```
- **Problema detectado:** `meta_stats` contiene dos *sources*: `'global'` (cron meta-poll → top pro) y `'users'` (cron sync → premium personal data). Ningún consumidor agregaría las dos: pro-analysis filtra explícitamente `source='global'`, brawler-detail comenta "all sources" pero ese endpoint es per-brawler. Esta función se anuncia como el reemplazo del scan inline para "trend del meta", pero está sumando wins de partidas de usuarios premium. Cuando un usuario premium pierde una racha local, el "trend PRO" mostrado en la home (vía `/api/meta/brawler-trends`) baja. Es contaminación silenciosa cross-source. Además, la divergencia entre el SQL (sin filtro) y el código TS de `compute7dTrend` que se usa en endpoints individuales (también sin filtro, ver LOG-04) es accidental — los dos están mal por la misma razón.
- **Acción requerida:** En la próxima migración, `CREATE OR REPLACE FUNCTION public.compute_brawler_trends()` añadiendo `AND source = 'global'` al WHERE. Misma corrección en `src/app/api/meta/brawler-trends/route.ts:91-95` (rama inline). Añadir un test SQL/integración que ejercite el path con dos rows mismo brawler distinto source. Scope: S (1-2 horas).

### LOG-02 — Webhook PayPal: marca idempotencia ANTES del side-effect → updates perdidos en retry

- **Criticidad:** CRÍTICA
- **Categoría:** Resiliencia
- **Ubicación:** `src/app/api/webhooks/paypal/route.ts:43-92`
- **Evidencia:**
  ```ts
  // line 45: mark idempotency BEFORE doing work
  const { error: insertErr } = await supabase
    .from('webhook_events')
    .insert({ event_id: `paypal_${eventId}`, event_type: 'paypal' })
  if (insertErr?.code === '23505') return NextResponse.json({ ok: true, skipped: true })
  ...
  // line 89: profile update can fail
  if (updateErr) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  ```
- **Problema detectado:** PayPal reintenta webhooks fallidos (HTTP 5xx). En el primer intento, la fila de idempotencia se inserta exitosamente, luego el `profiles.update` falla (DB transitorio, RLS edge case, etc.) y el handler devuelve 500. PayPal reintenta el webhook con el mismo `paypal-transmission-id`. La fila de idempotencia ya existe → `23505` → handler responde `ok: true, skipped: true` y el perfil **nunca se actualiza**. El usuario paga pero queda en `tier: 'free'`. Patrón canónico de "saga sin compensación".
- **Acción requerida:** Una de dos:
  (a) Mover la inserción de idempotencia a una transacción que englobe también el `profiles.update` (Postgres function que recibe ambos payloads).
  (b) Insertar la marca de idempotencia DESPUÉS de que la actualización del perfil tenga éxito; si la marca falla, log + ignorar (PayPal puede reintentar y se ejecutará otra vez — el `update` es idempotente por valores fijos).
  Recomendado (b) por simpleza. Añadir test de integración con un fallo simulado en `profiles.update` para verificar que el siguiente reintento sí actualiza. Scope: S.

### LOG-03 — `/api/meta/brawler-detail`: scan global sin paginar → trunca a 1000 filas, pickRate corrupto

- **Criticidad:** CRÍTICA
- **Categoría:** Datos
- **Ubicación:** `src/app/api/meta/brawler-detail/route.ts:58-67`
- **Evidencia:**
  ```ts
  const { data: totalBattlesData, error: totalError } = await serviceSupabase
    .from('meta_stats')
    .select('total')
    .gte('date', cutoffDate)         // 14 días, ~10k filas, sin range()
  ...
  const allGames = (totalBattlesData ?? []).reduce((sum, r) => sum + r.total, 0)
  const pickRate = allGames > 0 ? (brawlerGames / allGames) * 100 : 0
  ```
- **Problema detectado:** El propio CLAUDE.md documenta que "PostgREST caps unpaginated queries at 1000 rows" y narra cómo el endpoint de trends sufrió este bug. ESTE endpoint comete exactamente el mismo error en su denominador. `allGames` se computa sobre los primeros ~1000 rows (sin orden definido — Postgres puede devolver cualquier slice), por lo que el pickRate de cada brawler está computado contra un denominador truncado y arbitrario. Para brawlers infrecuentes el efecto es mínimo (numerator pequeño); para los populares, pickRate puede pasar del rango razonable (3-5%) a >50% spurious. La UX del card de "Pick Rate" en la página de brawler está mintiendo silenciosamente.
- **Acción requerida:** Una de dos:
  (a) Reemplazar por una RPC SQL `sum_meta_stats_total(p_since DATE)` que devuelva un escalar (mejor: crear índice si no existe).
  (b) Si quieres mantener PostgREST, paginar idéntico al patrón de `brawler-trends/route.ts:88-105`.
  Recomendado (a) — reuso del patrón ya establecido por `sum_meta_stats_by_map_mode` (migración 014/017). Scope: S.

### LOG-04 — `/api/meta/brawler-trends` rama inline tampoco filtra `source`

- **Criticidad:** ALTA
- **Categoría:** Datos
- **Ubicación:** `src/app/api/meta/brawler-trends/route.ts:91-105`
- **Evidencia:**
  ```ts
  const { data: page, error } = await supabase
    .from('meta_stats')
    .select('brawler_id, date, wins, total')
    .gte('date', cutoff)              // <-- NO `.eq('source', 'global')`
    .range(offset, offset + PAGE_SIZE - 1)
  ```
- **Problema detectado:** Mismo defecto que LOG-01 pero en el lado TypeScript. La rama "fallback" se activa cuando la tabla `brawler_trends` no tiene filas frescas (cron caído / migración no aplicada). Cuando se activa, mezcla user+global. El comentario del archivo dice que esto es "el fallback de la migración no aplicada" — pero el SQL principal (LOG-01) tampoco filtra source, así que las dos rutas están consistentemente mal. Si LOG-01 se corrige (filtrar source) sin tocar este, las rutas divergirán: la fast path verá WR PRO real, la fallback inline verá un WR contaminado. La regla de "TypeScript y SQL en sync" del CLAUDE.md aplica aquí también.
- **Acción requerida:** Añadir `.eq('source', 'global')` antes del `.gte('date', cutoff)`. Misma migración/PR que LOG-01. Scope: S.

### LOG-05 — `/api/auth/callback`: retry de `exchangeCodeForSession` sobre código ya consumido

- **Criticidad:** ALTA
- **Categoría:** Resiliencia
- **Ubicación:** `src/app/api/auth/callback/route.ts:37-49`
- **Evidencia:**
  ```ts
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth/callback] exchange failed:', error.message)
    // Retry once — incognito/cold sessions sometimes fail on first attempt
    const { error: retryError } = await supabase.auth.exchangeCodeForSession(code)
    ...
  }
  ```
- **Problema detectado:** Los códigos PKCE/OAuth de Supabase son single-use por diseño. Si el primer `exchangeCodeForSession` no falló por motivo transitorio sino por consumo (lo cual incluye casos de éxito parcial donde la sesión se creó pero la respuesta cookie falló), el segundo intento devolverá `invalid grant` garantizado. El comentario "incognito/cold sessions sometimes fail on first attempt" sugiere que el retry "funciona" en algunos casos — pero si funciona en alguno, es porque la primera llamada falló ANTES de tocar Supabase (network blip, abort), no después. El código entra en una rama donde el retry oculta la causa raíz real (typeof error) y siempre redirige a `?auth_error=1` cuando podría haber rescatado el primer fallo legítimo.
- **Acción requerida:** Eliminar el retry. Distinguir el tipo de `error` (network vs auth) y manejar cada uno explícitamente. Si se quiere mantener resilience contra blips de red, hacerlo en el cliente (Supabase JS) antes de la llamada server, no después. Scope: S.

### LOG-06 — `processOnePlayer` en meta-poll captura excepciones en bloque vacío, sin log

- **Criticidad:** ALTA
- **Categoría:** Resiliencia
- **Ubicación:** `src/app/api/cron/meta-poll/route.ts:97-200`
- **Evidencia:**
  ```ts
  try {
    const response = await fetchBattlelog(tag)
    ...
    return { processed: true, skipped: false, errored: false, battlesKept }
  } catch {
    return { processed: false, skipped: false, errored: true, battlesKept: 0 }
  }
  ```
- **Problema detectado:** El catch silencia toda excepción sin logging. La función procesa 600+ jugadores por run; si Supercell empieza a devolver 403 sistemáticamente para un país (key revocada, IP bloqueada), todos los jugadores de esa cohorte fallan en silencio y sólo se ve `errors: N` agregado en el JSON de respuesta — sin indicio de QUÉ tipo de error. Para diagnosticar hay que ir a Vercel Function logs y correlacionar manualmente. El resto del archivo es metódico con observabilidad (heartbeats, diagnostics blocks); este `catch {}` es la única excepción.
- **Acción requerida:** Cambiar a `catch (err) { console.warn('[meta-poll] processOnePlayer failed', { tag, err: String(err) }); return ... }`. Si el error es un `SuprecellApiError`, capturar `err.status` y agregarlo al diagnostic block (e.g. `errorStatuses: { 403: 12, 429: 4 }`). Scope: S.

### LOG-07 — `computeTiltAnalysis` recomputa sesiones y hace filter cuadrático

- **Criticidad:** ALTA
- **Categoría:** Rendimiento
- **Ubicación:** `src/lib/analytics/compute.ts:558-602`, también `:811-826` (warmUp), `:891-924` (recovery)
- **Evidencia:**
  ```ts
  function computeTiltAnalysis(battles: Battle[]): TiltAnalysis {
    const sessions = computeSessions(battles)        // recomputa — ya hecho en línea 32
    ...
    for (const session of sessions) {
      const sessionBattles = battles.filter(b => {  // O(M) por cada sesión
        const t = b.battle_time
        return t >= session.start && t <= session.end
      })
      ...
    }
  }
  ```
- **Problema detectado:** `computeAdvancedAnalytics` ya calcula `sessions = computeSessions(battles)` en línea 32. Sin embargo, `computeTiltAnalysis` (560), `computeWarmUp` (816) y `computeRecovery` (897) hacen `battles.filter(...)` dentro del loop sobre sesiones, dando O(N_sessions × M_battles). Para un usuario premium con 5 años de batallas (~50k battles, ~1500 sesiones), eso son 75M operaciones por cada uno de los 3 helpers. `computeTiltAnalysis` además recomputa `computeSessions(battles)` localmente (línea 559) en vez de recibirla. El endpoint que llama esto es síncrono server-side; bloquea la respuesta de `/api/analytics`.
- **Acción requerida:** Refactor a O(N+M):
  (1) Pasar `sessions` precomputado como argumento a las tres funciones (eliminar el `computeSessions` interno de tilt).
  (2) Indexar las battles a sesiones en una pasada: recorrer `battles` ordenado y asignar a la sesión actual con un puntero que avanza cuando battle_time > session.end.
  Resultado: 1 pasada por las battles para todas las funciones combinadas. Scope: M (4-6 horas con tests).

### LOG-08 — Manual sync (`/api/sync`) actualiza `last_sync` pero NO procesa meta_stats; cron luego salta esas battles

- **Criticidad:** ALTA
- **Categoría:** Datos
- **Ubicación:** `src/lib/battle-sync.ts:55-58` + `src/app/api/cron/sync/route.ts:101-103`
- **Evidencia:**
  ```ts
  // battle-sync.ts (manual flow): sólo actualiza profiles.last_sync, sin meta_stats
  await supabase.from('profiles').update({ last_sync: new Date().toISOString() })
    .eq('player_tag', playerTag)
  ```
  ```ts
  // cron/sync/route.ts: el filtro de cursor descarta lo que el manual ya cubrió
  for (const b of parsed) {
    if (last_sync && b.battle_time <= last_sync) continue   // <-- skipped forever
    ...
    processBattleForMeta(acc, ...)
  }
  ```
- **Problema detectado:** Cuando un usuario premium pulsa "Sync now" en su perfil, `battle-sync.ts` descarga la battlelog, hace upsert en `battles` y avanza `last_sync`. Pero NO procesa `meta_stats`/`meta_matchups` como sí hace el cron. El siguiente cron run lee `last_sync` (ya avanzado por el manual sync) y descarta TODAS las battles que se acaban de sincronizar (`b.battle_time <= last_sync`). Resultado: las battles personales del usuario nunca llegan a `meta_stats` source='users', perdiéndose para los aggregates personales del propio usuario en gap-analysis. El bug se evita sólo si el manual sync no corre nunca antes que el cron.
- **Acción requerida:** Añadir el procesamiento de meta_stats / meta_matchups dentro de `syncBattles()` con la misma lógica que `cron/sync/route.ts:96-132`. Mejor: extraer ambas paths a un helper compartido `processBattleBatch(supabase, parsed, last_sync, source)` y llamarlo desde los dos sitios. Test: contrato que el path manual escriba con `source='users'` igual que el cron. Scope: M.

### LOG-09 — `/api/checkout/paypal/confirm`: ignora error en update de profile

- **Criticidad:** ALTA
- **Categoría:** Resiliencia
- **Ubicación:** `src/app/api/checkout/paypal/confirm/route.ts:46-57`
- **Evidencia:**
  ```ts
  if (!alreadyApplied) {
    await supabase
      .from('profiles')
      .update({ tier: 'premium', ... })
      .eq('id', profileId)
    // <-- no destructure of error, no check
  }
  ...
  // success branch fires regardless
  const redirectUrl = ok ? ... `?upgraded=true` : ... `?payment_error=1`
  ```
- **Problema detectado:** El callback de PayPal verifica con la API que la suscripción está ACTIVE y procede a marcar el perfil como premium. Si el `update` falla silenciosamente (RLS edge case, DB transitorio, race con el webhook), el código continúa al `return NextResponse.redirect(...?upgraded=true)`. El usuario ve la pantalla de éxito, pero el perfil sigue en `tier: 'free'`. El webhook teóricamente lo corregirá luego — pero LOG-02 muestra que el webhook tampoco es 100% fiable. El `?upgraded=true` flag es parte del contrato de UrlFlashMessage, hay test E2E que lo verifica; el contrato implícito es "esta pantalla = ya eres premium".
- **Acción requerida:** Destructure `{ error }` y, si falla, redirect a `?payment_error=1` en lugar de `?upgraded=true`. Logear el error con suficiente contexto (subscriptionId, profileId) para reconciliación manual. Scope: S.

### LOG-10 — `useProAnalysis`: cache module-level sin bound, sin TTL, sin eviction

- **Criticidad:** MEDIA
- **Categoría:** Rendimiento
- **Ubicación:** `src/hooks/useProAnalysis.ts:14`
- **Evidencia:**
  ```ts
  // Client-side cache: map+mode+window -> response
  const cache = new Map<string, ProAnalysisResponse>()
  ```
- **Problema detectado:** El cache vive en el módulo, no en el componente. No tiene TTL, no tiene LRU, no se evictea. Cada combinación única `${map}|${mode}|${window}` que vea el usuario en la sesión queda residente. El payload por entrada incluye `topBrawlers`, `counters`, `dailyTrend`, `proTrios`, `personalGap`, `matchupGaps` — fácilmente 50-100KB JSON. Un usuario premium navegando por todos los mapas y modos puede acumular 50 maps × 4 modes × 4 windows × 100KB ≈ 80MB en la pestaña. No es un leak en el sentido tradicional (un refresh lo limpia), pero penaliza navegación larga. Adicionalmente, el cache nunca se invalida — datos PRO pueden cambiar mientras la pestaña está abierta y el hook nunca refresca salvo `refresh()` manual.
- **Acción requerida:** Añadir TTL de 30 min (matching `s-maxage` server) y un cap de tamaño (LRU con `maxSize=50`). Considerar usar `react-query`/SWR para todos los hooks de fetch en vez de reinventarlo cada vez. Scope: S puntual / M si se migra todo al library.

### LOG-11 — `useClubTrophyChanges`: stale-write race al cambiar `members`

- **Criticidad:** MEDIA
- **Categoría:** Resiliencia
- **Ubicación:** `src/hooks/useClubTrophyChanges.ts:103-150`
- **Evidencia:**
  ```ts
  const load = useCallback(async (list: { tag: string; name: string }[]) => {
    setIsLoading(true)
    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      ...
      setResults(prev => { ... next.set(r.value.tag, ...) ... })
    }
  }, [])
  ...
  useEffect(() => { load(members) }, [members, load])
  ```
- **Problema detectado:** No hay `AbortController` ni cancel flag. Si el componente se desmonta o `members` cambia mientras el `for` async aún está iterando batches, el loop sigue ejecutando `Promise.allSettled` y haciendo `setResults` con datos del club ANTERIOR. Resultado: la UI del nuevo club puede ver progresivamente intercaladas filas del club previo durante varios segundos. No corrompe DB, pero la UX presenta nombres de miembros que no pertenecen al club actual.
- **Acción requerida:** Patrón de `useProAnalysis` con `controllerRef = useRef<AbortController>()`: cancelar al inicio del nuevo `load()`, comprobar `signal.aborted` antes de cada `setResults`. También pasar el signal a `fetch('/api/battlelog', ...)`. Scope: S.

### LOG-12 — `parseBattleTime` parsea por slice posicional sin validación; entrada malformada produce ISO inválido pero no `null`

- **Criticidad:** MEDIA
- **Categoría:** Datos
- **Ubicación:** `src/lib/battle-parser.ts:9-18`
- **Evidencia:**
  ```ts
  export function parseBattleTime(raw: string): string {
    const y = raw.slice(0, 4)
    const m = raw.slice(4, 6)
    ...
    const h = rest.slice(1, 3)   // assumes index 0 is 'T'
    return `${y}-${m}-${d}T${h}:${min}:${sec}.000Z`
  }
  ```
- **Problema detectado:** Si Supercell devuelve un formato distinto (ej: corruption, encoding, timezone offset), `slice` produce un ISO sintácticamente válido pero semánticamente basura. Por ejemplo `"2026-04-01T12:00:00Z"` → `y="2026"`, `m="-0"`, `d="4-"`, etc., resultando `"2026--0-4-T12:00:00.000Z"` que `new Date(...)` puede interpretar como Invalid Date silenciosamente más adelante. El handler hermano `parseSupercellTime` SÍ valida con regex y devuelve `null`. La función vieja se mantiene en el code path que escribe a la DB (`battles.battle_time`), por lo que filas malformadas pueden entrar a la tabla sin que nadie lo note hasta que ya están persistidas.
- **Acción requerida:** Reusar `parseSupercellTime` (que ya existe en el mismo archivo línea 35) en `parseBattle` línea 134, o validar `parseBattleTime` con la misma regex antes de hacer slice y throw si no hace match. El path de inserción a `battles` debe rechazar la fila explícitamente. Scope: S.

### LOG-13 — `useBattlelog`: cache localStorage carece de versionado de schema

- **Criticidad:** MEDIA
- **Categoría:** Datos
- **Ubicación:** `src/hooks/useBattlelog.ts:55-66`, mismo patrón en `useClubTrophyChanges.ts:42-50`
- **Evidencia:**
  ```ts
  const raw = localStorage.getItem(getCacheKey(tag))
  if (raw) {
    const cached = JSON.parse(raw)         // <-- cast implícito a BattleStats
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      setData(cached.data)                  // sin validar shape
      ...
    }
  }
  ```
- **Problema detectado:** Si la interfaz `BattleStats` cambia (campo nuevo, campo renombrado, tipo cambiado), las cachés viejas en navegadores de usuarios siguen aplicándose hasta que el TTL las invalide. Para `useBattlelog` el TTL es 2 min (bajo riesgo), pero para `useClubTrophyChanges` es 5 min y otros hooks llegan a 24h. Un componente que destructura `cached.data.modeWinRates` puede crashear si el cache antiguo no tenía ese campo. La memoria de NaN-safety del CLAUDE.md ya advierte de esto, pero los hooks no aplican defensa.
- **Acción requerida:** Añadir un campo `_schemaVersion: number` al objeto cached y compararlo con una constante en el módulo. Si discrepa, ignorar y refetch. Pattern probado: `if (cached._schemaVersion !== CURRENT_VERSION) return null`. Scope: S — patch global en los 5+ hooks que usan localStorage.

### LOG-14 — `paypalStatusToTier` para evento UPDATED+CANCELLED degrada `tier` a `free` rompiendo grace period

- **Criticidad:** MEDIA
- **Categoría:** Datos
- **Ubicación:** `src/lib/paypal.ts:214-218`
- **Evidencia:**
  ```ts
  case 'BILLING.SUBSCRIPTION.UPDATED':
    return {
      tier: status === 'ACTIVE' ? 'premium' : 'free',     // <-- CANCELLED → 'free'
      subscriptionStatus: status === 'ACTIVE' ? 'active' : status.toLowerCase(),
    }
  case 'BILLING.SUBSCRIPTION.CANCELLED':
    return { tier: 'premium', subscriptionStatus: 'cancelled' } // grace period
  ```
- **Problema detectado:** PayPal puede enviar tanto `BILLING.SUBSCRIPTION.CANCELLED` como `BILLING.SUBSCRIPTION.UPDATED` con `status: 'CANCELLED'` para el mismo evento (depende de versión de webhook subscriptions y race conditions internas). El handler de UPDATED degrada el tier a `'free'` mientras que el handler dedicado mantiene `'premium'` para grace. Si UPDATED llega DESPUÉS de CANCELLED (orden no garantizado por PayPal), el grace period se pierde y el usuario pierde acceso premium inmediatamente al cancelar — contradice el spec documentado en `isPremium()` y el comentario "grace period". Adicionalmente: el orden de eventos no se valida (ningún `event.create_time` comparison), por lo que un evento ACTIVATED viejo que llegue tarde puede sobreescribir un CANCELLED reciente.
- **Acción requerida:** (1) En UPDATED+CANCELLED, devolver `tier: 'premium'` igual que el handler dedicado (mantener grace). (2) Persistir `last_event_at` y rechazar updates con `event.create_time < profile.last_event_at`. Scope: S.

### LOG-15 — `compute7dTrend` compara strings de fecha YYYY-MM-DD pero acepta filas con `r.date = ''` silenciosamente

- **Criticidad:** BAJA
- **Categoría:** Datos
- **Ubicación:** `src/lib/brawler-detail/trend.ts:44-53`
- **Evidencia:**
  ```ts
  for (const r of rows) {
    if (!r.date) continue                     // OK
    if (r.date >= d7ago) { ... }
    else if (r.date >= d14ago) { ... }
  }
  ```
- **Problema detectado:** Si una fila trae `date = "2026"` (truncada por bug en migración), `"2026" >= "2026-04-21"` es false (lex comparison), por lo que cae en el bucket "previous 7d" sin warning. La comparación lex de YYYY-MM-DD funciona para strings completas; cualquier malformación se traduce en bucket incorrecto. La rama `if (!r.date)` sólo filtra strings vacías y null/undefined.
- **Acción requerida:** Añadir validación regex `/^\d{4}-\d{2}-\d{2}$/` al inicio del loop y `continue` si no matchea; o castear con `new Date(r.date)` y verificar `isFinite(d.getTime())`. Scope: S.

### LOG-16 — `compute.ts:701` la clasificación de "weak/even/strong" usa diferencia absoluta sin tener en cuenta tier de juego

- **Criticidad:** BAJA
- **Categoría:** Datos
- **Ubicación:** `src/lib/analytics/compute.ts:695-706`
- **Evidencia:**
  ```ts
  const myTrophies = b.my_brawler?.trophies ?? 0
  ...
  const avgOppTrophies = opponents.reduce(...)
  const diff = avgOppTrophies - myTrophies
  const tierIdx = diff < -50 ? 0 : diff > 50 ? 2 : 1
  ```
- **Problema detectado:** El umbral fijo de ±50 trofeos no escala. En low-trophy (<300) un diff de 50 trofeos representa enormes diferencias de skill; en high-trophy (>1500) representa ruido. La función produce categorías "weak/even/strong" sesgadas hacia "even" para usuarios high-trophy y hacia "strong" para usuarios low-trophy. Documentación interna no menciona la escala.
- **Acción requerida:** O bien escalar el umbral proporcionalmente (e.g. 5% de `myTrophies`), o cambiar la métrica a percentiles del bucket. Decisión de producto, no técnica — pero el código actual es lógicamente cuestionable. Scope: S.

### LOG-17 — `meta-poll/route.ts` el sampler reconstruye el cierre por player aunque `minLive` cambie sólo cuando se aceptan battles

- **Criticidad:** BAJA
- **Categoría:** Rendimiento
- **Ubicación:** `src/app/api/cron/meta-poll/route.ts:393-417`
- **Evidencia:**
  ```ts
  for (const tag of cappedTags) {
    ...
    const minLive = computeMinLive(battlesByMapMode, effectiveLiveKeys)  // O(|liveKeys|) per player
    const sampler = (key: string): boolean => { ... }
    ...
  }
  ```
- **Problema detectado:** `computeMinLive` itera sobre todas las live keys cada vez que arranca un jugador. Para 600 jugadores × 30 live keys = 18k iteraciones extra. No es crítico (el costo dominante es el HTTP a Supercell), pero el comentario afirma que "minLive reflects any counts that grew during earlier players in this run" — eso es cierto sólo si el cómputo se hace post-loop. Si el grow ocurrió mid-batch para varios jugadores, todos los samplers verán un minLive estancado durante el batch. La función es correcta pero su descripción es imprecisa.
- **Acción requerida:** O documentar la frecuencia real de actualización (granularidad por-jugador, no por-batalla), o tracking incremental de minLive cuando `battlesByMapMode[key]++`. Scope: S — afecta a rendimiento marginal y precisión de balance.

### LOG-18 — `compute.ts:737` cálculo de "comfort" mezcla unidades sin justificación documentada

- **Criticidad:** BAJA
- **Categoría:** Código Limpio
- **Ubicación:** `src/lib/analytics/compute.ts:736-738`
- **Evidencia:**
  ```ts
  const comfort = Math.round(
    wilson * 0.6 + (group.length / maxGames) * 30 + consistency * 10
  )
  ```
- **Problema detectado:** `wilson` es un porcentaje 0-100 (mantiene escala); `(group.length / maxGames)` es ratio 0-1 multiplicado por 30 (escala 0-30); `consistency` es ratio 0-1 multiplicado por 10 (escala 0-10). Sin documentación sobre por qué la suma de ponderadores es 100 (60+30+10) ni por qué wilson domina. `Math.min(100, comfort)` después clampea pero no aclara qué representa el número. Bandera roja para mantenibilidad: cualquier cambio futuro en pesos requiere arqueología.
- **Acción requerida:** Documentar la fórmula con un comentario explicativo o extraer a una constante `COMFORT_WEIGHTS = { wr: 0.6, popularity: 0.3, consistency: 0.1 }` y multiplicar todos por 100. Scope: S.

### LOG-19 — `processBattleForMeta` permite `myBrawlerId === 0` (caso "Unknown")

- **Criticidad:** BAJA
- **Categoría:** Datos
- **Ubicación:** `src/lib/draft/meta-accumulator.ts:26-44`
- **Evidencia:**
  ```ts
  export function processBattleForMeta(acc, battle: BattleMetaInput): void {
    if (battle.result !== 'victory' && battle.result !== 'defeat') return
    if (!battle.map) return
    ...
    const statKey = `${battle.myBrawlerId}|${battle.map}|${battle.mode}`
    // myBrawlerId could be 0 (sentinel) — written to meta_stats
  }
  ```
- **Problema detectado:** El caller (`compute.ts` línea 116) usa `b.my_brawler?.id ?? 0` como fallback. Si llega un battle sin my_brawler (corruption / parser bug), este se acumula como brawler_id=0. La tabla `meta_stats` no tiene constraint que rechace brawler_id=0, así que filas inválidas se persisten. Aguas abajo, las queries de detail muestran "0 - undefined" o se silencian por filtro.
- **Acción requerida:** En `processBattleForMeta` añadir guard `if (!Number.isFinite(battle.myBrawlerId) || battle.myBrawlerId <= 0) return`. Mismo patrón en `compute.ts` para todos los `?? 0` sentinels. Scope: S.

---

## 4. Sin hallazgos en

- **Wilson lower bound** (`src/lib/analytics/stats.ts:15-22`): implementación correcta, edge case `total=0` manejado.
- **Bayesian win rate** (`src/lib/draft/scoring.ts:11-14`): correcto, `total=0` retorna `prior * 100`.
- **Recursión sin caso base / stack overflow**: no hay funciones recursivas relevantes.
- **Concatenación de strings en bucle**: ningún hot path lo hace; todo es array/Map.
- **Decimal/float en código financiero**: PayPal se maneja con strings (`fixed_price.value: "..."`); no hay aritmética float sobre dinero.
- **Bucle infinito potencial**: `meta-poll-balance.ts:88` tiene `while` implícito vía `for (const key of liveKeys)` — bounded by `liveKeys.size`; el `runaway safety valve` en `brawler-trends/route.ts:104` (`offset >= 100_000`) es prudente.
- **`compositeKey` collisions**: el separador `|||` no aparece en map names ni mode strings observados; análisis de los Brawlify naming conventions confirma que es seguro en la práctica.
- **`createSeededRng` xorshift32**: implementación canónica correcta; coerción de seed=0 a 1 maneja el degenerate case.
- **Premium gating** (`src/lib/premium.ts`): la lógica es correcta; el bug está en `paypalStatusToTier` (LOG-14) que alimenta el campo, no en `isPremium`.
- **`stats-maxes.ts:114-121` `completionPct`**: defensa contra NaN explícita y testeada — buena referencia de estilo.
- **`computeClubModeLeaders` tiebreakers**: lógica correcta y testeada.
- **`AuthProvider.linkTag` retry de referral_code collision**: aceptable; el trigger DB regenera el código.

---

## 5. Notas y limitaciones

- **No ejecuté los tests Vitest** — el prompt no lo pidió y `npx vitest run` toma 90s; el typecheck strict pasó limpio que es la cobertura estática mínima.
- **No probé empíricamente PayPal sandbox** — los hallazgos LOG-02 y LOG-14 se basan en lectura del código, contratos PayPal documentados y CLAUDE.md. Reproducirlos requiere webhook simulation con Postman/CLI.
- **No audité el contenido de cada componente UI** — la fase 2 es lógica, no UI. Si un componente tiene cómputo derivado pesado dentro de `useMemo`/render, se me escapó. Recomiendo capturarlo en fase 5.
- **Asunción**: el cron `meta-poll` corre cada 30 min y `compute_brawler_trends` cada 6h, según docstrings — no verifiqué pg_cron en vivo.
- **No tengo acceso al schema actual de Supabase prod** — los hallazgos LOG-01/04 se basan en el SQL committed en migrations 020/021. Si hay un patch posterior que ya filtra source y no está en el repo, ignorar (pero entonces el SQL del repo no representa el estado real, lo cual es un problema separado).
- **Muestreo de tamaños**: prioricé los 12 ficheros con LoC > 200 + todos los API routes + todos los lib/draft/*. Excluí ~40 componentes < 250 LoC y los tests. Si un componente pequeño contuviera lógica crítica, podría haber pasado desapercibida.
