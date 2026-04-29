# Railway Deploy — Runbook

Guía paso a paso para deployar Kardex en Railway. Asume cuenta Railway creada y
repo conectado a GitHub (`csabrera/kardex`).

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

1. Abrir `https://kardex-api-production.up.railway.app/health` → debe devolver JSON con status OK.
2. Abrir `https://kardex-web-production.up.railway.app` → debe cargar la pantalla de login.
3. Login con el admin sembrado (DNI/password configurados en env vars).
4. El sistema fuerza cambio de password en primer login.
5. Verificar que el dashboard cargue, hub `/almacen-principal` funcione, etc.

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

Verifica que `Watch Paths` incluya `packages/**`. Si solo escucha `apps/*/**`, los packages compartidos no triggeran rebuilds y pueden quedar stale.

### El API arranca pero el web da CORS error

Verifica que `CORS_ORIGIN` en el API tenga el dominio EXACTO del web (con `https://`, sin trailing slash). Después de cambiarlo, redeploy el API.

### Migrations no se aplicaron

Revisa los logs del deploy del API — el `preDeployCommand` se ejecuta en una fase aparte. Si falla ahí, el log dice por qué (típicamente: `DATABASE_URL` mal configurado o migrate file con SQL inválido).

### "PORT undefined" en logs del web

Next.js standalone usa `PORT` env var. Asegurate que `start: "next start"` (sin `-p`) en `apps/web/package.json` — el `-p 3000` HARDCODE el puerto y rompe en Railway.

## Costos esperados

Free tier Railway: $5 USD de crédito/mes (suficiente para probar varias semanas con tráfico bajo).

Plan Hobby ($5/mes flat): mejor para uso continuo. Incluye:

- 8 GB RAM total compartido entre todos los servicios
- 100 GB egress/mes
- Postgres + Redis incluidos en el plan

Para cliente real con tráfico moderado, presupuestar Hobby + $5-10 extra de uso = ~$10-15/mes.
