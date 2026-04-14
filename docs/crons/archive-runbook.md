# Runbook — `meta_stats_archive`

> **Última actualización**: 2026-04-14 (Sprint F+ — archive tier introduction)
>
> **Scope**: cómo aplicar por primera vez el archive tier, cómo verificar que sigue vivo, y cómo recuperarte si algo va mal.

---

## Contexto rápido

`meta_stats_archive` es la tabla histórica de largo plazo que complementa la tabla caliente `meta_stats`. Sprint F estableció los invariantes "nunca borrar, nunca decrementar", y este archive permite mantener esos invariantes **a perpetuidad** sin que la hot table crezca sin límite:

- La hot table `meta_stats` queda acotada a **90 días** de datos recientes.
- Cualquier fila más vieja que 90 días se agrega semanalmente (`DATE_TRUNC('week', date)`) y se mueve a `meta_stats_archive`.
- El movimiento es **atómico**: INSERT al archive y DELETE de la hot ocurren en la misma transacción. Si el INSERT falla, el DELETE se revierte. Imposible perder filas.
- La función es **idempotente**: re-ejecutarla no duplica datos (`ON CONFLICT DO UPDATE` suma counts en vez de sobreescribir).
- Nada en la UI ni en el cron meta-poll lee del archive. La hot table sigue siendo la única fuente de verdad para las lecturas operativas (ventana de UI: 14 días; ventana de preload del cron: 28 días). El archive es **lateral** — reservado para futuras features de analytics cross-season.

Ver también: [`docs/crons/README.md#3-apicronmeta-poll-sprint-f-2026-04-14`](README.md) para los invariantes completos del Sprint F, y las migrations:

- `supabase/migrations/018_meta_stats_archive.sql` — schema + función `archive_meta_stats_weekly()`
- `supabase/migrations/019_schedule_archive_cron.sql` — pg_cron semanal (lunes 04:00 UTC)

---

## Primera aplicación (backfill inicial)

Cuando las migrations 018 y 019 se apliquen por primera vez, `meta_stats` ya tiene **~80k filas acumuladas** (estado de producción al 2026-04-14). La mayoría de esas filas tienen `date` más antiguo que 90 días y tendrán que procesarse en la primera invocación de `archive_meta_stats_weekly()`. Puede ser un batch grande (~50k filas) que tarde varios minutos.

**Por seguridad, el backfill inicial se hace MANUALMENTE una sola vez** desde el SQL Editor de Supabase Dashboard, antes de dejar que pg_cron tome el control con la cadencia semanal.

### Procedimiento paso a paso

1. **Aplicar migration 018** en SQL Editor.

   ```sql
   -- Pega el contenido de 018_meta_stats_archive.sql y ejecuta.
   ```

   Verifica que la tabla existe:

   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'meta_stats_archive'
   ORDER BY ordinal_position;
   ```

   Deberías ver las 9 columnas: `brawler_id, map, mode, source, period_start, wins, losses, total, archived_at`.

2. **NO apliques migration 019 todavía**. La activación del cron semanal la dejamos para el final.

3. **Snapshot pre-backfill** — útil para comparar antes y después:

   ```sql
   SELECT
     COUNT(*) AS hot_rows,
     MIN(date) AS oldest_date,
     MAX(date) AS newest_date,
     CURRENT_DATE - INTERVAL '90 days' AS cutoff
   FROM meta_stats;
   ```

   Guarda los números de `hot_rows` y `oldest_date` antes de continuar.

4. **Ejecutar el backfill** (una sola llamada a la función):

   ```sql
   SELECT * FROM archive_meta_stats_weekly();
   ```

   La respuesta es una fila con tres columnas:

   ```
    rows_archived | rows_deleted | cutoff_used
   ---------------+--------------+-------------
             8734 |       49812  |  2026-01-14
   ```

   - `rows_archived` = cuántas filas (unicas) hay ahora en el archive tras el INSERT (es un COUNT del CTE de archived, cuenta cada upsert como 1 aunque existiera ya por idempotencia)
   - `rows_deleted` = cuántas filas se borraron de la hot table
   - `cutoff_used` = la fecha utilizada como corte (date < cutoff_used)

   **El número de `rows_deleted` debe coincidir con `hot_rows` previo MENOS las filas que quedan (las de los últimos 90 días)**. Si no coincide, revisa con la query del paso siguiente.

5. **Verificación post-backfill**:

   ```sql
   -- Hot table debería tener solo filas recientes
   SELECT
     COUNT(*) AS hot_rows_remaining,
     MIN(date) AS oldest_remaining,
     MAX(date) AS newest_remaining
   FROM meta_stats;
   ```

   Espera:
   - `oldest_remaining` >= `CURRENT_DATE - 90 días` (ninguna fila más vieja que el cutoff)
   - `hot_rows_remaining` ≈ 20-40k (90 días × 500-750 filas/día en steady state)

   ```sql
   -- Archive debería tener las filas agregadas semanalmente
   SELECT
     COUNT(*) AS archive_rows,
     COUNT(DISTINCT period_start) AS distinct_weeks,
     MIN(period_start) AS earliest_week,
     MAX(period_start) AS latest_week
   FROM meta_stats_archive;
   ```

   Espera:
   - `distinct_weeks` ≈ ~12-15 (dependiendo de cuántas semanas cubra el histórico pre-backfill)
   - `latest_week` < `CURRENT_DATE - 90 días` (o muy cercano al cutoff — la semana del cutoff puede estar parcialmente incluida si el DATE_TRUNC cae dentro)

6. **Aplicar migration 019** ahora que sabemos que el backfill funcionó:

   ```sql
   -- Pega el contenido de 019_schedule_archive_cron.sql y ejecuta.
   ```

   Al final verás una fila listando el job scheduled:

   ```
    jobid | jobname              | schedule    | active | command
   -------+----------------------+-------------+--------+------------------------------
      42  | archive-meta-stats   | 0 4 * * 1   | t      | SELECT archive_meta_stats_weekly()
   ```

7. **Listo**. A partir del siguiente lunes 04:00 UTC, `pg_cron` ejecutará automáticamente el archive semanal. Cada ejecución solo moverá los ~3500-5000 filas de la semana "saliente" — mucho más rápido que el backfill inicial.

---

## Verificación periódica (mensual, opcional)

Una vez al mes, abre el SQL Editor y corre:

```sql
-- ¿Se está ejecutando el cron semanal?
SELECT
  jobid, jobname,
  status,
  start_time,
  end_time,
  (end_time - start_time) AS duration,
  return_message
FROM cron.job_run_details
WHERE jobname = 'archive-meta-stats'
ORDER BY start_time DESC
LIMIT 5;
```

Espera:
- `status = 'succeeded'` en los últimos 5 runs.
- `duration` típicamente < 30s (después del backfill inicial, cada run mueve pocas filas).
- Última `start_time` dentro de los últimos 7 días.

Si ves fallos (`status = 'failed'` o `return_message` con error), revisa la sección **Recuperación** abajo.

---

## Recuperación — cosas que pueden salir mal y cómo arreglarlas

### Escenario 1: el cron semanal falló una o más veces

**Síntoma**: `cron.job_run_details` muestra runs con `status = 'failed'`.

**Causa probable**: problema transitorio de Supabase (bloqueo en la tabla, out of memory, etc.).

**Fix**: re-ejecuta el archive manualmente desde SQL Editor:

```sql
SELECT * FROM archive_meta_stats_weekly();
```

Por el diseño idempotente (`ON CONFLICT DO UPDATE` suma), no hay riesgo de doble contar. Si el fallo fue después de que la función ya había procesado parcialmente (imposible por ser una transacción atómica, pero por si acaso), la re-ejecución completa lo que faltaba. Si la función no pudo correr en absoluto, la re-ejecución hace el trabajo completo desde cero.

### Escenario 2: la hot table está creciendo más de lo esperado

**Síntoma**: `SELECT COUNT(*) FROM meta_stats` devuelve > 60k filas en estado estacionario.

**Causa probable**: el cron semanal no se ejecutó en varias semanas (VPS down → pg_cron pausado, o el job fue removido accidentalmente).

**Fix**:

```sql
-- 1. ¿Sigue el job programado?
SELECT * FROM cron.job WHERE jobname = 'archive-meta-stats';

-- Si no existe, re-aplicar migration 019.

-- 2. Ejecutar el backfill para recuperarse de las semanas perdidas
SELECT * FROM archive_meta_stats_weekly();
```

### Escenario 3: sospecho que se perdieron datos

**Respiración profunda**. Por diseño, esto es prácticamente imposible: la función `archive_meta_stats_weekly()` usa una transacción única `WITH archived AS (INSERT ...), deleted AS (DELETE ...)` — si cualquier parte falla, la transacción entera hace rollback.

**Verificación de integridad**:

```sql
-- Cuenta total por brawler_id agregando hot + archive
WITH combined AS (
  SELECT brawler_id, map, mode, SUM(total) AS total_battles
  FROM meta_stats
  WHERE source = 'global'
  GROUP BY brawler_id, map, mode
  UNION ALL
  SELECT brawler_id, map, mode, SUM(total) AS total_battles
  FROM meta_stats_archive
  WHERE source = 'global'
  GROUP BY brawler_id, map, mode
)
SELECT brawler_id, map, mode, SUM(total_battles) AS grand_total
FROM combined
GROUP BY brawler_id, map, mode
ORDER BY grand_total DESC
LIMIT 20;
```

Si tienes un snapshot de pre-backfill (ej. desde `.profile-snapshot-*.json` o de alguna query guardada), compara el total por `(brawler_id, map, mode)` antes y después. Deberían coincidir. Si no coinciden, contacta con el archive antes de intentar cualquier recovery.

### Escenario 4: querer cambiar la ventana de retención (ej. de 90 a 60 días)

**No lo hagas en una migration in-place**. La función tiene `INTERVAL '90 days'` hardcoded, y cambiarlo puede dejar filas "en limbo" (ya archivadas pero ahora consideradas dentro de la hot window). Procedimiento correcto:

1. Crear una nueva migration (`020_meta_stats_archive_retention_change.sql`) con el nuevo `INTERVAL`.
2. Ejecutar manualmente el archive con el nuevo cutoff una vez para normalizar.
3. Documentar el cambio en este runbook.

**NUNCA** edites la migration 018 existente — eso rompería la historia del repo y no aplicaría en entornos que ya pasaron la migration original.

---

## Decisión de diseño recapitulada

- **Granularidad: semanal**. Reducción ~7× vs daily. Preserva resolución para detectar el impacto de balance patches dentro de la temporada (que suelen salir cada 2-4 semanas).
- **Retención hot: 90 días**. Estrictamente mayor que `META_POLL_PRELOAD_DAYS = 28` y `META_ROLLING_DAYS = 14`, así que todas las lecturas operacionales encuentran sus datos en la hot table sin necesidad de tocar el archive.
- **Scheduling: pg_cron, lunes 04:00 UTC**. Usa la infraestructura ya existente (sin tener que añadir al VPS ni al `vercel.json`), baja actividad global, sin colisión con otros crons.
- **Invariantes**: transacción atómica, ON CONFLICT ADD (idempotente), archive nunca tiene DELETE ni UPDATE destructivo. Ver el header de migration 018 para la lista completa.

---

## Roadmap del archive (futuras iteraciones posibles)

Estas ideas NO están implementadas hoy — son notas para cuando la necesidad real aparezca:

1. **Vista `meta_stats_full`** que UNION hot + archive para queries analytics que necesiten cross-season. Añadir cuando exista una feature que lo pida.
2. **Compresión secundaria** (archive → archive_monthly tras 1 año). Solo si el archive crece mucho y los queries semanales se vuelven lentos.
3. **API endpoint** `/api/meta/history?since=YYYY-MM-DD` que lee del archive para features de UI históricas. Cuando exista una UI que lo consuma.
4. **Backfill script versionado** en `scripts/dev-local/archive-backfill.sh` para recuperar fácilmente de incidentes. Actualmente el backfill se documenta aquí — suficiente hasta que haya más de un entorno productivo.
