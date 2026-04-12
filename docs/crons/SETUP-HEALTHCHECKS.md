# Monitoring del VPS cron con healthchecks.io

> **Prerequisito**: rotar el `CRON_SECRET` primero. No hagas SSH al VPS para ejecutar los cambios de este doc hasta después de la rotación, porque cualquier `crontab -l` nuevo añade el secret actual (comprometido) a `/var/log/syslog` otra vez.
>
> **Objetivo**: conseguir que si el VPS o cualquiera de sus dos crons (sync / meta-poll) deja de ejecutarse, te llegue un email/Telegram/Slack en minutos, en vez de enterarte al día siguiente cuando mires los datos.

## Por qué healthchecks.io

[healthchecks.io](https://healthchecks.io) es un servicio SaaS gratuito para monitorizar cron jobs con el patrón "dead man's switch":

1. Creas un "check" en el dashboard, obtienes una URL tipo `https://hc-ping.com/<uuid>`
2. Configuras tu cron con un grace period (ej. "expected every 30 min, notify if 35 min pass without a ping")
3. Al final de cada ejecución del cron, haces un `curl` a la ping URL
4. Si el cron deja de pingar durante más tiempo que el grace period, healthchecks.io te notifica por email/Slack/Telegram/Discord/etc.

Free tier: 20 checks simultáneos. Nosotros necesitamos 2 (sync + meta-poll). Sobra espacio para añadir más en el futuro.

Alternativa técnica equivalente: [Cronitor](https://cronitor.io/), [Better Uptime](https://betteruptime.com/), [UptimeRobot Cron Jobs](https://uptimerobot.com/). Todos funcionan igual. Uso healthchecks.io como default porque es el más usado y su free tier es el más generoso.

## Parte 1 — Configurar los checks en healthchecks.io

Esto se hace en la web, no en el VPS. 10 minutos.

1. Ve a [healthchecks.io/signup](https://healthchecks.io/signup) y crea cuenta con tu email.
2. Una vez dentro, click en **Add Check** (arriba a la derecha).
3. Configura el primer check:
   - **Name**: `brawlvision-sync`
   - **Period**: `20 minutes` (lo que dice `*/20 * * * *`)
   - **Grace Time**: `5 minutes` (tolerancia; si no pinga en 25 min, notifica)
   - **Description**: `VPS cron /api/cron/sync — syncs battles from Supercell for premium users`
   - Click **Save**
4. Te lleva a la pantalla del check. Copia la **ping URL** (algo como `https://hc-ping.com/a1b2c3d4-...`). Guárdala con el nombre `HC_SYNC`.
5. Click en **Add Check** otra vez para el segundo:
   - **Name**: `brawlvision-meta-poll`
   - **Period**: `30 minutes`
   - **Grace Time**: `10 minutes` (más holgura porque el meta-poll puede tardar ~80s en completar)
   - **Description**: `VPS cron /api/cron/meta-poll — polls top 200 global players for meta_stats aggregation`
   - Click **Save**
   - Copia su ping URL como `HC_META_POLL`.
6. Configura las notificaciones. En la barra lateral izquierda de healthchecks.io, click en **Integrations**:
   - **Opción recomendada**: añadir **Telegram** (ya tienes el bot configurado para BrawlVision). Sigue el flujo de Telegram integration → apuntará tu bot existente o uno nuevo. Con eso, cuando un check falle, te llega mensaje directo al chat.
   - **Alternativa**: email (gratis, ya configurado por default con tu cuenta).
   - **Opcional**: Slack/Discord si tienes.
7. Asegúrate que **ambos checks** están asignados al canal de notificación. En cada check: **Details** → **Integrations** → check que tu integration está marcada.

## Parte 2 — Añadir los pings al crontab del VPS

**Hacer solo tras rotar el `CRON_SECRET`**. La rotación es requisito porque vamos a tocar las líneas del crontab que contienen el Bearer token, y queremos que cualquier output del crontab que acabe en logs contenga el secret nuevo, no el comprometido.

### Procedimiento (SSH al VPS)

```bash
ssh -i "<path-to-ssh-key>" ubuntu@141.253.197.60
```

Una vez dentro, ejecuta este comando exacto (reemplaza `<HC_SYNC>` y `<HC_META_POLL>` por las URLs que copiaste):

```bash
# Variables locales con las URLs de healthchecks.io
HC_SYNC="https://hc-ping.com/<uuid-del-sync>"
HC_META_POLL="https://hc-ping.com/<uuid-del-meta-poll>"

# Backup del crontab actual por si algo va mal
crontab -l > ~/crontab-backup-$(date +%Y%m%d-%H%M).txt

# Reemplazar las líneas existentes añadiendo el ping al final de cada una
crontab -l | sed \
  -e "s|\(https://www\.brawlvision\.com/api/cron/sync\) > /dev/null 2>&1|\1 > /dev/null 2>&1 \&\& curl -fsS -m 5 --retry 3 $HC_SYNC > /dev/null|" \
  -e "s|\(https://www\.brawlvision\.com/api/cron/meta-poll\) >> /tmp/meta-poll.log 2>&1|\1 >> /tmp/meta-poll.log 2>&1 \&\& curl -fsS -m 5 --retry 3 $HC_META_POLL > /dev/null|" \
  | crontab -

# Verificar visualmente — NUEVA línea debería terminar con el ping de hc-ping.com
crontab -l
```

Cada línea nueva debería tener este formato:

```
*/20 * * * * curl -s -H "Authorization: Bearer XXX" https://www.brawlvision.com/api/cron/sync > /dev/null 2>&1 && curl -fsS -m 5 --retry 3 https://hc-ping.com/<uuid-sync> > /dev/null

*/30 * * * * curl -s -H "Authorization: Bearer XXX" https://www.brawlvision.com/api/cron/meta-poll >> /tmp/meta-poll.log 2>&1 && curl -fsS -m 5 --retry 3 https://hc-ping.com/<uuid-meta-poll> > /dev/null
```

### Qué hace cada flag de `curl`

- `-fsS` = fail on HTTP error, silent mode but still show errors
- `-m 5` = max timeout 5 segundos (el ping debe ser instantáneo)
- `-r 3` = retry hasta 3 veces si falla

### Semántica importante del `&&`

El `&&` significa "solo si el primer curl (al endpoint de BrawlVision) termina con exit code 0, haz el segundo (el ping a healthchecks.io)". Es la semántica correcta: **solo pingas healthchecks.io si el cron funcionó de verdad**. Si BrawlVision devuelve 500, el primer curl falla, `&&` no se evalúa, y el ping no se hace. Healthchecks.io detecta la ausencia de ping tras el grace period y notifica.

Si quisieras **siempre** pingar (incluso si falla) usarías `;` en vez de `&&`. Pero entonces tendrías que usar el modo "start/success/fail" de healthchecks.io (ping URLs distintas para cada estado) que es más complejo. La semántica "solo éxito" es suficiente para este caso.

### Verificar que funciona

Tras aplicar los cambios:

1. **Espera 1 ciclo del cron**. El sync es cada 20 min, así que como mucho 20 min de espera.
2. Ve al dashboard de healthchecks.io. Los dos checks deberían mostrarse como **"up"** (verde).
3. Click en el check → **Pings** tab → deberías ver un ping reciente con timestamp.
4. Si alguno no pinga, debugging:
   - `tail -20 /var/log/syslog | grep CRON` para ver si el cron corrió
   - `tail -50 /tmp/meta-poll.log` para ver output del endpoint
   - Copia manualmente la línea completa del crontab y ejecútala en la terminal SSH para ver si da error

### Testear sin esperar

Si no quieres esperar 20 min, fuerza una ejecución inmediata para validar:

```bash
# Copia la línea del sync cron y ejecutala manualmente
curl -s -H "Authorization: Bearer $CRON_SECRET_VIEJO" https://www.brawlvision.com/api/cron/sync > /dev/null 2>&1 && curl -fsS -m 5 --retry 3 "$HC_SYNC"
```

Si ves "OK" o nada (silencioso en éxito), el ping llegó. El check en el dashboard pasa a verde en ~1 segundo.

## Parte 3 — Qué pasa cuando un cron falla

Escenarios que healthchecks.io va a detectar:

| Fallo | Detectado? | Cómo |
|---|---|---|
| VPS apagado (Oracle Cloud caída, reboot) | ✅ | No pinga → grace period pasa → notify |
| Cron daemon caído | ✅ | No pinga → notify |
| Línea del crontab mal formada | ✅ | cron no ejecuta → no pinga → notify |
| curl a BrawlVision devuelve 401/500 | ✅ | `&&` no se evalúa → no pinga → notify |
| Endpoint BrawlVision tarda más del timeout (si lo hubiera) | ✅ | Exit code no-cero → no pinga → notify |
| Supabase caído, el endpoint devuelve 500 | ✅ | Igual que arriba |
| **`/api/cron/meta-poll` devuelve 200 pero procesa 0 batallas** | ❌ | Desde healthchecks.io no se puede distinguir "funcionó pero no hay datos" de "funcionó y hay datos". Para esto, necesitas monitoring adicional a nivel de DB (ver abajo) |

### Monitoring a nivel de DB (futura mejora)

Healthchecks.io detecta si el cron corrió, no si los datos del cron son válidos. Para detectar "el cron corre pero los datos no llegan" necesitas un monitoreo distinto. Opciones:

- **Cron separado** que hace `SELECT count(*) FROM meta_stats WHERE date = CURRENT_DATE` cada hora, y si el count no crece durante 2 horas seguidas, pinga healthchecks.io con una URL que notifica. Esto es el "dead man's switch" pero a nivel de datos.
- **Bot Telegram con comando `/cron`** (del Sprint B pending) que incluye en la respuesta un indicador de "freshness de datos": cuántos rows se han insertado en la última hora, cuánto tiempo desde el último insert, etc.

Por ahora, el Sprint B del bot cubre esto mejor que un healthcheck extra. Primero healthchecks.io básico + bot con comandos `/cron` y `/stats` = cubertura completa.

## Parte 4 — Rollback

Si algo va mal tras aplicar los cambios del crontab y quieres volver al estado anterior:

```bash
# El backup lo guardamos en ~/crontab-backup-YYYYMMDD-HHMM.txt al principio
ls -la ~/crontab-backup-*.txt
# Copia el nombre del backup más reciente
crontab ~/crontab-backup-20260412-1800.txt  # ← ejemplo, usa el real
crontab -l  # verifica que volviste al estado anterior
```

## Parte 5 — Checklist final

- [ ] Cuenta creada en healthchecks.io
- [ ] Check `brawlvision-sync` creado, period=20min, grace=5min
- [ ] Check `brawlvision-meta-poll` creado, period=30min, grace=10min
- [ ] Canal de notificación configurado (email / Telegram / Slack) en ambos checks
- [ ] `CRON_SECRET` rotado (requisito previo — ver `docs/crons/README.md#cómo-rotar-procedimiento-detallado`)
- [ ] SSH al VPS con la key Oracle
- [ ] Backup del crontab guardado
- [ ] Pings añadidos a las 2 líneas del crontab
- [ ] Verificado visualmente `crontab -l` — las líneas terminan con `&& curl -fsS ... hc-ping.com/...`
- [ ] Esperado 1 ciclo (20 min) y verificado en healthchecks.io que los 2 checks están verdes
- [ ] Documentado en un issue/changelog del proyecto para que futuros colaboradores sepan que este monitoring existe

## Próximo paso recomendado

Una vez que healthchecks.io esté activo y haya recibido al menos 5 pings sin fallos, considera:

1. **Test de resilencia**: apagar manualmente el cron-daemon del VPS durante 30 min (`sudo systemctl stop cron`). Debería llegar notificación. Reactivar: `sudo systemctl start cron`.
2. **Documentar el escalation path**: cuando llegue una notificación a las 3 AM, ¿qué se hace? Orden de investigación: healthchecks.io dashboard → Vercel function logs → Supabase logs → `tail /tmp/meta-poll.log` en el VPS.
