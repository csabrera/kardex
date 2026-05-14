# Railway Deploy — Runbook

Guía paso a paso para deployar Kardex en Railway. Asume cuenta Railway creada y
repo conectado a GitHub (`csabrera/kardex`).

**URLs actuales (deploy 2026-04-29, vigente):**

- API: `https://kardex-api-production-c442.up.railway.app`
- Web: `https://kardex-web-production.up.railway.app`
- Health (liveness): `https://kardex-api-production-c442.up.railway.app/health/live`

## Arquitectura en Railway

Un proyecto Railway con **4 componentes**:

```
┌──────────────────────────────────────────────────────────────────┐
│ Railway Project: kardex-prod                                     │
│                                                                  │
│  ┌──────────────┐      ┌──────────────┐                          │
│  │ PostgreSQL   │◄─────┤ kardex-api   │◄──── kardex-api.up.railway.app
│  │ (plugin)     │      │ (NestJS)     │                          │
│  └──────────────┘      │ Dockerfile:  │                          │
│                        │ apps/api/    │                          │
│  ┌──────────────┐      │              │                          │
│  │ Redis        │◄─────┤              │                          │
│  │ (plugin)     │      └──────────────┘                          │
│  └──────────────┘                                                │
│                                                                  │
│                        ┌──────────────┐                          │
│                        │ kardex-web   │◄──── kardex-web.up.railway.app
│                        │ (Next.js)    │                          │
│                        │ Dockerfile:  │                          │
│                        │ apps/web/    │                          │
│                        └──────────────┘                          │
└──────────────────────────────────────────────────────────────────┘
```

## Paso 0 — Pre-flight (local)

Antes de empezar:

- ✅ Todo el trabajo commiteado y pusheado a `main` en GitHub
- ✅ Tests verdes localmente (`npm test`)
- ✅ Build verde localmente (`npm run build`)

## Paso 1 — Crear el proyecto Railway

1. Ir a [railway.com](https://railway.com) → **New Project**
2. **Deploy from GitHub repo** → autorizar Railway si aún no → seleccionar `csabrera/kardex`
3. Railway detectará varios servicios potenciales — los configuramos manualmente, así que **cancelar** la auto-detección si pregunta.

## Paso 2 — Plugins de infraestructura

### PostgreSQL

1. En el proyecto: **+ New** → **Database** → **Add PostgreSQL**
2. Railway provisiona la BD y expone la variable `DATABASE_URL` automáticamente.
3. La versión es Postgres 16 — coincide con el desarrollo local.

### Redis

1. **+ New** → **Database** → **Add Redis**
2. Railway expone `REDIS_URL` automáticamente.

## Paso 3 — Servicio `kardex-api`

1. **+ New** → **GitHub Repo** → seleccionar `csabrera/kardex` (mismo repo).
2. Renombrar el servicio a **`kardex-api`** (Settings → Service Name).
3. **Settings → Source**:
   - **Root Directory**: `/` (raíz del repo, NO apps/api)
   - **Watch Paths**: `apps/api/**`, `packages/**`, `package.json`, `package-lock.json`
4. **Settings → Build**:
   - **Config-As-Code Path**: `apps/api/railway.json`
   - Esto aplicará: `dockerfilePath`, `startCommand`, `preDeployCommand` (migrations), `healthcheckPath`.
5. **Settings → Variables**:

   ```
   NODE_ENV=production
   JWT_SECRET=<generar 32+ caracteres aleatorios>
   JWT_REFRESH_SECRET=<generar 32+ caracteres aleatorios — DIFERENTE al anterior>
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d

   # Admin bootstrap (corre 1 vez en seed; si ya está en BD se ignora)
   ADMIN_DOC_TYPE=DNI
   ADMIN_DOC_NUMBER=<DNI del admin inicial>
   ADMIN_PASSWORD=<password inicial — el sistema fuerza cambio en primer login>
   ADMIN_FIRST_NAME=<nombre>
   ADMIN_LAST_NAME=<apellido>
   ADMIN_EMAIL=<email>

   # CORS — apuntar al dominio del web service (se completa después del Paso 4)
   CORS_ORIGIN=https://kardex-web.up.railway.app
   ```

6. **Settings → Variables → Reference**: linkear `DATABASE_URL` desde Postgres y `REDIS_URL` desde Redis (Railway permite usar variables de otros servicios via `${{Postgres.DATABASE_URL}}`).
7. **Settings → Networking → Generate Domain**: Railway genera `kardex-api-production.up.railway.app` (o similar). **Anotar este dominio** — se usa en el web.

## Paso 4 — Servicio `kardex-web`

1. **+ New** → **GitHub Repo** → mismo repo (`csabrera/kardex`).
2. Renombrar a **`kardex-web`**.
3. **Settings → Source**:
   - **Root Directory**: `/`
   - **Watch Paths**: `apps/web/**`, `packages/**`, `package.json`, `package-lock.json`
4. **Settings → Build**:
   - **Config-As-Code Path**: `apps/web/railway.json`
5. **Settings → Variables**:
   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://kardex-api-production.up.railway.app
   ```
   ⚠️ `NEXT_PUBLIC_*` se "hornean" en build time. Si cambia el dominio del API después, hay que **redeploy** el web (build new).
6. **Settings → Networking → Generate Domain**: Railway genera `kardex-web-production.up.railway.app`.
7. **Volver al servicio `kardex-api`** → actualizar `CORS_ORIGIN` con el dominio real del web.

## Paso 5 — Primer deploy

1. Railway dispara el primer build automáticamente al crear los servicios.
2. **Logs del API**: ver que el `preDeployCommand` (`npx prisma migrate deploy`) aplique las 8 migrations.
3. Si falla el seed inicial, correr manualmente desde la consola Railway:
   ```bash
   railway run -s kardex-api npm run prisma:seed
   ```
   O desde la consola web del servicio.
4. **Logs del Web**: ver que Next.js arranque en el `PORT` inyectado.

## Paso 6 — Smoke test

1. Abrir `https://kardex-api-production-c442.up.railway.app/health/live` → debe devolver `{status:'ok', uptime, timestamp}`.
2. Abrir `https://kardex-web-production.up.railway.app` → debe cargar la pantalla de login.
3. Login con el admin sembrado (DNI/password configurados en env vars).
4. El sistema fuerza cambio de password en primer login.
5. Verificar que el dashboard cargue, hub `/almacen-principal` funcione, etc.

## Lecciones del primer deploy (7 bugs + 8 gotchas)

Esta sección documenta los problemas encontrados durante el primer deploy
(2026-04-29) para que no se repitan en deploys futuros o forks del proyecto.

### Bugs encontrados y solucionados

1. **Healthcheck `/health` timeout durante cold start** — el endpoint default
   pinga la BD vía `PrismaHealthIndicator`, que puede demorar más que el
   timeout de Railway durante el arranque. **Fix**: usar `/health/live` (pure
   liveness probe sin DB) en `apps/api/railway.json` → `healthcheckPath`.

2. **Server bindea a `localhost` en lugar de `0.0.0.0`** — el proxy de Railway
   llega al servicio desde fuera del contenedor; con `localhost` el healthcheck
   falla con timeout. **Fix** en `apps/api/src/main.ts`:

   ```ts
   const host =
     process.env.API_HOST ??
     (process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost');
   await app.listen(port, host);
   ```

   ⚠️ Si el schema de `class-validator` tenía `API_HOST = 'localhost'` como
   default fijo, sobreescribe el fallback. Hacer el default condicional ahí
   también.

3. **`apps/web/public/` faltaba en el repo** — Next.js standalone copia
   `public/` al output; el Dockerfile hace `COPY .../public ./public` y falla
   con "failed to compute cache key" si la carpeta no existe. **Fix**: commit
   un `apps/web/public/.gitkeep` para forzar la existencia de la carpeta.

4. **Shared packages no se buildearon antes de la app** — el API importa
   `@kardex/types` (workspace package con `"main": "./dist/index.js"`). Sin
   build previo, el TS compile falla con `TS2307: Cannot find module
'@kardex/types'`. **Fix** en `apps/api/Dockerfile` builder stage:

   ```dockerfile
   RUN npm run build --workspace=@kardex/types --if-present \
    && npm run build --workspace=@kardex/utils --if-present
   RUN npx prisma generate
   RUN npm run build  # nest build
   ```

5. **`NEXT_PUBLIC_API_URL` no actualizaba el bundle** — Next.js inlinea las
   variables `NEXT_PUBLIC_*` en build time. Cambiar la variable en el dashboard
   Railway y hacer "Restart" NO actualiza el bundle. **Fix**: hacer Redeploy
   from Source (rebuild completo), o commit dummy + push.

6. **Setup wizard creaba solo el rol ADMIN sin permissions** → todos los
   endpoints respondían 403 después del primer login. **Fix**: implementar
   `BootstrapService` (`apps/api/src/bootstrap/bootstrap.service.ts`) que
   verifica si hay permissions y siembra el set completo si faltan. Ver
   "Patrón self-healing" abajo.

7. **Migration destructiva (drop de combustible/equipos) corrió sin warning**
   — `prisma migrate deploy` ejecuta lo que está en `migration.sql` aunque
   borre tablas con datos. **Fix preventivo**: revisar SIEMPRE el SQL de
   cualquier migration que toque columnas/tablas existentes antes de pushear
   a `main`. Si hay duda, hacer dump de prod via Railway shell ANTES del push.

### Gotchas operacionales (UI de Railway + Dockerfile)

1. **Raw Editor del tab Variables REEMPLAZA, no añade** — pegar `CORS_ORIGIN=x`
   en Raw Editor borra TODAS las demás variables. Para añadir una variable,
   usar **+ New Variable** (form individual). Raw Editor solo para reset masivo
   con TODAS las variables incluidas.

2. **No existe "Config-As-Code Path" para subcarpetas en algunas versiones de
   la UI** — la doc oficial menciona que Railway lee `railway.json` desde la
   raíz. Para `apps/api/railway.json`, algunas versiones de la UI requieren
   configurar el path explícitamente en Settings → Build. Si ese campo no
   aparece, configurar `dockerfilePath`, `startCommand`, `preDeployCommand`,
   `healthcheckPath` manualmente via UI.

3. **Plugins de BD inyectan `DATABASE_URL` / `REDIS_URL` como references** —
   referenciar como `${{Postgres.DATABASE_URL}}` y `${{Redis.REDIS_URL}}` en
   Variables del servicio API. NO copiar el valor literal (cambia al rotar).

4. **Build context = raíz del repo, no subcarpeta** — con `Root Directory = /`,
   el Dockerfile recibe TODO el repo como contexto. Las paths en `COPY` son
   relativas a la raíz: `COPY apps/api/package.json ./apps/api/`. Esto NO es
   intuitivo viniendo de Dockerfiles single-app.

5. **`tsconfig.json` necesario en runner si corres ts-node** — si
   `Pre-Deploy Command` ejecuta `npm run prisma:seed` que internamente es
   `ts-node prisma/seed.ts`, el runner necesita `tsconfig.json`. Sin él,
   ts-node falla silenciosamente. **Mejor patrón**: evitar ts-node en
   producción, usar BootstrapService (ver abajo).

6. **JWT secrets NO pueden ser references** — generarlos como strings literales
   con:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   64 caracteres base64url-safe. **Importante**: `JWT_SECRET` y
   `JWT_REFRESH_SECRET` deben ser DISTINTOS entre sí (rotar uno no debe
   invalidar el otro).

7. **Cron de `@nestjs/schedule` registra próximo disparo al arrancar el
   proceso** — si el deploy reinicia el API DESPUÉS de la hora del cron, ese
   día no corre. Ejemplo: cron `0 8 * * *` America/Lima, deploy a las 10am
   Lima → próximo disparo es mañana 8am Lima.

   **Implicación**: si se hace un fix urgente al cron y se redepoya pasada la
   hora, esperar al día siguiente o exponer un endpoint admin de trigger manual.

8. **Logs del deploy y del runtime están en pestañas separadas** — para
   diagnosticar errores de arranque ir a **Deploy Logs** y scrollear arriba
   para ver el output de `preDeployCommand` (migrate deploy) + arranque del
   service. **HTTP Logs** y **Metrics** son para runtime estable.

## Patrón self-healing > seed CLI manual

En producción, el flujo "correr seed via Railway CLI" es frágil:

- Railway CLI tiene problemas de compatibilidad (Node 24+ rompe el binario)
- Requiere `railway login` + `railway link` interactivos
- No es reproducible automáticamente
- Si falla, hay que diagnosticar offline

**Solución implementada en Kardex** —
`apps/api/src/bootstrap/bootstrap.service.ts`:

- Implementa `OnApplicationBootstrap` (corre tras arrancar el módulo)
- Verifica si hay permissions, roles, categorías base, unidades base,
  proveedor PRV-EVENTUAL → si faltan, los siembra idempotentemente (`upsert`)
- En arranques posteriores con BD ya sembrada, es no-op
- Si Railway resetea la BD por cualquier razón (purge, migration destructiva),
  el siguiente deploy regenera el esqueleto solo

**Pros**: auto-reparable, no depende de Railway CLI, idempotente.

**Cons**: hay constants duplicadas con `prisma/seed.ts`. Cambios mayores al
catálogo de roles/permissions requieren actualizar AMBOS archivos. Para
catálogos que cambian poco (permissions del proyecto) el trade-off vale.

## Variables de entorno — referencia completa

### `kardex-api`

| Variable                 | Origen               | Notas                                      |
| ------------------------ | -------------------- | ------------------------------------------ |
| `NODE_ENV`               | Manual: `production` | Activa optimizaciones                      |
| `PORT`                   | Auto Railway         | Inyectada en runtime                       |
| `DATABASE_URL`           | Reference Postgres   | `${{Postgres.DATABASE_URL}}`               |
| `REDIS_URL`              | Reference Redis      | `${{Redis.REDIS_URL}}`                     |
| `JWT_SECRET`             | Manual               | 32+ chars aleatorios                       |
| `JWT_REFRESH_SECRET`     | Manual               | 32+ chars aleatorios, distinto al anterior |
| `JWT_EXPIRES_IN`         | Manual: `15m`        |                                            |
| `JWT_REFRESH_EXPIRES_IN` | Manual: `7d`         |                                            |
| `CORS_ORIGIN`            | Manual               | URL completa del web service               |
| `ADMIN_DOC_TYPE`         | Manual: `DNI`        | Para seed inicial                          |
| `ADMIN_DOC_NUMBER`       | Manual               | DNI del admin                              |
| `ADMIN_PASSWORD`         | Manual               | Password inicial                           |
| `ADMIN_FIRST_NAME`       | Manual               |                                            |
| `ADMIN_LAST_NAME`        | Manual               |                                            |
| `ADMIN_EMAIL`            | Manual               |                                            |

### `kardex-web`

| Variable              | Origen               | Notas                                     |
| --------------------- | -------------------- | ----------------------------------------- |
| `NODE_ENV`            | Manual: `production` |                                           |
| `PORT`                | Auto Railway         | Inyectada en runtime                      |
| `NEXT_PUBLIC_API_URL` | Manual               | URL del API service. Se "hornea" en build |

## Migraciones futuras

Cada push a `main` que incluya migrations Prisma nuevas:

1. Railway detecta el cambio (Watch Paths cubren `apps/api/**`).
2. Hace nuevo build del API.
3. **`preDeployCommand`** corre `prisma migrate deploy` ANTES del start.
4. Si la migration falla, el deploy se aborta y la versión vieja sigue corriendo.

## Troubleshooting

### El build falla con "Cannot find module @kardex/types"

Verifica que `Watch Paths` incluya `packages/**`. Si solo escucha `apps/*/**`,
los packages compartidos no triggeran rebuilds y pueden quedar stale. Si el
problema persiste, revisa que el `Dockerfile` haga `npm run build
--workspace=@kardex/types` ANTES de buildear la app (ver bug #4 arriba).

### El API arranca pero el web da CORS error

Verifica que `CORS_ORIGIN` en el API tenga el dominio EXACTO del web (con
`https://`, sin trailing slash). Después de cambiarlo, redeploy el API
(no basta restart — la config se relee en el bootstrap).

### Migrations no se aplicaron

Revisa los logs del deploy del API — el `preDeployCommand` se ejecuta en una
fase aparte. Si falla ahí, el log dice por qué (típicamente: `DATABASE_URL`
mal configurado o migrate file con SQL inválido).

**Verificación rápida sin acceso a Railway**: hit un endpoint protegido sin
auth. Si devuelve 401 (no 500), la BD está conectada y el schema está al día.
Si devuelve 500, probablemente falta alguna columna de la migration pendiente:

```bash
curl -i https://kardex-api-production-c442.up.railway.app/api/alerts
# Esperado: HTTP 401 con body {"error":{"code":"UNAUTHORIZED",...}}
# Mal: HTTP 500 — falta migration
```

### "PORT undefined" en logs del web

Next.js standalone usa `PORT` env var. Asegurate que `start: "next start"`
(sin `-p`) en `apps/web/package.json` — el `-p 3000` HARDCODE el puerto y
rompe en Railway.

### Healthcheck falla con timeout durante cold start

El endpoint default `/health` pinga la BD. Durante el arranque, si Prisma
todavía no estableció el pool de conexiones, el ping puede demorar > 30s y
Railway aborta el deploy. **Fix**: configurar `healthcheckPath: /health/live`
en `apps/api/railway.json` (liveness pura sin DB).

### Login falla con 401 "INVALID_CREDENTIALS" después del primer deploy

El admin sembrado por `BootstrapService` tiene `mustChangePassword=true`. El
primer login debe hacerse vía UI (no API directo), que redirige al flujo de
cambio de password obligatorio. Si seguís intentando login API con el password
del seed después de haber cambiado la pass via UI, devuelve 401.

**Si olvidaste la pass de prod**: usar otro admin con permiso `users:update`
para hacer reset via `PATCH /api/users/:id/reset-password`, o si solo hay un
admin, conectar via Railway shell + `npx prisma studio` para resetear el
`passwordHash` directamente.

### El cron LOAN_VENCIDO no creó alertas hoy

Verificá los logs del API alrededor de las 8:00 America/Lima (13:00 UTC).
Posibles causas:

1. **Deploy hecho DESPUÉS de las 8am Lima del día** — `@nestjs/schedule`
   registra el próximo disparo al arrancar el proceso. Si arrancó a las 10am
   Lima, el próximo disparo es mañana 8am Lima.
2. **El API se reinició entre 7:59 y 8:01 Lima** — ventana de carrera muy
   estrecha; el cron quedó pendiente al siguiente día.
3. **No hay préstamos overdue** — query `status=ACTIVE AND expectedReturnAt <
now`. Verificar con `GET /api/tool-loans/summary` → `data.overdue`.

Para disparar manualmente, exponer un endpoint admin (no incluido por
default — minimiza superficie de ataque):

```ts
@Post('admin/check-overdue')
@RequirePermissions('admin')
async manualTrigger() { return this.cron.checkOverdueLoans(); }
```

### Migration destructiva corrió sin querer

No hay rollback automático. **Recuperación**:

1. Verificar si Railway tiene snapshot reciente (plan Pro tiene backups
   automáticos diarios; Hobby no).
2. Si no hay backup, restaurar manualmente desde dump local más reciente:

   ```bash
   railway run -s kardex-api psql $DATABASE_URL < dump.sql
   ```

**Prevención**: revisar SIEMPRE el `migration.sql` generado antes de pushear.
Las migrations destructivas tienen patrones identificables: `DROP COLUMN`,
`DROP TABLE`, `ALTER TYPE ... DROP VALUE`. Si la migration no es reversible y
puede tener datos, hacer dump prod ANTES del push.

## Costos esperados

Free tier Railway: $5 USD de crédito/mes (suficiente para probar varias semanas con tráfico bajo).

Plan Hobby ($5/mes flat): mejor para uso continuo. Incluye:

- 8 GB RAM total compartido entre todos los servicios
- 100 GB egress/mes
- Postgres + Redis incluidos en el plan

Para cliente real con tráfico moderado, presupuestar Hobby + $5-10 extra de uso = ~$10-15/mes.
