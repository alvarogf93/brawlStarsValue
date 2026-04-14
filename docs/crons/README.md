# Cron Infrastructure — BrawlVision

> **Última actualización**: 2026-04-14 (Sprint F — probabilistic sampling + unit fix + rotation model)
> **Estado**: documentado con datos reales de producción. Hay drift entre el código del repo y el estado real de los crons en producción — ver [Known Issues](#known-issues-y-drift-detectado).
>
> **Cambios recientes destacados**:
> - 2026-04-14 **(Sprint F)**: meta-poll pasa del gate binario `target + ratio` a un **sampler probabilístico inverso** que nunca excluye ningún map live. Todas las constantes `META_POLL_TARGET_RATIO` y `META_POLL_MIN_TARGET` eliminadas; el sampler no tiene parámetros tunables. Migration 017 corrige el bug de unidades del preload (`SUM(total)/6` → batallas reales en lugar de brawler-rows). Ventana de preload del cron separada de la UI (`META_POLL_PRELOAD_DAYS = 28` vs `META_ROLLING_DAYS = 14`). Pool máximo ampliado a 1500 jugadores, `maxDuration` subido a 600s. Ver la nueva sección **Sprint F — probabilistic sampling** abajo.
> - 2026-04-14 (Sprint E): meta-poll algoritmo reescrito — ahora fetchea 11 country rankings (~2,100 unique) y balancea per-(map, mode) contra el estado cumulativo de 14 días via la RPC `sum_meta_stats_by_map_mode`. **Superseded por Sprint F** ese mismo día — el gate binario de Sprint E introdujo un feedback loop que Sprint F eliminó.
> - 2026-04-14: VPS crontab movido al dominio ápex (`brawlvision.com`) tras flip del canonical en Vercel. `www.` ahora 307-redirige, y `curl -s` no sigue redirects, lo que dejó ambos crons muertos durante horas hasta el fix. Ver Issue 6.
> - 2026-04-14: `CRON_SECRET` movido de inline en el crontab a `/home/ubuntu/.brawlvision-env` (chmod 600), sourced en cada línea. Resuelve el Issue 5.
> - 2026-04-14: `normalizeSupercellMode` ahora prioriza `modeId` sobre el string `mode`, corrigiendo el caso de Hyperspace (modeId 45 = brawlHockey) que llegaba mis-clasificado como brawlBall.

---

## TL;DR

BrawlVision corre **6 cron jobs** distribuidos en **3 infraestructuras distintas**:

| Infra | Cantidad | Dónde vive el código |
|---|---|---|
| **Vercel Cron** | 1 | `vercel.json` del repo |
| **Supabase `pg_cron`** | 3 | Migraciones SQL + Dashboard manual |
| **Oracle Cloud VPS** | 2 | `crontab -l` del usuario `ubuntu` en `141.253.197.60` |

**No hay una infraestructura unificada**. Cada tier se añadió en momentos distintos del proyecto y nunca se consolidó. Hay redundancia (el mismo endpoint se llama desde dos tiers) y drift (algunos crons tienen en producción un schedule distinto del que aparece en el código del repo).

---

## Tabla maestra — todos los crons activos hoy

| # | Nombre / Target | Schedule | Infra | Observabilidad | Estado |
|---|---|---|---|---|---|
| 1 | `/api/cron/sync` | `*/20 * * * *` (cada 20 min) | Oracle VPS | `tail /var/log/syslog` | ✅ activo |
| 2 | `/api/cron/sync` | `0 0 * * *` (diario 00:00) | Vercel Cron | Vercel Dashboard logs | ✅ activo — **redundante con #1** |
| 3 | `/api/cron/meta-poll` | `*/30 * * * *` (cada 30 min) | Oracle VPS | `tail /tmp/meta-poll.log` | ✅ activo |
| 4 | `enqueue-premium-syncs` | `*/15 * * * *` en prod (PERO `* * * * *` en el repo) | pg_cron (Supabase) | `SELECT * FROM cron.job_run_details` | ✅ activo — **DRIFT con el repo** |
| 5 | `process-sync-queue` | `*/5 * * * *` en prod (PERO **comentado** en el repo) | pg_cron (Supabase) | `SELECT * FROM cron.job_run_details` | ✅ activo — **NO ESTÁ EN EL REPO** |
| 6 | `cleanup-anonymous-visits` | `0 3 * * *` (diario 03:00) | pg_cron (Supabase) | `SELECT * FROM cron.job_run_details` | ✅ activo |

> Todos los schedules están en **UTC**.

---

## Flujo de datos: qué cron alimenta qué tabla

```
┌─────────────────────────────────────────────────────────────────┐
│                      Brawl Stars API Proxy                        │
│              (Oracle VPS, 141.253.197.60:3001/v1)                 │
└─────────────────────────────────────────────────────────────────┘
         ▲                                              ▲
         │                                              │
         │ fetchBattlelog(player)                       │ fetchPlayerRankings(country, 200) × 11
         │                                              │ fetchBattlelog(each top player)
         │                                              │ fetchEventRotation() → live keys
┌────────┴────────────┐                      ┌─────────┴─────────────┐
│  /api/cron/sync     │                      │  /api/cron/meta-poll  │
│  (syncBattles loop) │                      │  (fetch + aggregate)  │
└────────┬────────────┘                      └─────────┬─────────────┘
         │                                              │
         │ battle-parser → upsert battles               │ processBattleForMeta
         │                                              │ bulk_upsert_meta_stats RPC
         ▼                                              ▼
  ┌──────────────┐                          ┌─────────────────────┐
  │   battles    │                          │   meta_stats        │
  │   (premium)  │                          │   meta_matchups     │
  └──────────────┘                          │   meta_trios        │
  ┌──────────────┐                          │   meta_poll_cursors │
  │   profiles   │                          └─────────────────────┘
  │ (last_sync)  │
  └──────────────┘
  ┌──────────────┐
  │  sync_queue  │
  └──────────────┘
         ▲
         │
┌────────┴─────────────┐    ┌───────────────────────┐    ┌──────────────────────────┐
│ enqueue-premium-syncs│    │ process-sync-queue    │    │ cleanup-anonymous-visits │
│ (pg_cron SQL only)   │    │ (pg_cron SQL only)    │    │ (pg_cron SQL only)       │
└──────────────────────┘    └───────────────────────┘    └────────┬─────────────────┘
                                                                   │
                                                                   ▼
                                                         ┌──────────────────┐
                                                         │ anonymous_visits │
                                                         └──────────────────┘
```

---

## Tier 1: Vercel Cron

### Dónde vive

- **Archivo**: `vercel.json` en la raíz del repo
- **Código del endpoint**: `src/app/api/cron/sync/route.ts` (y podrían añadirse más)

### Contenido actual del `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Un solo cron registrado: `/api/cron/sync` a las 00:00 UTC diario.

### Cómo editar

1. Editar `vercel.json` añadiendo/modificando la array `crons`
2. Commit + push a `main`
3. El próximo deploy de Vercel activa el cron nuevo/modificado
4. Verificar en Vercel Dashboard → Settings → Cron Jobs

### Cómo inspeccionar en vivo

- **Vercel Dashboard** → Project → Settings → Cron Jobs (lista los registrados)
- **Vercel Dashboard** → Deployments → Functions → seleccionar `/api/cron/sync` → ver "Cron Invocations" con logs de cada ejecución
- **CLI** (si estuviera instalado): `vercel logs https://brawlvision.com --since 1h`

### Limitaciones del plan (⚠️ verificar antes de migrar jobs al tier)

- **Hobby**: históricamente limitado a **1 invocación por día por cron job** (por eso BrawlVision nació con el crontab del VPS — necesitaba frecuencia mayor y el plan no lo permitía). Vercel ha relajado este límite a lo largo del tiempo; antes de migrar cualquier cron al tier Vercel, verificar en el dashboard de Vercel del proyecto o en [vercel.com/docs/cron-jobs](https://vercel.com/docs/cron-jobs) cuál es el límite **actual** del plan activo.
- **Pro**: mínimo cada **1 minuto** (permite cualquier schedule estándar cron).

**Implicación práctica**: mientras BrawlVision esté en plan Hobby y el límite siga siendo 1/día, **no se puede usar Vercel Cron para reemplazar `/api/cron/sync` (cada 20 min) ni `/api/cron/meta-poll` (cada 30 min)**. La única entrada actual en `vercel.json` (`/api/cron/sync` diario a las 00:00) ocupa probablemente el slot permitido por el plan.

### Autenticación

Vercel Cron añade automáticamente el header `Authorization: Bearer ${CRON_SECRET}` a cada invocación, **si la env var `CRON_SECRET` está definida en Vercel**. Si no está, Vercel llama sin header y el endpoint devuelve 401.

---

## Tier 2: Supabase `pg_cron`

### Dónde vive

- **Código de referencia en el repo**: `supabase/migrations/002_pg_cron_scheduler.sql` (original) + `009_anonymous_visits.sql` (añadido 2026-04-12)
- **Estado real**: la tabla `cron.job` en el schema `cron` de Supabase
- **⚠️ Drift detectado**: el estado real no coincide con el repo (ver [Known Issues](#known-issues-y-drift-detectado))

### Cómo inspeccionar

**Programático (recomendado, vía RPC helper)**:

```bash
node scripts/diagnose-meta-coverage.js   # sección 11
```

El script consume dos RPCs que creé en `010_cron_diagnostic_helpers.sql`:

- `diagnose_cron_jobs()` — devuelve `{jobid, jobname, schedule, active, username}` para todos los jobs
- `diagnose_cron_runs(p_limit)` — devuelve los últimos `p_limit` runs con `{jobid, jobname, runid, start_time, end_time, status, return_message}`

Ambas son `SECURITY DEFINER`, otorgadas solo a `service_role` (revokeadas de `anon` y `authenticated`). El endpoint público no las puede llamar.

**Manual (Supabase Dashboard → SQL Editor)**:

```sql
-- Todos los jobs registrados
SELECT jobid, jobname, schedule, active, command
FROM cron.job
ORDER BY jobid;

-- Últimas 20 ejecuciones (todas las jobs)
SELECT
  j.jobname,
  r.start_time,
  r.end_time,
  r.status,
  r.return_message,
  EXTRACT(EPOCH FROM (r.end_time - r.start_time)) AS duration_sec
FROM cron.job_run_details r
LEFT JOIN cron.job j USING (jobid)
ORDER BY r.start_time DESC
LIMIT 20;

-- Ejecuciones de un job específico
SELECT start_time, status, return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'meta-poll')
ORDER BY start_time DESC
LIMIT 10;
```

### Cómo editar

Nuevos jobs se añaden vía **migración SQL**:

```sql
-- En una nueva migración supabase/migrations/NNN_your_cron.sql
SELECT cron.schedule(
  'your-job-name',
  '*/30 * * * *',
  $$SELECT public.your_rpc_function();$$
);
```

Para modificar un schedule existente, necesitas primero desprogramarlo:

```sql
SELECT cron.unschedule('your-job-name');
SELECT cron.schedule('your-job-name', 'new-schedule', $$...$$);
```

Las migraciones se aplican vía **Dashboard → SQL Editor** (el proyecto no usa `supabase db push` actualmente).

### Ventajas sobre Vercel Cron

- Sin límite de frecuencia por plan (puedes correr cada segundo si es necesario, aunque no recomendado)
- Ejecución atómica junto a otras operaciones SQL (ideal para cleanup, aggregation, triggering)
- Visibilidad completa vía `cron.job_run_details`
- No consume function invocations de Vercel

### Desventajas

- Solo ejecuta SQL — para llamar HTTP endpoints hay que usar la extensión `pg_net` (más complejo, menos fiable)
- El `command` string está en texto plano y visible via `pg_cron.job` — **nunca pongas secretos** en ese campo
- Si cambias el schedule manualmente en el Dashboard, el drift con el repo es fácil de introducir y difícil de detectar

### Inventario de los 3 jobs actuales

#### 4. `enqueue-premium-syncs`

- **Schedule real**: `*/15 * * * *` (cada 15 min) ⚠️ **DRIFT con el repo**
- **Schedule del repo** (`002_pg_cron_scheduler.sql`): `* * * * *` (cada minuto)
- **Qué hace**: actualiza `sync_queue` reseteando jobs stale + encola hasta 50 profiles premium/pro con `last_sync` más viejo que 1 hora
- **Código SQL**: en `002_pg_cron_scheduler.sql` líneas 5-27

#### 5. `process-sync-queue`

- **Schedule real**: `*/5 * * * *` (cada 5 min) ⚠️ **NO ESTÁ EN EL REPO**
- **En el repo** (`002_pg_cron_scheduler.sql` líneas 30-41): está **comentado**
- **Qué hace**: se asume que llama a la Edge Function `sync-worker` vía `net.http_post`, pero como no está en ninguna migración no podemos verificarlo desde el repo. **Hay que inspeccionar el `command` del job en el Dashboard** para confirmar qué hace exactamente.
- **⚠️ Riesgo**: si el bearer token del Edge Function está hardcoded en el `command`, está visible en texto plano en `cron.job`. Revisarlo en auditoría

#### 6. `cleanup-anonymous-visits`

- **Schedule real**: `0 3 * * *` (03:00 UTC diario) ✅ coincide con el repo
- **Qué hace**: `DELETE FROM public.anonymous_visits WHERE last_visit_at < now() - interval '90 days'`
- **Código SQL**: `supabase/migrations/009_anonymous_visits.sql` líneas 58-71
- **Idempotente** — la migración hace `cron.unschedule` antes de `cron.schedule` en un `DO $$ ... $$` block, así que re-aplicar la migración no duplica el job

---

## Tier 3: Oracle Cloud VPS crontab

### Dónde vive

- **Host**: Oracle Cloud free tier, `141.253.197.60`
- **OS**: Ubuntu (kernel 5.15.0-1081-oracle)
- **Hostname**: `vnic-brawl-value`
- **Usuario del crontab**: `ubuntu` (no root — `sudo crontab -l` está vacío)
- **Acceso SSH**: key local `ssh-key-2026-04-06.key` (fuera del repo, nunca commitear)

### Cómo acceder

```bash
ssh -i "<path-to-ssh-key>" ubuntu@141.253.197.60
```

### Cómo inspeccionar

```bash
# Ver crontab del usuario ubuntu
crontab -l

# Ver últimas ejecuciones (syslog)
grep CRON /var/log/syslog | tail -20

# Ver el log específico del meta-poll (salida de curl)
tail -f /tmp/meta-poll.log

# Ver procesos activos relacionados con cron
ps aux | grep cron | grep -v grep
```

### Cómo editar

```bash
crontab -e  # abre en el editor configurado (normalmente nano en Ubuntu)
```

Luego:
1. Modificar las líneas
2. Guardar y salir
3. Crontab se activa automáticamente — no hace falta reiniciar ningún servicio

### Contenido actual del crontab del `ubuntu`

```
# Sync loop: drains sync_queue and fetches premium users' battlelogs.
# Runs every 20 min. Auth via secret sourced from ~/.brawlvision-env.
*/20 * * * * . /home/ubuntu/.brawlvision-env && curl -s -H "Authorization: Bearer $CRON_SECRET" https://brawlvision.com/api/cron/sync > /dev/null 2>&1

# Meta polling — every 30 min. 600 players from 11 country rankings
# (~2,100 unique after dedup), per-(map,mode) cumulative balance via
# the sum_meta_stats_by_map_mode preload RPC. Auth via secret sourced
# from ~/.brawlvision-env.
*/30 * * * * . /home/ubuntu/.brawlvision-env && curl -s -H "Authorization: Bearer $CRON_SECRET" https://brawlvision.com/api/cron/meta-poll >> /tmp/meta-poll.log 2>&1
```

The secret lives in `/home/ubuntu/.brawlvision-env` (chmod 600, owner
`ubuntu:ubuntu`):

```
export CRON_SECRET="<64 hex chars>"
```

Cada línea del cron hace `.` (source) de ese archivo antes de
ejecutar `curl`, exponiendo `$CRON_SECRET` como variable de shell
en la misma invocación. Este patrón fue introducido el 2026-04-14
para resolver [Issue 5](#issue-5-resuelto-cron_secret-en-texto-plano-en-el-crontab-del-vps).

### Inventario de los 2 jobs

#### 1. `/api/cron/sync` (VPS)

- **Schedule**: `*/20 * * * *` (cada 20 min, 72 invocaciones/día)
- **Target**: `POST https://www.brawlvision.com/api/cron/sync`
- **Código del endpoint**: `src/app/api/cron/sync/route.ts`
- **Qué hace**: procesa la `sync_queue` de Supabase, llamando a `syncBattles(player_tag)` para cada job pending. Cada `syncBattles` fetchea el battlelog (últimas 25 batallas), las parsea, y hace upsert en `battles` con dedup por `(player_tag, battle_time)`.
- **⚠️ Redundancia**: Vercel Cron también llama a este mismo endpoint diariamente (ver Tier 1). El VPS lo hace 72 veces al día y Vercel 1 vez. Los dos son idempotentes (ON CONFLICT DO NOTHING), así que no causa corrupción de datos, pero es ruido innecesario.

#### 3. `/api/cron/meta-poll` (Sprint F, 2026-04-14)

- **Schedule**: `*/30 * * * *` (cada 30 min, 48 invocaciones/día)
- **Target**: `GET https://brawlvision.com/api/cron/meta-poll` (ápex, NO `www.` — ver Issue 6)
- **Código del endpoint**: `src/app/api/cron/meta-poll/route.ts`
- **Lógica pura testada**: `src/lib/draft/meta-poll-balance.ts` (`computeMinLive`, `computeAcceptRate`, `createSeededRng`, `findMapModeStragglers`)
- **Auth**: `Authorization: Bearer $CRON_SECRET`, sourced desde `/home/ubuntu/.brawlvision-env`
- **Qué hace** (Sprint F algoritmo "probabilistic weighted sampling"):
  1. **Fetch candidate pool en paralelo** — `fetchPlayerRankings(country, 200)` para las 11 regiones de `META_POLL_RANKING_COUNTRIES` (`global`, `US`, `BR`, `MX`, `DE`, `FR`, `ES`, `JP`, `KR`, `TR`, `RU`) vía `Promise.allSettled`. La API de Supercell cappea cada respuesta a **200 items** independientemente del `limit` solicitado (probado empíricamente), así que necesitamos múltiples regiones para escapar del cap. Cross-country overlap es ~4%, así que 11 regiones entregan **~2,100 jugadores únicos**.
  2. **Fetch live rotation** — `fetchEventRotation()` para conocer los `(map, mode)` actualmente en rotación. Los mapas out-of-rotation no son targets del sampler — no pueden recibir batallas nuevas porque no hay event slot activo alimentándolos.
  3. **Preload cumulativo** — RPC `sum_meta_stats_by_map_mode(p_since, p_source='global')` con `p_since = NOW() - META_POLL_PRELOAD_DAYS` (**28 días**, más largo que la ventana de UI de 14 días — ver invariante #4 abajo). Desde migration 017 la RPC devuelve `ROUND(SUM(total) / 6)`, o sea **batallas reales**, no brawler-rows. Los counts seeden el mapa `battlesByMapMode` in-memory en la misma unidad que el `+1 per battle` incremental que ocurre durante el loop.
  4. **Straggler cleanup** — `findMapModeStragglers` + RPC `cleanup_map_mode_strays` mergean filas mis-clasificadas (ej. Hyperspace bajo brawlBall cuando el live rotation dice brawlHockey). Solo corre cuando la rotación fue fetcheada con éxito; si el endpoint de eventos está caído, salta para no adivinar canonical.
  5. **Process players loop** — itera el pool dedupeado hasta `META_POLL_MAX_DEPTH` (**1500**) o hasta que el soft wall-clock budget (`540_000ms`) se agote. **Por cada jugador** reconstruye un sampler probabilístico:

     ```
     minLive = min(battlesByMapMode[k] for k in liveKeys)
     p(accept, key) = min(1, (minLive + 1) / (current[key] + 1))
     ```

     Cada batalla entrante pasa por `rng() < p(accept, key)`. Propiedades clave del sampler:
     - El par live más escaso siempre tiene rate **1.0** (acepta todo).
     - Los pares live oversampleados se atenúan proporcional a su oversupply inverso. **Nunca llegan a 0** — Laplacian smoothing (+1 en numerador y denominador) garantiza rate > 0 incluso contra un outlier extremo.
     - Mapas fuera de rotación (no en `liveKeys`) siempre retornan `false`.
     - Sin constantes tunables. Sin floor, ceiling, ratio, target. Convergencia monotónica: a medida que `minLive` sube, todas las rates suben hacia 1 y el sampler auto-desactiva su efecto filtrante.
     - **No hay early-exit**. El loop solo termina por pool exhaustion o wall-clock budget. Todo live map siempre tiene rate > 0, así que todos siguen recolectando.
  6. **Cursor dedup** — `meta_poll_cursors` avanza a `max(battle_time)` del battlelog procesado **independientemente** de si cada batalla pasó el sampler. Una batalla "rechazada" no es un missing duplicate ni un delete de DB — es simplemente una captura skippeada en favor del budget para maps escasos. Ver invariante #1 abajo.
  7. **Bulk upsert** — `bulk_upsert_meta_stats`, `bulk_upsert_meta_matchups`, `bulk_upsert_meta_trios` (cada uno es una sola llamada RPC con un array JSONB).
  8. **Heartbeat** — `writeCronHeartbeat(..., { initialMinLive, finalMinLive, ... })` al final de todo. La convergencia se observa comparando ambos valores: `finalMinLive > initialMinLive` significa que el run logró subir el piso de los escasos; `finalMinLive == initialMinLive` indica que el par más escaso no tuvo supply en este batch (limitación real del meta pro, no del algoritmo).
- **Throttle**: `META_POLL_DELAY_MS` (100ms) entre llamadas API para no saturar el proxy. NO es polling — es rate-limiting de la API de Supercell. El cron es un único invocation bounded por pool size + throttle.
- **Duración envelope**: 1500 jugadores × (~150ms Supercell fetch + 100ms throttle) ≈ **375s worst-case**, dentro del `maxDuration = 600` con margen. Soft wall-clock guard sale graceful a 540s, dejando ~60s para los bulk upserts + cursor flush antes del hard kill de Vercel.
- **Output visible en `/tmp/meta-poll.log`** — cada invocación añade el JSON de respuesta del endpoint con la forma:
  ```json
  {
    "processed": 1499,
    "skipped": 0,
    "errors": 1,
    "battlesProcessed": 847,
    "statKeys": 142,
    "matchupKeys": 2156,
    "trioKeys": 389,
    "adaptive": {
      "poolSize": 2093,
      "playersPolled": 1500,
      "liveKeyCount": 7,
      "rotationAvailable": true,
      "timeBudgetExit": false,
      "initialMinLive": 83,
      "finalMinLive": 97,
      "stragglersMerged": [],
      "finalCountsByMapMode": { ... }
    }
  }
  ```
  El `finalCountsByMapMode` es el estado **cumulativo** de 28 días en batallas reales (preload + acceptaciones del run).

##### Sprint F — probabilistic weighted sampling overhaul

**Problema que Sprint E no resolvía**: Sprint E introdujo el preload cumulativo y el gate `target = max(floor, ratio × max(live))`. Corregía el problema de invisibilidad cumulativa pero creaba un **loop de retroalimentación positiva**:

1. Los pros juegan mucho más los maps populares del meta (Sneaky Fields, Sidetrack) → esos maps crecen rápido.
2. `max(live)` sube con ellos.
3. El target `0.6 × max` sube proporcionalmente, haciendo que los maps escasos necesiten más batallas absolutas para salir de `underTarget`.
4. Los maps escasos tienen supply real limitado en los battlelogs de los 600 top players, así que no pueden correr detrás del target.
5. El gap nunca se cierra.

Auditoría del 2026-04-14: el target calculado para brawlBall era **5,203 brawler-rows** (Sneaky Fields a 8,672 × 0.6), mientras que Sunny Soccer tenía **500 brawler-rows ≈ 83 batallas reales**. Imposible de alcanzar dentro de la ventana de 14 días.

Peor aún: había un **bug de unidades silencioso**. El RPC de Sprint E (`sum_meta_stats_by_map_mode` original) devolvía `SUM(total)` = brawler-rows (cada batalla 3v3 genera 6 rows). Pero el loop incrementaba in-memory con `+1 per real battle`. Preload y loop hablaban unidades diferentes — el preload siempre dominaba porque era ~6× más grande, y el sampler efectivamente comparaba manzanas con peras.

Sprint F resuelve los dos problemas de raíz:

1. **Migration 017** — el RPC ahora devuelve `ROUND(SUM(total) / 6)`. Unidades coherentes end-to-end. Bug silencioso eliminado. Ver `supabase/migrations/017_sum_meta_stats_battles_unit_fix.sql`.
2. **Sampler probabilístico en lugar de gate binario** — la fórmula `(minLive + 1) / (current + 1)` atenúa sin excluir, elimina el feedback loop (minLive no tiene forma de escalarse con el máximo), y converge asintóticamente sin necesidad de target explícito.
3. **Pool ampliado** — `META_POLL_MAX_DEPTH: 600 → 1500`. El pool tiene ~2,100 únicos; sólo procesábamos el 28%. Más jugadores = más chances de encontrar a alguien que juegue los maps escasos.
4. **Ventana de preload separada** — `META_POLL_PRELOAD_DAYS = 28` (cron) vs `META_ROLLING_DAYS = 14` (UI). El cron necesita memoria más larga para priorizar bien maps con rotación lenta; la UI mantiene recency para reflejar el meta post-balance-patches.
5. **`maxDuration: 300 → 600`** para dar margen a 1500 jugadores. Requiere plan Pro de Vercel (si el plan Hobby rechaza, bajar a 300 y `META_POLL_MAX_DEPTH` a 1000).

##### Modelo de rotación de Brawl Stars y por qué importa

El algoritmo está diseñado alrededor del modelo de rotación específico de Brawl Stars. Documentado aquí para que futuros refactors no rompan invariantes implícitos.

**Cómo funciona la rotación** (según observación empírica + Brawl Stars public docs):

- Una **temporada** dura ~2 meses. Cada temporada Brawl Stars publica un **pool finito de maps por modo** (típicamente 5-15 maps por modo competitivo).
- Cada modo tiene uno o más **slots simultáneos** en el carrusel de eventos. Modos populares como brawlBall tienen 2-3 slots en cualquier momento; modos más nicho (heist, hotZone) tienen 1.
- Cada **~24 horas** cada slot rota a un map distinto del pool de su modo. Dentro de una temporada un mismo map **aparece varias veces**, con cadencia promedio `(días de temporada × slots de su modo) / (tamaño del pool)`.
- Al final de temporada algunos maps se retiran y entran nuevos con el siguiente "Brawl Pass".
- **Supply asimétrico**: los pros NO juegan uniformemente. Maps "competitivos" (Sneaky Fields, Sidetrack) reciben 10-20× más batallas de top players que maps "casuales" (Sunny Soccer, Beach Ball). Esto es distribución del meta real, NO mala suerte ni bug — pro players conocen qué mapas son favorables y los juegan más.

**Implicaciones para el meta-poll**:

- **Convergencia asintótica, no instantánea**. Un map con rotación cada 5 días tiene 2-3 apariciones dentro de la ventana de 28 días del preload. Si cada aparición captura 100-200 batallas, el map acumula 300-500 en la ventana. Si rota cada 7 días, 150-250 dentro de la ventana — a veces necesita 3-4 rotaciones para estabilizarse.
- **Memoria es crítica**. Un map que rotó hace 16 días (fuera de la ventana de UI pero dentro de la del cron) aún debe contribuir a la decisión del sampler, o el algoritmo lo trata como "nuevo" cada vez que vuelve a rotación y desperdicia budget re-priorizándolo.
- **El sampler debe tolerar supply no-convergente**. Si un map genuinamente no tiene supply real (los pros no lo juegan), el sampler no puede forzarlo a alcanzar ningún target. Lo que el sampler garantiza es que ese map **recibe TODO lo que aparece** (rate = 1 por ser el más escaso), y lo que no puede garantizar es que aparezca algo.

##### Invariantes de preservación de datos

Estos son invariantes que cualquier refactor futuro del meta-poll **debe mantener**:

1. **Cero DELETE de `meta_stats`, `meta_matchups`, `meta_trios`**. El sampler probabilístico puede *rechazar capturas* (no escribir a DB una batalla entrante del API) pero **nunca** borra filas existentes. "Rechazar captura" es una decisión de budget al momento de ver la batalla en el battlelog del jugador, no una mutación de la base de datos.
2. **Cero DECREMENTO de counts**. Nadie resta de los contadores de `meta_stats`. La ventana rodante (14 o 28 días) caduca datos viejos por fecha de la batalla al leer, no al escribir. Las filas viejas siguen físicamente en la tabla hasta que un proceso de archive explícito las mueva (ver task `meta_stats_archive` abajo).
3. **El cursor avanza siempre a `max(battle_time)`** del battlelog procesado, independientemente del sampler. Una batalla rechazada por el sampler NO vuelve a ser candidata en el siguiente run — se pierde del API pero NO de la DB (porque nunca llegó a la DB). Esto previene duplicados y garantiza progreso del loop.
4. **Ventana de preload del cron ≥ ventana de UI**. `META_POLL_PRELOAD_DAYS ≥ META_ROLLING_DAYS` por construcción. El cron debe ver al menos lo que la UI ve (más, idealmente) para que sus decisiones de priorización sean compatibles con lo que el usuario final verá.
5. **Units coherentes**. `battlesByMapMode` se maneja siempre en batallas reales (no brawler-rows). El RPC `sum_meta_stats_by_map_mode` debe dividir por 6 (o por `brawlers_per_battle` si algún día el modelo cambia). El incremento in-memory es `+1 por batalla real`. Nunca mezclar unidades.
6. **Cleanup es merge, nunca delete neto**. `findMapModeStragglers` + `cleanup_map_mode_strays` mergean filas mis-clasificadas (wrong mode → canonical mode). El total de filas antes y después del merge es conservado; solo cambia cómo se indexan. El RPC usa `DELETE ... RETURNING` + `INSERT ... ON CONFLICT DO UPDATE` atómico para que no haya ventana de inconsistencia.
7. **Scope exacto**: el meta-poll ingesta **solo modos 3v3 competitivos** — los 9 valores de `DRAFT_MODES` en `src/lib/draft/constants.ts`. Showdown (todas las variantes), boss fight, big game, y duels están excluidos upstream en `normalizeSupercellMode`, así que nunca llegan a `meta_stats`. El divisor `/6` de la RPC depende de este scope — si algún día se añade un modo no-3v3, hay que generalizar a `/ brawlers_per_battle`.

### Ventajas del VPS cron

- Sin límites de plan (corre gratis cada 30 min en Oracle free tier)
- Independiente de cambios/failures de Vercel
- Logs persistentes en el VPS

### Desventajas

- **No observable desde Vercel** — si el VPS falla, los monitors de Vercel no lo detectan
- **Vive fuera del repo** — el código del crontab no está versionado, un cambio manual se pierde si el VPS se re-instala
- **Single point of failure** — si el Oracle VPS cae, todo el meta-poll y el sync-loop caen sin aviso
- ~~**Secret en texto plano** en el crontab — cualquier persona con acceso SSH ve el `CRON_SECRET`~~ → **Resuelto 2026-04-14**: secret ahora en `/home/ubuntu/.brawlvision-env` chmod 600, sourced en cada línea del cron. Ya no aparece en `crontab -l`, `ps auxf`, ni en el CMD log de cron en `/var/log/syslog`

---

## Gestión del `CRON_SECRET`

### Dónde vive el secret

El mismo valor en **tres sitios**:

1. **Vercel Dashboard** → Project Settings → Environment Variables → `CRON_SECRET` (production scope). El route handler valida contra `process.env.CRON_SECRET`.
2. **`.env.local`** del desarrollador local (para tests y scripts standalone).
3. **VPS** — `/home/ubuntu/.brawlvision-env`, formato `export CRON_SECRET="<hex>"`, chmod 600, owner `ubuntu:ubuntu`. Cada línea del crontab hace `. /home/ubuntu/.brawlvision-env && curl ...` para exponer `$CRON_SECRET` justo antes del `curl`. Antes del 2026-04-14 el secret vivía inline en el crontab — ver Issue 5.

> **⚠️ Importante**: el `.env.local` del repo está en `.gitignore` (línea `.env*`). **Nunca commitear** un `.env.local` que contenga este secret. El archivo `.brawlvision-env` en el VPS es un sibling del `.env.local` — vive solo en el home del usuario `ubuntu`, no en el repo.

### Cuándo rotar

Rotar **inmediatamente** si:

- El secret ha aparecido en cualquier log, screenshot, chat, commit, ticket, o canal público
- Algún miembro del equipo con acceso al VPS se va del proyecto
- Cualquier sospecha de compromiso

Rotar **periódicamente**:

- Cada 90 días como buena práctica

### Cómo rotar (procedimiento detallado)

**Paso 1 — Generar un nuevo secret**:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Te da 64 caracteres hex aleatorios. Cópialo al portapapeles. **No pegarlo en ningún chat, issue, o commit**.

**Paso 2 — Actualizar Vercel primero** (para que el endpoint deje de aceptar el secret viejo):

1. Vercel Dashboard → Project Settings → Environment Variables
2. `CRON_SECRET` → Edit → pegar el nuevo valor → Save
3. Vercel preguntará si redeploy — **acepta**
4. Esperar ~2 min a que el nuevo deploy esté live

> **⚠️ Ventana de falla**: durante esos 2 minutos el VPS sigue llamando con el secret viejo, que devolverá 401. Los jobs fallarán durante ese intervalo. En la práctica no es grave porque el sync es idempotente y el meta-poll también. Si te preocupa, puedes hacer el paso 3 ANTES del paso 2, pero entonces el VPS mandará el secret nuevo a un endpoint que aún valida el viejo y también fallará durante ~2 min. Da igual en qué orden, hay una ventana pequeña de failures.

**Paso 3 — Actualizar el VPS** (ahora trivial gracias a `.brawlvision-env`):

```bash
ssh -i "<path-to-ssh-key>" ubuntu@141.253.197.60
# Editar la única línea del archivo del env — no hace falta tocar el crontab.
nano /home/ubuntu/.brawlvision-env
# Cambiar el valor dentro de export CRON_SECRET="..."
# Guardar y salir. El próximo run del cron (en ≤ 20 min) ya usa el nuevo.
```

Alternativa sin abrir editor (pasa el secret vía stdin):

```bash
ssh -i "<key>" ubuntu@141.253.197.60 << 'EOF'
NEW_SECRET="<pegar-nuevo-aqui>"
printf 'export CRON_SECRET="%s"\n' "$NEW_SECRET" > /home/ubuntu/.brawlvision-env
chmod 600 /home/ubuntu/.brawlvision-env
unset NEW_SECRET
# Verificar (si ves un valor, es correcto — cerrá el terminal rápido):
. /home/ubuntu/.brawlvision-env && echo "length=${#CRON_SECRET}"
EOF
```

No hace falta `crontab -e` — las líneas del crontab ya referencian
`$CRON_SECRET` vía source, así que basta con cambiar el archivo.

**Paso 4 — Actualizar `.env.local`** del desarrollador:

Editar la línea `CRON_SECRET=...` con el valor nuevo. Solo necesario si vas a correr scripts localmente contra el endpoint; no afecta a producción.

**Paso 5 — Verificar**:

- `tail /tmp/meta-poll.log` en el VPS — debería mostrar respuestas 200 en los últimos 30 min
- Vercel Dashboard → Functions → /api/cron/meta-poll logs — igual, 200s
- `node scripts/diagnose-meta-coverage.js` — `meta_stats` debería seguir subiendo rows

---

## Debugging cron jobs

### "Un cron no parece estar corriendo"

Checklist:

1. **¿Qué tier?** Identifica en qué infra vive (Vercel / pg_cron / VPS). Si no lo sabes, busca en los 3.
2. **¿Está registrado?**
   - Vercel: `cat vercel.json`
   - pg_cron: `SELECT * FROM cron.job WHERE jobname = '...'` o `node scripts/diagnose-meta-coverage.js` (sección 11)
   - VPS: `ssh ... 'crontab -l'`
3. **¿Está activo?**
   - Vercel: Dashboard → Cron Jobs → enabled/disabled
   - pg_cron: `SELECT active FROM cron.job WHERE jobname = '...'`
   - VPS: si está en `crontab -l` sin `#` al inicio, está activo
4. **¿Ha corrido recientemente?**
   - Vercel: Dashboard → Deployments → Functions → seleccionar el endpoint → Cron Invocations
   - pg_cron: `SELECT * FROM cron.job_run_details WHERE jobid = ... ORDER BY start_time DESC LIMIT 5`
   - VPS: `grep CRON /var/log/syslog | grep <job-name> | tail -5`
5. **¿Está fallando con 401?** Casi siempre es un secret desalineado. Verificar los 3 sitios donde vive el `CRON_SECRET`.
6. **¿Está fallando con 5xx?** Mirar los logs del endpoint:
   - Vercel Dashboard → Deployments → Functions → Logs
   - O directamente el JSON de respuesta en `/tmp/meta-poll.log` del VPS

### "Un cron corre pero los datos no llegan"

- Verificar que el endpoint está haciendo upsert correctamente (revisar el código del route)
- Verificar RLS: si el endpoint usa `createClient()` (anon+cookies) en lugar de `createServiceClient()` (service role), las políticas RLS pueden estar bloqueando las escrituras
- Verificar rate limits del proxy: `curl http://141.253.197.60:3001/v1/players/%23SOMETAG` directamente para ver si el proxy responde

### "El cron está duplicado o corriendo dos veces"

- Buscar en los 3 tiers simultáneamente:
  ```bash
  # Vercel
  grep '"path":' vercel.json

  # pg_cron
  node scripts/diagnose-meta-coverage.js  # sección 11

  # VPS
  ssh -i "<key>" ubuntu@141.253.197.60 'crontab -l'
  ```
- El caso actual es `/api/cron/sync` registrado en Vercel Y en el VPS — ver [Known Issues](#known-issues-y-drift-detectado)

---

## Known Issues y drift detectado

### Issue 1: Redundancia en `/api/cron/sync`

**Problema**: el endpoint `/api/cron/sync` está registrado **dos veces**:

- Vercel Cron, schedule `0 0 * * *` (1 vez al día, 00:00 UTC)
- VPS crontab, schedule `*/20 * * * *` (72 veces al día, cada 20 min)

**Impacto**: 73 invocaciones diarias en total, 72 del VPS y 1 de Vercel. Los dos apuntan al mismo endpoint. `syncBattles` es idempotente (dedup por `(player_tag, battle_time)`), así que no causa corrupción, pero es ruido:

- 1 invocación Vercel extra por día consume function hours sin aportar nada nuevo que el VPS no ya haya procesado
- Los logs de Vercel Cron muestran UNA ejecución al día mientras que la realidad es 73 ejecuciones distribuidas desde IP externa del VPS — confuso

**Recomendación**: eliminar la entrada del `vercel.json` **o** eliminar la del VPS. Si el VPS es autoritativo, quita el Vercel Cron. Si queremos empezar a migrar al stack oficial, quita el del VPS.

### Issue 2: `/api/cron/meta-poll` vive fuera del repo

**Problema**: el único llamador del endpoint es el VPS. No está en `vercel.json` ni en ningún `pg_cron`. Si el VPS falla, el meta-poll deja de correr sin aviso.

**Contexto histórico — por qué nació en el VPS**: Vercel Cron en plan Hobby limitaba cada cron a **1 invocación por día**. Un poll cada 30 min es físicamente imposible en ese plan. Oracle Cloud ofrece un VPS free tier que permite `crontab` con cualquier frecuencia. La decisión de usar el VPS fue la **correcta** dados los constraints de coste.

**Impacto actual**:

- Zero observabilidad centralizada (no aparece en Vercel Dashboard)
- Single point of failure (si el VPS Oracle cae, el meta-poll deja de correr sin aviso)
- El schedule vive solo en el crontab del VPS — si el VPS se re-instala, hay que recordar recrear los jobs a mano
- El futuro comando `/cron` del bot de Telegram **no puede ver el estado** del meta-poll (solo ve `pg_cron`)
- ~~Secret en texto plano en el crontab (ver Issue 5)~~ → Resuelto 2026-04-14

**Opciones para mejorar — ordenadas por esfuerzo creciente**:

1. **Mantener en VPS + añadir health monitoring externo** (menor esfuerzo). Un servicio como [healthchecks.io](https://healthchecks.io) permite crear un "ping URL" que expira si no recibe llamadas en X minutos. Añades `&& curl -fsS https://hc-ping.com/<uuid>` al final de la línea del cron en el VPS. Si el cron deja de correr (VPS caído, fallo del curl, etc.), healthchecks.io te envía un email/Slack/Telegram al cabo de X minutos de silencio. Free tier de healthchecks.io cubre este uso. **1 hora de trabajo, cero código**.

2. **Migrar a `pg_cron` + `pg_net`** (esfuerzo medio). Supabase permite usar `pg_cron` con cualquier frecuencia en el free tier. La extensión `pg_net` permite que un job SQL haga un `net.http_post` a un endpoint HTTP. Se crea una nueva migración con `cron.schedule('meta-poll', '*/30 * * * *', $$SELECT net.http_post(...)$$)`. Ventajas: observabilidad vía `cron.job_run_details` (visible desde el bot Telegram) y consolidación en el stack Supabase. Desventajas: el secret de `CRON_SECRET` queda visible en `cron.job.command` (mismo riesgo que el VPS), y `pg_net` tiene algunas quirks con el manejo de errores asíncronos. **1 sprint de trabajo**.

3. **Upgrade a Vercel Pro** (decisión de producto, no de engineering). Pro permite cada minuto, así que el meta-poll puede vivir en `vercel.json` con schedule `*/30 * * * *`. Ventajas: observabilidad nativa de Vercel, secret manejado en env vars cifradas, un solo stack. Desventajas: **coste** ($20/mes). Solo tiene sentido si BrawlVision ya necesita Pro por otros motivos (más function hours, domains extras, etc.).

**Recomendación práctica hasta que haya upgrade de plan**: opción 1 (healthchecks.io + mantener VPS). Es el ROI más alto — resuelve el 80% del problema (pérdida silenciosa del servicio) con 1 hora de trabajo, sin migración de código, sin refactor. La opción 2 es un "nice to have" si queremos que el bot Telegram pueda responder sobre el meta-poll sin extensiones custom.

### Issue 3: Drift entre el código del repo y el estado real de `pg_cron`

**Problema**: el archivo `supabase/migrations/002_pg_cron_scheduler.sql` del repo dice:

```sql
-- 1. Enqueue premium users who need syncing (every minute, LIMIT 50)
SELECT cron.schedule('enqueue-premium-syncs', '* * * * *', $$...$$);

-- 2. Trigger the Edge Function to process queue (every minute)
-- Replace <project-ref> and <service_role_key> with actual values
-- SELECT cron.schedule(
--   'process-sync-queue',
--   '* * * * *',
--   ...
-- );
```

Pero el estado real de producción, verificado via `diagnose_cron_jobs()` el 2026-04-12:

```
enqueue-premium-syncs     */15 * * * *    active=true
process-sync-queue        */5 * * * *     active=true
cleanup-anonymous-visits  0 3 * * *       active=true
```

**Drift concreto**:

- `enqueue-premium-syncs` corre cada **15 min** en producción, no cada minuto como dice el repo
- `process-sync-queue` **está activo** en producción (cada 5 min), pero en el repo está **comentado** con placeholders `<project-ref>` y `<service_role_key>`

**Implicaciones**:

- El repo no es la fuente de verdad del estado de los crons
- Si se re-aplicara `002_pg_cron_scheduler.sql` hoy, rompería el estado actual (cambiaría a cada minuto el enqueue)
- No sabemos con certeza qué hace `process-sync-queue` sin inspeccionar el `command` del job en el Dashboard
- Algún desarrollador (probablemente tú) ajustó estos schedules manualmente en el Dashboard y no actualizó el repo

**Recomendación**:

1. Inspeccionar el `command` actual de `process-sync-queue` en el Dashboard:
   ```sql
   SELECT command FROM cron.job WHERE jobname = 'process-sync-queue';
   ```
2. Si el command está bien y es lo que queremos, **crear una nueva migración** `011_pg_cron_realign.sql` que:
   - `cron.unschedule('enqueue-premium-syncs')`
   - `cron.schedule('enqueue-premium-syncs', '*/15 * * * *', ...)` con el SQL del repo
   - `cron.unschedule('process-sync-queue')`
   - `cron.schedule('process-sync-queue', '*/5 * * * *', ...)` con el SQL real inspeccionado del Dashboard
3. Aplicarla. A partir de ahí, el repo refleja el estado real.

Alternativa más pragmática: **editar `002_pg_cron_scheduler.sql`** para que refleje el estado real, pero esto rompe el historial inmutable de migraciones y es mala práctica. Mejor migración nueva.

### Issue 4 (RESUELTO): Comentario obsoleto en el crontab del VPS

**Problema**: la línea del meta-poll tenía el comentario `# Meta polling - every 30 min (50 players per batch)`, pero el pool real subió a 200 (commit `561364f`) y luego al algoritmo cumulative de 600 players multi-país (Sprint E, 2026-04-14).

**Fix aplicado**: crontab actualizado el 2026-04-14 al comentario actual que describe la arquitectura Sprint E con 600 players + 11 country rankings + per-(map, mode) cumulative balance.

### Issue 5 (RESUELTO): `CRON_SECRET` en texto plano en el crontab del VPS

**Problema**: el crontab contenía `Bearer <secret>` en texto plano. Cualquier persona con acceso SSH (o con capacidad de leer `/var/log/syslog`) podía leer el secret porque `cron` loguea cada `CMD` completo antes de ejecutarlo.

**Impacto**: si el VPS era comprometido a cualquier nivel de privilegio que permitiera leer syslog o el home del usuario `ubuntu`, el secret se filtraba.

**Fix aplicado 2026-04-14**:

1. El secret vive en `/home/ubuntu/.brawlvision-env` como `export CRON_SECRET="<hex>"`, chmod 600, owner `ubuntu:ubuntu`.
2. Cada línea del crontab source el archivo antes de llamar a curl:
   ```
   */20 * * * * . /home/ubuntu/.brawlvision-env && curl -s -H "Authorization: Bearer $CRON_SECRET" https://brawlvision.com/api/cron/sync > /dev/null 2>&1
   ```
3. Cron loguea la línea **sin expandir las variables**, así que `/var/log/syslog` ve `$CRON_SECRET` literal, no el valor real.

**Threat model después del fix**:

- ✅ `crontab -l` ya no muestra el secret
- ✅ `/var/log/syslog` ya no captura el secret en las entradas `CMD` de cron
- ✅ `ps auxf` ya no lo muestra fuera de la ventana brevísima de ejecución del curl (antes aparecía en cada línea del crontab)
- ⚠️ Durante el <1s de ejecución del curl, el valor expandido sí aparece en `ps auxf` del proceso curl activo. Mitigación futura: `curl -H @/path/to/header-file` que lee la cabecera de un archivo en lugar del argv. Fuera de scope por ahora.
- ⚠️ Un atacante con acceso al home del usuario `ubuntu` puede leer `.brawlvision-env`. Sin cambio respecto al estado anterior — es inherente a almacenar secrets en un sistema de archivos accesible.

**Mitigación total**: migrar el cron fuera del VPS a Vercel Cron (secret en env vars cifradas) o a `pg_cron` + `pg_net` (secret en setting de DB cifrado). Eso resolvería Issue 2 y Issue 5 al mismo tiempo, pero solo tiene sentido tras un upgrade a Vercel Pro o un sprint dedicado a `pg_cron + pg_net`.

### Issue 6 (RESUELTO): 307-redirect del canonical flip rompió los crons del VPS

**Problema**: el 2026-04-14 se flipeó la dirección canonical en Vercel Project → Domains — antes `brawlvision.com` (ápex) 307-redirigía a `www.`, ahora es al revés. El crontab del VPS estaba hardcoded a `https://www.brawlvision.com/...`. `curl -s` sin `-L` **no sigue redirects**, así que cada invocación recibía el 307 y descartaba la respuesta. Ambos crons (`sync` y `meta-poll`) quedaron muertos durante horas.

El mismo bug afectó en paralelo al webhook del bot de Telegram (también hardcoded a www) — fue el primer síntoma que nos hizo investigar. Una vez arreglado el bot, apareció como "sospechoso" en el audit del meta-poll (cursors viejos, `pending_updates: 3`).

**Fix aplicado 2026-04-14**: crontab del VPS apuntando al ápex `https://brawlvision.com/...`. Al tocarlo, también se actualizó el comentario obsoleto (Issue 4) y se movió el secret fuera del inline (Issue 5). Una sola intervención resolvió tres issues.

**Prevención futura**: nunca apuntar un cliente HTTP que no siga redirects (como `curl -s`) a un dominio que esté detrás de un 307 redirect. O siempre usar el ápex canonical, o añadir `-L` al curl. El mantenimiento del doc `docs/local/vps-access.md` explícitamente lo nota en su sección "Canonical flip gotcha".

---

## Observability — `cron_heartbeats` table

Tabla nueva (migration `016_cron_heartbeats.sql`) que resuelve parcialmente el Issue 2 — "meta-poll vive fuera del repo, zero observabilidad". Los crons HTTP del VPS (`/api/cron/sync`, `/api/cron/meta-poll`) escriben una fila en `cron_heartbeats` al final de cada run exitoso. Si el VPS muere o un run empieza a fallar a mitad, la fila deja de actualizarse — staleness visible a consulta directa, sin SSH ni `/tmp/meta-poll.log`.

**Schema**:

```sql
cron_heartbeats (
  job_name TEXT PRIMARY KEY,
  last_success_at TIMESTAMPTZ NOT NULL,
  last_duration_ms INT NOT NULL,
  last_summary JSONB
)
```

**Job names activos**:

- `meta-poll` — actualizado al final de `src/app/api/cron/meta-poll/route.ts`. `last_summary` contiene `{ battlesProcessed, poolSize, playersPolled, liveKeyCount, stragglersMerged, earlyExit, timeBudgetExit, rotationAvailable }`.
- `sync` — actualizado al final de `src/app/api/cron/sync/route.ts`. `last_summary` contiene `{ processed, errors }` o `{ processed: 0, reason: 'no users to sync' }` en el no-op path (que también cuenta como éxito — la query corrió, nada que hacer).

**Consulta "is it stale?"** — ejecutar manualmente en SQL Editor o desde un script:

```sql
-- All heartbeats + staleness
SELECT
  job_name,
  last_success_at,
  EXTRACT(EPOCH FROM (NOW() - last_success_at))::INT AS seconds_ago,
  last_duration_ms,
  last_summary
FROM cron_heartbeats
ORDER BY last_success_at;
```

**Expected staleness thresholds** (2× the cron interval, give or take):

- `meta-poll`: fila debería tener < 60 min de antigüedad. Si > 90 min → sospechoso. Si > 3h → cron muerto.
- `sync`: fila debería tener < 40 min de antigüedad. Si > 60 min → sospechoso. Si > 2h → cron muerto.

**Qué NO hace v1**:

- No alerta proactivamente. Es solo una fuente de verdad consultable. La v2 de este feature (futuro sprint) será un `pg_cron` que cada 10 min revise `cron_heartbeats`, detecte staleness, y dispare una notificación al bot de Telegram vía la infra ya existente. Cuando se añada, el schema de esta tabla no necesita cambios.
- No registra runs fallidos. El heartbeat es write-on-success — la ausencia es la señal. Es intencional: si registramos también los fallos, la tabla crece y pierde su propiedad clave ("una fila por job, la más reciente gana").
- No aparece en la observabilidad nativa de Vercel. Ese sigue siendo el gap del Issue 2.

---

## Historial de auditorías

- [2026-04-12 — Meta coverage audit](../superpowers/specs/2026-04-12-meta-coverage-audit.md) — audit completo del meta-poll con datos reales de producción (battles per map, cursor distribution, source breakdown). Las conclusiones de ese audit informan la mayoría del contenido de este documento.

---

## FAQ

### ¿Puedo añadir un nuevo cron?

Sí, pero **elige el tier correcto**. Consulta la [tabla de decisión](#qué-tier-usar-para-un-cron-nuevo) más abajo.

### ¿Qué tier usar para un cron nuevo?

| Caso de uso | Tier recomendado | Razón |
|---|---|---|
| Cleanup/aggregation puro SQL, cualquier frecuencia | **pg_cron** | Atómico con la DB, sin overhead HTTP, free tier de Supabase sin límites prácticos |
| Call HTTP endpoint, 1 invocación/día y estamos en Hobby | **Vercel Cron** | La única frecuencia que Hobby garantiza. Observabilidad nativa |
| Call HTTP endpoint, más de 1/día y estamos en Hobby | **pg_cron + `net.http_post`** | Evita upgrade de plan. Observabilidad vía `cron.job_run_details` |
| Call HTTP endpoint, cualquier frecuencia, Pro | **Vercel Cron** | Observabilidad central, zero dependencia externa |
| Job existente ya funcionando y queremos minimizar cambio | **Mantener donde está** | YAGNI hasta que haya razón |
| Necesitamos ejecutar en máquina fuera de Vercel/Supabase | **VPS crontab** | Opción menos observable; añadir healthchecks.io es obligatorio |

### ¿Puedo testear un cron localmente?

Sí, llamando al endpoint directamente:

```bash
# Desde scripts (usa .env.local):
curl -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
     http://localhost:3000/api/cron/meta-poll

# O con un dev server activo:
npm run dev
# en otra terminal:
curl -H "Authorization: Bearer <valor-de-.env.local>" \
     http://localhost:3000/api/cron/meta-poll
```

Ver el JSON de respuesta del endpoint te dice cuántos players procesó, cuántos errors, cuántas keys agregó. Es la mejor forma de verificar cambios de código antes de deploy.

### ¿Por qué tenemos 3 tiers y no 1?

Histórico, y **cada decisión fue correcta en su momento**:

1. Los primeros crons HTTP nacieron en el VPS Oracle porque Vercel Cron en plan Hobby limitaba a **1 invocación por día**, y tanto el sync (cada 20 min) como el meta-poll (cada 30 min) necesitan mucha más frecuencia. Oracle Cloud free tier permite `crontab` con cualquier schedule. **Fue la decisión económicamente correcta dado el plan**.
2. Después se añadió `pg_cron` para los jobs SQL-puros que no necesitaban pasar por HTTP (`enqueue-premium-syncs`, `cleanup-anonymous-visits`). Viven mejor en la DB y `pg_cron` en Supabase free tier no tiene límites de frecuencia prácticos.
3. Después apareció `vercel.json` con cron config y se añadió `/api/cron/sync` diario para tener "algo" en Vercel Cron visible desde el dashboard, sin quitar el del VPS (el del VPS sigue siendo el que hace el trabajo real).

**No es un diseño accidental**, es la **respuesta correcta a constraints históricos de coste**. Hay algo de deuda técnica (la redundancia del sync endpoint, ver Issue 1) pero el uso multi-tier en sí mismo no es el problema — es una consecuencia de optimizar por coste en plan free.

**Cuándo reconsiderar**: si BrawlVision upgrades a Vercel Pro por otra razón (más function hours, edge config, etc.), entonces tiene sentido consolidar los cron HTTP en Vercel Cron y apagar el VPS. Hasta entonces, el multi-tier es la configuración correcta.

### ¿Hay un plan para consolidar?

Parcialmente. Hay mejoras posibles **sin consolidar** los 3 tiers, y otras que **requieren consolidar** (las cuales dependen de un upgrade de plan o cambio de arquitectura).

**Mejoras viables sin upgrade de plan (recomendadas)**:

1. **Añadir healthchecks.io al VPS cron** (1 hora). Dos ping URLs nuevos, se ponen al final de las dos líneas del crontab. Resuelve el "silent failure" del VPS.
2. **Quitar la redundancia del sync endpoint** (15 min). Elegir: o eliminar la entrada de `vercel.json`, o eliminar la línea del crontab del VPS. El VPS lo llama 72 veces/día, Vercel 1 vez/día; el Vercel diario es puro ruido. Eliminar del `vercel.json`.
3. **Realinear `pg_cron` con el repo** (1 sprint). Crear migración `011_pg_cron_realign.sql` que refleje el estado real de producción (ver Issue 3).

**Consolidaciones que requieren upgrade a Vercel Pro**:

4. Migrar `/api/cron/sync` y `/api/cron/meta-poll` del VPS a Vercel Cron, apagar el VPS.

**Consolidaciones viables con `pg_cron + pg_net`** (sin upgrade):

5. Migrar `/api/cron/meta-poll` del VPS a `pg_cron` con `net.http_post`. Más complejo pero deja el cron observable desde el bot Telegram sin coste extra.

La **recomendación inmediata** son los pasos 1, 2, 3 (todos sin coste ni upgrade). El paso 4 solo tiene sentido si ya se upgrade a Pro por otros motivos. El paso 5 es un sprint dedicado si se valora mucho la observabilidad centralizada de los crons HTTP.

### Archivo a largo plazo de `meta_stats` (roadmap)

Sprint F estableció el invariante "nunca borrar datos", pero la ventana rodante de 14/28 días significa que las lecturas **ignoran** filas viejas aunque físicamente siguen en la tabla. Con el tiempo, `meta_stats` acumula muchas filas que ninguna query lee, lo cual crecerá sin límite y eventualmente degradará índices.

La propuesta (task formal pendiente) es una tabla `meta_stats_archive` con granularidad más gruesa (agregados semanales o mensuales por `map + mode + brawler_id`) poblada por un cron semanal que copia las filas de `meta_stats` que están a punto de salir de la ventana caliente, y un segundo paso que las borra de `meta_stats` **solo después** de haberse copiado con éxito. De esa manera:

- La tabla caliente (`meta_stats`) se mantiene acotada a ~30-60 días.
- La tabla histórica (`meta_stats_archive`) preserva toda la historia con granularidad semanal — datos de temporadas pasadas siguen disponibles para analytics cross-season, comparativas pre/post balance patch, etc.
- Nunca se pierde un dato: antes de borrar en `meta_stats`, hay que haber escrito en `meta_stats_archive`. Transacción atómica.

**Estado**: diseño pendiente (no urgente — `meta_stats` actual son ~80k filas, margen de sobra antes de que importe). Ver task superpowers para el spec completo cuando se priorice.

Referencia: [audit de 2026-04-12](../superpowers/specs/2026-04-12-meta-coverage-audit.md).
