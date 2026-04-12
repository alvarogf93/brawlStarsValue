# Cron Infrastructure — BrawlVision

> **Última actualización**: 2026-04-12 (post-audit de meta coverage)
> **Estado**: documentado con datos reales de producción. Hay drift entre el código del repo y el estado real de los crons en producción — ver [Known Issues](#known-issues-y-drift-detectado).

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
         │ fetchBattlelog(player)                       │ fetchPlayerRankings('global', 200)
         │                                              │ fetchBattlelog(each top player)
         │                                              │
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

### Contenido actual del crontab del `ubuntu` (ofuscado)

```
*/20 * * * * curl -s -H "Authorization: Bearer <CRON_SECRET>" https://www.brawlvision.com/api/cron/sync > /dev/null 2>&1

# Meta polling - every 30 min (50 players per batch)
*/30 * * * * curl -s -H "Authorization: Bearer <CRON_SECRET>" https://www.brawlvision.com/api/cron/meta-poll >> /tmp/meta-poll.log 2>&1
```

> **Nota del comentario "50 players per batch"**: el comentario está **desactualizado**. El commit `561364f` subió el pool a 200 top players. El comentario del crontab nunca se actualizó. Está pendiente de corrección.

### Inventario de los 2 jobs

#### 1. `/api/cron/sync` (VPS)

- **Schedule**: `*/20 * * * *` (cada 20 min, 72 invocaciones/día)
- **Target**: `POST https://www.brawlvision.com/api/cron/sync`
- **Código del endpoint**: `src/app/api/cron/sync/route.ts`
- **Qué hace**: procesa la `sync_queue` de Supabase, llamando a `syncBattles(player_tag)` para cada job pending. Cada `syncBattles` fetchea el battlelog (últimas 25 batallas), las parsea, y hace upsert en `battles` con dedup por `(player_tag, battle_time)`.
- **⚠️ Redundancia**: Vercel Cron también llama a este mismo endpoint diariamente (ver Tier 1). El VPS lo hace 72 veces al día y Vercel 1 vez. Los dos son idempotentes (ON CONFLICT DO NOTHING), así que no causa corrupción de datos, pero es ruido innecesario.

#### 3. `/api/cron/meta-poll`

- **Schedule**: `*/30 * * * *` (cada 30 min, 48 invocaciones/día)
- **Target**: `GET https://www.brawlvision.com/api/cron/meta-poll`
- **Código del endpoint**: `src/app/api/cron/meta-poll/route.ts`
- **Qué hace**:
  1. `fetchPlayerRankings('global', 200)` — top 200 global players de Supercell
  2. Por cada jugador: `fetchBattlelog(tag)` + filtrar batallas posteriores al cursor + filtrar modos draft + filtrar 3v3 con teams completos
  3. Agregar en `meta_stats` (brawler+map+mode+date), `meta_matchups` (brawler vs brawler), `meta_trios` (team comps)
  4. Upsert en `meta_poll_cursors` para dedup en el próximo ciclo
- **Throttle**: delay `META_POLL_DELAY_MS` entre cada player (~200ms probable) para no saturar el proxy
- **Duración estimada**: no medida directamente porque no hay log de start/end del endpoint. Con 200 players × ~200ms delay + ~200ms request time ≈ **80 segundos** en el mejor caso. Cabe sobradamente en los 5 min de `maxDuration`.
- **Output visible en `/tmp/meta-poll.log`** — cada invocación añade el JSON de respuesta del endpoint (`{processed, skipped, errors, battlesProcessed, statKeys, matchupKeys, trioKeys}`)

### Ventajas del VPS cron

- Sin límites de plan (corre gratis cada 30 min en Oracle free tier)
- Independiente de cambios/failures de Vercel
- Logs persistentes en el VPS

### Desventajas

- **No observable desde Vercel** — si el VPS falla, los monitors de Vercel no lo detectan
- **Vive fuera del repo** — el código del crontab no está versionado, un cambio manual se pierde si el VPS se re-instala
- **Single point of failure** — si el Oracle VPS cae, todo el meta-poll y el sync-loop caen sin aviso
- **Secret en texto plano** en el crontab — cualquier persona con acceso SSH ve el `CRON_SECRET`

---

## Gestión del `CRON_SECRET`

### Dónde vive el secret

El mismo valor en **tres sitios**:

1. **Vercel Dashboard** → Project Settings → Environment Variables → `CRON_SECRET` (production scope)
2. **`.env.local`** del desarrollador local (para tests y scripts standalone)
3. **VPS crontab** — inline en el header `Authorization: Bearer <secret>` de cada línea

> **⚠️ Importante**: el `.env.local` del repo está en `.gitignore` (línea `.env*`). **Nunca commitear** un `.env.local` que contenga este secret.

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

**Paso 3 — Actualizar el VPS**:

```bash
ssh -i "<path-to-ssh-key>" ubuntu@141.253.197.60
crontab -e
# en el editor, reemplazar las dos ocurrencias de "Bearer <viejo>" por "Bearer <nuevo>"
# guardar y salir
```

Alternativa sin abrir editor (más segura, evita pasar el secret por el shell prompt):

```bash
ssh -i "<key>" ubuntu@141.253.197.60 << 'EOF'
NEW_SECRET="<pegar-nuevo-aqui>"
crontab -l | sed "s|Bearer [a-f0-9]\\{64\\}|Bearer $NEW_SECRET|g" | crontab -
unset NEW_SECRET
crontab -l | grep Bearer  # verificar (verás el nuevo secret en plano)
EOF
```

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
- Secret en texto plano en el crontab (ver Issue 5)

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

### Issue 4: Comentario obsoleto en el crontab del VPS

**Problema**: la línea del meta-poll tiene el comentario `# Meta polling - every 30 min (50 players per batch)`, pero el pool real es de 200 players (commit `561364f`).

**Impacto**: documentación engañosa. Alguien leyendo el crontab asumirá que el pool es de 50 y puede tomar malas decisiones.

**Recomendación**: actualizar el comentario la próxima vez que editemos el crontab (probablemente durante la rotación de secret o la migración a Vercel Cron).

### Issue 5: `CRON_SECRET` en texto plano en el crontab del VPS

**Problema**: el crontab contiene `Bearer <secret>` en texto plano. Cualquier persona con acceso SSH (o con capacidad de leer `/var/log/syslog`) puede leer el secret.

**Impacto**: si el VPS es comprometido a cualquier nivel de privilegio que permita leer syslog o el home del usuario `ubuntu`, el secret se filtra.

**Mitigación parcial**: poner el secret en un archivo separado con permisos `600` y cargarlo en el cron:

```
# En /home/ubuntu/.brawlvision-env (chmod 600, owner ubuntu:ubuntu)
CRON_SECRET=<secret-aqui>

# En crontab:
*/30 * * * * . /home/ubuntu/.brawlvision-env && curl -s -H "Authorization: Bearer $CRON_SECRET" https://www.brawlvision.com/api/cron/meta-poll >> /tmp/meta-poll.log 2>&1
```

Esto saca el secret de `cron.log` y de los procesos visibles en `ps`, aunque no cambia nada para un atacante con acceso al home del usuario.

**Mitigación total**: migrar el cron fuera del VPS a Vercel Cron (donde el secret vive en env vars cifradas) o a `pg_cron` + `pg_net` (donde el secret vive en un setting de database cifrado). Esto resuelve el Issue 2 y el Issue 5 al mismo tiempo.

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

Referencia: [audit de 2026-04-12](../superpowers/specs/2026-04-12-meta-coverage-audit.md).
