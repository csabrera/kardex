# Plan de Trabajo Refactorizado — Sistema Kardex para Empresa Constructora

> **Stack:** Next.js + NestJS + PostgreSQL (Docker + Railway presentación) · **Tipo:** Aplicación web empresarial multi-almacén · **Idioma:** Español · **Testing:** E2E full coverage con Playwright · **Target:** Railway para presentación cliente

---

## 📊 Status Actual del Proyecto

| Fase | Nombre | Status | Progreso | Inicio | Fin |
|------|--------|--------|----------|--------|-----|
| **0** | Decisiones Arquitectónicas | ✅ **COMPLETA** | 100% | 2026-04-21 | 2026-04-21 |
| **1A** | Setup Docker + Infraestructura | ✅ **COMPLETA** | 100% | 2026-04-21 | 2026-04-21 |
| **1B** | Config Compartida | ✅ **COMPLETA** | 100% | 2026-04-21 | 2026-04-21 |
| **1C** | NestJS + Prisma | 🔄 Siguiente | 0% | - | - |
| **1D** | Next.js + Design System | ⏳ Pendiente | 0% | - | - |
| **1E** | CI/CD + Testing Infra Completa | ⏳ Pendiente | 0% | - | - |
| **2A-2D** | Autenticación | ⏳ Pendiente | 0% | - | - |
| **3A-3B** | Maestros | ⏳ Pendiente | 0% | - | - |
| Resto | Fases 4-8 | ⏳ Pendiente | 0% | - | - |

### Entregables Fase 0 ✅

- [x] 5 ADRs documentados (monorepo, optimistic locking, redis, async pdfs, railway)
- [x] Carpeta structure del monorepo
- [x] Docker Compose con PostgreSQL + Redis + pgAdmin
- [x] .env.example con todas las variables
- [x] README.md con quick start
- [x] CONTRIBUTING.md con convenciones
- [x] testing/README.md con guía Playwright
- [x] Git repo inicializado, primer commit

### Entregables Fase 1A ✅

- [x] package.json (root) con workspaces
- [x] turbo.json con pipeline
- [x] docker-compose.yml funcional
- [x] docker/postgres/init.sql
- [x] .gitignore + .dockerignore
- [x] Estructura de carpetas base (apps, packages, testing, docker, docs/adr)

### Entregables Fase 1B ✅

**packages/tsconfig/:**
- [x] base.json — Config TypeScript estricta base
- [x] nextjs.json — Config para Next.js (JSX, DOM)
- [x] nestjs.json — Config para NestJS (decorators, CJS)

**packages/eslint-config/:**
- [x] base.js — Reglas ESLint + TypeScript + imports
- [x] next.js — Reglas para Next.js + React + a11y
- [x] nest.js — Reglas para NestJS (Node.js, Jest)

**packages/utils/:**
- [x] validators.ts — `validateDocument`, `isValidEmail`, `isStrongPassword`, etc.
- [x] formatters.ts — `formatCurrency`, `formatDate`, `formatMovementCode`, etc.
- [x] Tests con Vitest (validators.spec.ts — 11 casos)
- [x] tsup para build CJS + ESM

**packages/types/:**
- [x] enums/ — DocumentType, UserRole, MovementType, TransferStatus, ItemType, WarehouseType, AlertType, WS_EVENTS (8 archivos)
- [x] entities/ — User, Warehouse, Item, Stock, Movement, Transfer, Category, Unit, Role, Permission
- [x] dto/ — LoginDto, SetupDto, ForgotPasswordDto, CreateMovementDto, PaginationDto
- [x] errors/ — BusinessErrorCode (40+ códigos) + ApiError shape + isApiError guard
- [x] tsup config para build separado por módulo

**Prettier + Husky + lint-staged:**
- [x] .prettierrc — Config consistente (90 cols, single quotes, trailing comma)
- [x] .prettierignore — Ignorar dist, build, lock files
- [x] .lintstagedrc.json — Lint + format en pre-commit
- [x] .husky/pre-commit — Hook para lint-staged
- [x] .husky/commit-msg — Hook para commitlint
- [x] commitlint.config.js — Conventional Commits enforced

**GitHub Actions CI:**
- [x] .github/workflows/ci.yml — Lint + typecheck + build + unit tests
- [x] .github/workflows/e2e-tests.yml — Playwright con PostgreSQL + Redis services

---

## 🎯 Cambios Principales vs Plan Original

| Área | Original | Refactorizado |
|------|----------|---------------|
| **Fases densas** | 8 fases amplias | 10 fases granulares (1A, 1B, 2A, 2B, etc.) |
| **Testing strategy** | Fase 8 (final) | Desde Fase 2, integrado en cada fase |
| **webapp-testing** | No mencionado | E2E de todos los flujos (integrado) |
| **Concurrencia stock** | Vago | Estrategia explícita (optimistic locking) |
| **WebSocket escalabilidad** | No contemplada | Redis adapter (modular para Railway) |
| **PDFs (Puppeteer)** | Síncrono | Async queue (BullMQ + Redis) |
| **Error handling** | Genérico | Catálogo de BusinessErrorCode |
| **Decisiones arquitectónicas** | Implícitas | ADRs explícitos (Architecture Decision Records) |
| **Soft deletes** | Mencionado, no especificado | Implementación clara en schema |
| **Tipos compartidos** | packages/types vago | Estructura clara (entities, dto, enums, errors) |
| **Documentación** | Buena | ADRs + decisiones justificadas |

---

## 1. Arquitectura General (Mejorada)

### 1.1 Diagrama de Arquitectura (Igual que Original)

```
┌──────────────────────────────────────────────────────────────────────┐
│                          USUARIO (Navegador)                         │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTPS  (REST + WebSocket)
                               │
        ┌──────────────────────┴──────────────────────┐
        │                                             │
┌───────▼──────────┐                         ┌────────▼─────────┐
│  apps/web        │    REST (TanStack Q)    │  apps/api        │
│  Next.js 14+     │◄────────────────────────┤  NestJS 10+      │
│  App Router      │                         │  REST + Swagger  │
│  SSR + RSC       │    WebSocket            │  JWT + Guards    │
│  TailwindCSS     │◄────────────────────────┤  Prisma ORM      │
│  shadcn/ui       │    (Socket.IO +         │  class-validator │
│  TanStack Query  │     Redis adapter)      │  Interceptors    │
│  Zustand         │                         │  Socket.IO       │
│  socket.io-client│                         │  Gateway         │
└──────────────────┘                         └────────┬─────────┘
                                                      │
                                    ┌─────────────────┼─────────────────┐
                                    │                 │                 │
                                    ▼                 ▼                 ▼
                          ┌──────────────────┐  ┌─────────────┐  ┌────────────┐
                          │  PostgreSQL 16   │  │ Redis Stack │  │   S3 (PDF/ │
                          │  (Railway Managed│  │  (BullMQ    │  │  Excel     │
                          │   o local dev)   │  │  queues)    │  │  exports)  │
                          └──────────────────┘  └─────────────┘  └────────────┘

  Desarrollo: Docker Compose (web + api + postgres + redis + pgadmin)
  Presentación: Railway (servicios web, api, postgres managed + Redis stack)
```

### 1.2 Nuevas Decisiones Técnicas (Agregadas)

| Decisión | Justificación | Impacto |
|----------|---------------|---------|
| **Optimistic Locking para Stock** | Evita deadlocks en transfers concurrentes; más performante que pessimistic. | Versión field en Stock; validación antes de actualizar. |
| **Redis Adapter Socket.IO (BullMQ)** | Permite múltiples instancias API en Railway; broadcasts entre servidores. | Instancia Redis incluida en Railway (gratuita en algunos planes). |
| **Async Queue para PDFs** | Puppeteer es pesado; no bloquear request. | User ve "PDF en generación"; descarga en 2-3 min. |
| **Catálogo de BusinessErrorCode** | Errores consistentes, localizables en frontend. | Nueva carpeta `common/errors/` en API. |
| **Tipos en packages/types** | Evita importaciones cruzadas web ↔ api. | Estructura clara (entities, dto, enums, errors). |
| **webapp-testing desde Fase 2** | Validar arquitectura y regressions temprano. | Tests E2E en cada fase (fixture data limpio). |
| **Soft Deletes explícito** | Auditoría completa; no perder datos históricos. | Campo `deletedAt` en entidades sensibles. |

---

## 2. Estructura de Carpetas (Con Cambios)

### 2.1 Raíz del Monorepo (Igual que Original, Agregado `/testing`)

```
kardex-constructora/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── types/          # ✨ Estructura clarificada
│   ├── ui/
│   ├── eslint-config/
│   ├── tsconfig/
│   └── utils/
├── docker/
├── railway/
├── docs/
│   ├── adr/            # ✨ NUEVO: Architecture Decision Records
│   ├── architecture.md
│   ├── testing.md      # ✨ NUEVO: Test strategy + fixtures
│   ├── error-codes.md  # ✨ NUEVO: Catálogo de errores
│   └── ...
├── testing/            # ✨ NUEVO: Playwright E2E tests (compartido)
│   ├── fixtures/
│   ├── e2e/
│   ├── helpers/
│   ├── playwright.config.ts
│   └── package.json
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── e2e-tests.yml    # ✨ NUEVO: CI para E2E
│       └── deploy-railway.yml
├── docker-compose.yml
├── docker-compose.dev.yml
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

### 2.2 `packages/types` — Estructura Clarificada

```
packages/types/
├── src/
│   ├── entities/
│   │   ├── user.ts              # User, Role, Permission
│   │   ├── warehouse.ts         # Warehouse, Category, Unit
│   │   ├── item.ts              # Item, Stock
│   │   ├── movement.ts          # Movement, MovementItem
│   │   ├── transfer.ts          # Transfer, TransferItem
│   │   ├── requisition.ts       # Requisition, RequisitionItem
│   │   ├── equipment.ts         # Equipment, Maintenance, FuelDispatch
│   │   ├── worker.ts            # Worker, EPPAssignment
│   │   ├── audit.ts             # AuditLog
│   │   └── alert.ts             # Alert
│   ├── enums/
│   │   ├── document-type.ts     # DNI, CE, PASAPORTE
│   │   ├── movement-type.ts     # ENTRADA, SALIDA, AJUSTE
│   │   ├── transfer-status.ts   # SOLICITADA, APROBADA, EN_TRANSITO, RECIBIDA, etc.
│   │   ├── user-role.ts         # ADMIN, JEFE, ALMACENERO, RESIDENTE
│   │   └── ...
│   ├── dto/
│   │   ├── auth/
│   │   │   ├── login.dto.ts
│   │   │   ├── refresh.dto.ts
│   │   │   ├── setup.dto.ts
│   │   │   └── ...
│   │   ├── user/
│   │   ├── movement/
│   │   ├── transfer/
│   │   └── ...
│   ├── errors/
│   │   ├── business-error-code.ts   # ✨ Enum de errores
│   │   ├── api-error.ts             # Shape de respuesta de error
│   │   └── index.ts
│   ├── constants/
│   │   ├── document-regex.ts        # Validadores documento
│   │   ├── ws-events.ts             # Socket.IO event types
│   │   └── ...
│   └── index.ts
├── README.md
└── package.json
```

### 2.3 `testing/` — Nuevo Workspace (E2E)

```
testing/
├── fixtures/
│   ├── user.fixture.ts              # Crear usuarios de test (Admin, Residente, etc.)
│   ├── warehouse.fixture.ts         # Crear almacenes
│   ├── item.fixture.ts              # Crear ítems con stock
│   ├── movement.fixture.ts          # Crear movimientos
│   └── index.ts
├── helpers/
│   ├── auth.helper.ts               # Login, logout, token refresh
│   ├── api.helper.ts                # Llamadas a API desde E2E
│   ├── db.helper.ts                 # Limpieza de DB antes de tests
│   └── index.ts
├── e2e/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   ├── setup-wizard.spec.ts
│   │   └── password-recovery.spec.ts
│   ├── movements/
│   │   ├── entradas.spec.ts
│   │   ├── salidas.spec.ts
│   │   └── ajustes.spec.ts
│   ├── transfers/
│   │   ├── full-flow.spec.ts        # Solicitud → Aprobación → Envío → Recepción
│   │   └── rejection.spec.ts
│   ├── requisitions/
│   │   └── full-flow.spec.ts
│   ├── equipment/
│   │   ├── fuel-dispatch.spec.ts
│   │   └── maintenance.spec.ts
│   ├── reports/
│   │   └── export.spec.ts
│   └── ...
├── playwright.config.ts
├── package.json
└── README.md
```

### 2.4 `docs/adr/` — Decisiones Arquitectónicas (Nuevas)

```
docs/adr/
├── 0001-monorepo-turborepo.md
├── 0002-login-documenttype-vs-email.md
├── 0003-optimistic-locking-stock.md
├── 0004-socket-io-redis-adapter.md
├── 0005-async-queue-puppeteer.md
├── 0006-soft-deletes-implementation.md
├── 0007-railway-vs-self-hosted.md
└── README.md
```

**Formato ADR estándar:**
```markdown
# ADR-NNNN: Título

## Status
Accepted / Proposed / Deprecated

## Context
Problema que enfrentamos.

## Decision
Qué decidimos y por qué.

## Consequences
Impacto: positivo, negativo, neutral.

## Alternatives Considered
Otras opciones y por qué se descartaron.
```

---

## 3. Modelo de Datos — Cambios Clave

### 3.1 Nuevos Campos / Cambios

**User — Soft Delete + Auditoría:**
```prisma
model User {
  id                  String   @id @default(cuid())
  documentType        String   // DNI, CE, PASAPORTE
  documentNumber      String
  passwordHash        String
  firstName           String
  lastName            String
  email               String?
  phone               String?
  roleId              String
  role                Role     @relation(fields: [roleId], references: [id])
  active              Boolean  @default(true)
  mustChangePassword  Boolean  @default(false)
  lastLoginAt         DateTime?
  deletedAt           DateTime?  // ✨ Soft delete
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  @@unique([documentType, documentNumber, deletedAt])  // Permite reutilizar doc tras borrado
  @@index([deletedAt])  // Para filtrar activos rápido
}
```

**Stock — Optimistic Locking:**
```prisma
model Stock {
  id              String   @id @default(cuid())
  itemId          String
  warehouseId     String
  quantity        Int      @default(0)
  reservedQuantity Int    @default(0)
  version         Int      @default(0)  // ✨ Para optimistic locking
  updatedAt       DateTime @updatedAt
  
  item            Item     @relation(fields: [itemId], references: [id])
  warehouse       Warehouse @relation(fields: [warehouseId], references: [id])
  
  @@unique([itemId, warehouseId])
  @@index([version])  // Para queries de locking
}
```

**Item — Soft Delete:**
```prisma
model Item {
  id              String   @id @default(cuid())
  code            String   @unique
  name            String
  description     String?
  categoryId      String
  unitId          String
  itemType        String   // MATERIAL, HERRAMIENTA, EPP, COMBUSTIBLE, EQUIPO, REPUESTO
  minStock        Int      @default(0)
  maxStock        Int?
  imageUrl        String?
  active          Boolean  @default(true)
  deletedAt       DateTime?  // ✨ Soft delete
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([deletedAt])
  @@index([categoryId, itemType])
}
```

**SystemSetting — Explícito para Feature Flags:**
```prisma
model SystemSetting {
  id          String   @id @default(cuid())
  key         String   @unique  // SETUP_COMPLETED, FEATURES_ENABLED, etc.
  value       String   // JSON-encoded para valores complejos
  description String?
  updatedAt   DateTime @updatedAt
}
```

---

## 4. Plan de Fases Refactorizado

### Cambios en Granularidad:
- **Original:** 8 fases amplias.
- **Refactorizado:** 10 fases granulares + sub-fases (1A, 1B, etc.).
- **Estimaciones:** Referencia para equipo de 3-5 devs; ajustable.

---

## FASE 0 — Decisiones Arquitectónicas (Paralela a Fase 1A)
**Duración:** 3-5 días · **Paralela:** Sí (se puede solapar con Fase 1A)

**Objetivo:** Documentar todas las decisiones clave antes de escribir código.

**Tareas:**
- [ ] Escribir ADRs iniciales (optimistic locking, Redis adapter, async queues, soft deletes)
- [ ] Definir catálogo de BusinessErrorCode (document errors shared)
- [ ] Definir estructura de packages/types
- [ ] Definir convenciones de commits (Conventional Commits)
- [ ] Definir estrategia de branches (main + develop)
- [ ] Definir política de code review (1 approval, CI en verde)
- [ ] Documentar testing strategy (E2E desde Fase 2)

**Entregables:**
- `docs/adr/` carpeta con 5-7 ADRs iniciales
- `docs/error-codes.md` con BusinessErrorCode enum
- `CONTRIBUTING.md` con convenciones

**Criterios de aceptación:**
- Todas las decisiones técnicas documentadas.
- Equipo entiende el porqué de cada decisión.

---

## FASE 1A — Setup Infraestructura Dev Local + Docker
**Duración:** 3-4 días · **Equipo:** 1 dev (DevOps) + 1 dev (Backend supportes)

**Objetivo:** Entorno de desarrollo completo dockerizado.

**Tareas técnicas:**
- [ ] Inicializar monorepo con Turborepo + pnpm workspaces
- [ ] Crear `docker-compose.yml` con servicios: postgres, redis, pgadmin, api (hot-reload), web (hot-reload)
- [ ] Crear `.env.example` en raíz y por app
- [ ] Crear `Dockerfile` de desarrollo para api y web (multi-stage)
- [ ] Crear scripts en `package.json`: `pnpm dev` (levanta todo)
- [ ] Validar que `docker-compose up` arranca completo en <5 min
- [ ] Crear `.dockerignore` y `.gitignore`

**Entregables:** Repo con Docker completo, `pnpm dev` funciona.

**Dependencias:** Fase 0 (para convenciones)

**Criterios de aceptación:**
- `pnpm dev` levanta web (3000), api (4000), postgres, redis, pgadmin en <5 min.
- Hot-reload funciona en ambas apps.
- `docker-compose down -v` limpia todo.

---

## FASE 1B — Monorepo Base + Configuración Compartida
**Duración:** 2-3 días · **Equipo:** 1 dev (Full-stack)

**Objetivo:** Estructura base del monorepo + configuraciones compartidas.

**Tareas técnicas:**
- [ ] Crear `packages/tsconfig/` con configs: base, nextjs, nestjs
- [ ] Crear `packages/eslint-config/` con configs: base, next, nest
- [ ] Crear `packages/utils/` con: date formatters, validators, document-validators
- [ ] Crear `packages/types/` con estructura clara (entities, dto, enums, errors)
- [ ] Configurar `turbo.json` con pipeline (lint, type-check, build, test, e2e)
- [ ] Configurar Prettier (`.prettierrc`) a nivel root
- [ ] Instalar Husky + lint-staged para commits
- [ ] Crear GitHub Actions: `ci.yml` (lint + typecheck + build en cada PR)

**Entregables:** Configuraciones compartidas, CI básico funcionando.

**Dependencias:** Fase 1A

**Criterios de aceptación:**
- Todos los packages usan las mismas ESLint, TypeScript, Prettier configs.
- CI pasa en cada commit.
- Husky previene commits sin lint.

---

## FASE 1C — NestJS + Prisma + DB Setup
**Duración:** 3-4 días · **Equipo:** 1 dev (Backend)

**Objetivo:** Backend skeleton + Prisma + primera migración.

**Tareas técnicas:**
- [ ] Crear `apps/api` con NestJS 10+
- [ ] Instalar Prisma + `@prisma/client`
- [ ] Configurar conexión a PostgreSQL (local en dev)
- [ ] Crear `prisma/schema.prisma` **minimal** (solo User, Role, Permission, SystemSetting — 4 tablas)
- [ ] Ejecutar `prisma migrate dev --name init`
- [ ] Crear `prisma/seed.ts` (vacío por ahora)
- [ ] Instalar Swagger: `@nestjs/swagger`, `swagger-ui-express`
- [ ] Crear main.ts con Swagger en `/docs`
- [ ] Crear app.module.ts con PrismaModule
- [ ] Health check endpoint: `GET /health`

**Entregables:** API skeleton con Swagger, Prisma conectado.

**Dependencias:** Fase 1A, 1B

**Criterios de aceptación:**
- `pnpm dev` levanta API en 4000.
- Swagger accesible en `http://localhost:4000/docs`.
- `prisma migrate dev` funciona sin errores.
- `GET /health` retorna `{ status: 'ok' }`.

---

## FASE 1D — Next.js + Tailwind + shadcn/ui
**Duración:** 2-3 días · **Equipo:** 1 dev (Frontend)

**Objetivo:** Frontend skeleton + design system base.

**Tareas técnicas:**
- [ ] Crear `apps/web` con Next.js 14+, App Router, TypeScript
- [ ] Instalar TailwindCSS + configurar colores base (neutral + accent color)
- [ ] Instalar `next-themes` + ThemeProvider (dark/light mode)
- [ ] Instalar shadcn/ui + Lucide Icons
- [ ] Agregar fuentes: `Inter` (sans) + `JetBrains Mono` (mono) vía `next/font`
- [ ] Crear layout base: `src/app/layout.tsx` con provider global
- [ ] Crear página placeholder: `/` → "Bienvenido a Kardex"
- [ ] Instalar TanStack Query (React Query): `@tanstack/react-query`
- [ ] Crear `QueryProvider` con DevTools
- [ ] Instalar Zustand para estado global
- [ ] Instalar Sonner para toasts

**Entregables:** Web skeleton con design system base.

**Dependencias:** Fase 1A, 1B

**Criterios de aceptación:**
- `pnpm dev` levanta web en 3000.
- Dark mode funciona (toggle en header).
- Tipografía y colores consistentes.
- TanStack Query DevTools accesible en dev.

---

## FASE 1E — CI/CD y Estructura Testing
**Duración:** 2-3 días · **Equipo:** 1 dev (DevOps/QA)

**Objetivo:** Pipeline CI + workspace testing.

**Tareas técnicas:**
- [ ] Crear `testing/` workspace con Playwright
- [ ] Instalar Playwright: `@playwright/test`
- [ ] Crear `playwright.config.ts` con config base (Chrome, Firefox, Safari; headed/headless)
- [ ] Crear `testing/fixtures/` con helpers (auth, API calls, DB cleanup)
- [ ] Crear estructura `testing/e2e/` (carpetas por feature)
- [ ] GitHub Actions: `e2e-tests.yml` (corre tests en cada PR)
- [ ] GitHub Actions: `ci.yml` mejorado (lint + typecheck + build + e2e)
- [ ] Documentar `testing/README.md` con instrucciones de cómo correr tests
- [ ] Crear `.gitignore` para test artifacts (`test-results/`, `blob-report/`)

**Entregables:** CI/CD con E2E, testing workspace ready.

**Dependencias:** Fase 1A, 1B, 1C, 1D

**Criterios de aceptación:**
- CI pasa en verde en cada PR.
- E2E tests corren en GitHub Actions (aunque están vacíos).
- `pnpm test:e2e` corre tests localmente.

---

## FASE 2A — Autenticación Core (Login, JWT, Refresh)
**Duración:** 3-4 días · **Equipo:** 1 dev (Backend)

**Tareas técnicas:**
- [ ] Modelar `User`, `Role`, `Permission` en Prisma (actualizar schema)
- [ ] Migración: `prisma migrate dev --name add_auth_tables`
- [ ] Módulo `auth`: login, refresh, logout
- [ ] Hash de passwords con bcrypt (cost 12)
- [ ] JWT strategy (access 15 min, refresh 7 días httpOnly cookie)
- [ ] DTO `LoginDto` con validaciones: `documentType`, `documentNumber`, `password`
- [ ] Endpoint `POST /auth/login` — retorna accessToken + user data
- [ ] Endpoint `POST /auth/refresh` — refresca token
- [ ] Endpoint `POST /auth/logout` — limpia cookie
- [ ] **Tests unitarios:** bcrypt, JWT generation/validation (>70% cobertura auth)
- [ ] **Tests de integración:** login happy path + invalid credentials

**Entregables:** Auth funcional, tests cobertura.

**Dependencias:** Fase 1C

**Criterios de aceptación:**
- `POST /auth/login` con DNI válido + password correcto retorna accessToken.
- `POST /auth/login` con DNI inválido rechaza en validación (no consulta DB).
- `POST /auth/refresh` refresca sin re-loguearse.
- Tests automatizados pasan.

**Testing (webapp-testing):**
- [ ] E2E: Login con DNI válido (fixture user creado en DB).
- [ ] E2E: Login con credenciales inválidas → error visible.
- [ ] E2E: Logout limpia token.

---

## FASE 2B — Validación de Documento + Recuperación de Contraseña
**Duración:** 2-3 días · **Equipo:** 1 dev (Backend) + 1 dev (Frontend)

**Tareas técnicas — Backend:**
- [ ] Validador custom de documentos: `DocumentValidator`
  - DNI: `^\d{8}$`
  - CE: `^\d{9}$`
  - PASAPORTE: `^[A-Z0-9]{6,12}$`
- [ ] Índice único compuesto: `(documentType, documentNumber, deletedAt)`
- [ ] Endpoint `POST /auth/forgot-password` (público) → genera token + lo retorna (en dev)
- [ ] Endpoint `POST /auth/reset-password/:token` (público) → valida token + reset
- [ ] Tokens de reset: hashados en DB, single-use, 1 hora de expiry
- [ ] Documentación: `docs/auth-flow.md` con diagrama

**Tareas técnicas — Frontend:**
- [ ] Página `/login`: `<Select>` tipo doc + `<Input>` número (máscara dinámica) + password
- [ ] Hook `useDocumentType()` que cambia máscara según tipo seleccionado
- [ ] Validación Zod en frontend espejando backend (`packages/utils/document-validators.ts`)
- [ ] Página `/recuperar-password` (paso 1: pedir email/documento)
- [ ] Página `/reset-password/[token]` (paso 2: nueva password)
- [ ] API client con axios + interceptores: refresh automático en 401

**Entregables:** Auth completo + frontend.

**Dependencias:** Fase 2A

**Criterios de aceptación:**
- DNI de 7 dígitos falla validación antes de hacer request.
- Recuperación de password funciona end-to-end.
- Token expirado rechaza reset.

**Testing:**
- [ ] E2E: Login con CE (9 dígitos) debe funcionar.
- [ ] E2E: Recuperar password → reset → login con nueva password.

---

## FASE 2C — RBAC (Guards, Decoradores, Seed)
**Duración:** 3-4 días · **Equipo:** 1 dev (Backend)

**Tareas técnicas:**
- [ ] Guards: `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `WarehouseScopeGuard`
- [ ] Decoradores: `@Public()`, `@Roles()`, `@Permissions()`, `@CurrentUser()`, `@WarehouseScopes()`
- [ ] Seed de roles: ADMIN, JEFE, ALMACENERO, RESIDENTE
- [ ] Seed de permisos: 50+ granulares (users:create, movements:edit, etc.)
- [ ] Seed de RolePermission: asignaciones por rol
- [ ] Endpoint `GET /permissions` → lista todos los permisos (para validaciones frontend)
- [ ] Modelo `AuditLog` + Interceptor de auditoría (acción, recurso, changes JSON, IP, userAgent)
- [ ] Tests: permisos por rol (admin ve todo, almacenero solo su almacén)

**Entregables:** RBAC funcional, auditoria activa.

**Dependencias:** Fase 2A, 2B

**Criterios de aceptación:**
- Un usuario ALMACENERO no puede acceder a `DELETE /users`.
- Un usuario RESIDENTE solo ve su obra en almacenes.
- Cada acción sensible genera log en AuditLog.

**Testing:**
- [ ] E2E: Admin crea usuario, residente no puede.
- [ ] E2E: Residente intenta acceder a ruta prohibida → 403.

---

## FASE 2D — Setup Wizard + Bootstrap del Primer Admin
**Duración:** 2-3 días · **Equipo:** 1 dev (Backend) + 1 dev (Frontend)

**Tareas técnicas — Backend:**
- [ ] Endpoint `GET /auth/setup-status` → `{ setupCompleted: boolean }`
- [ ] Endpoint `POST /auth/setup` (público, bloqueado si setupCompleted=true)
  - Crea primer Admin con `mustChangePassword = true`
  - Marca `SystemSetting.SETUP_COMPLETED = true`
- [ ] Seed automático (`prisma/seed.ts`):
  - Si variables `ADMIN_DOC_TYPE`, `ADMIN_DOC_NUMBER`, `ADMIN_PASSWORD` → crea Admin
  - Marca SETUP_COMPLETED = true
  - Si no → deja abierto para wizard
- [ ] Endpoint `POST /auth/change-password` (requiere accessToken + old password)

**Tareas técnicas — Frontend:**
- [ ] Página `/setup`: wizard de 1 paso (tipo doc + número + nombres + password + confirmar)
- [ ] Middleware Next.js: redirige a `/setup` si setupCompleted=false
- [ ] Si setupCompleted=true, redirige de `/setup` a `/login`
- [ ] Cambio de password obligatorio: pantalla modal que no se puede cerrar si `mustChangePassword=true`

**Entregables:** Primer admin creable por seed O wizard.

**Dependencias:** Fase 2C

**Criterios de aceptación:**
- Si levanto con `ADMIN_*` definidos, primer login fuerza cambio de password.
- Si levanto sin `ADMIN_*`, primera visita va a `/setup`.
- Tras crear admin, `/setup` retorna 403.

**Testing:**
- [ ] E2E: Flujo seed (variables definidas) → login → cambio password forzado.
- [ ] E2E: Flujo wizard (sin variables) → `/setup` → crear admin → login.

---

## FASE 3A — Maestros Base (Almacenes, Categorías, Unidades, Ítems)
**Duración:** 4-5 días · **Equipo:** 1 dev (Backend) + 1 dev (Frontend)

**Tareas técnicas — Backend:**
- [ ] Modelar `Warehouse`, `Category`, `Unit`, `Item` en Prisma (actualizar schema)
- [ ] Migración: `prisma migrate dev --name add_masters`
- [ ] Módulo `warehouses`: CRUD + asignación de jefe + validaciones
- [ ] Módulo `categories`: CRUD con soporte jerárquico (parentId auto-reference)
- [ ] Módulo `units`: CRUD, seed de unidades comunes (KG, M, UND, GAL, L, cm, etc.)
- [ ] Módulo `items`: CRUD, búsqueda avanzada (por código, nombre, categoría, tipo), paginación
- [ ] Stock inicial al crear ítem: `Stock` creation por cada warehouse
- [ ] Tests: CRUD básico, validaciones, índices de búsqueda

**Tareas técnicas — Frontend:**
- [ ] Páginas CRUD: almacenes, categorías, unidades, ítems (listado + detalle + formularios)
- [ ] Componente genérico `<DataTable>` con TanStack Table v8: paginación, sort, filtros, column visibility
- [ ] Formularios con React Hook Form + Zod schemas (compartidos con backend type-checking)
- [ ] Upload de imágenes de ítems: local filesystem en dev (volumen Docker), preparado para S3 en prod
- [ ] Búsqueda con debounce

**Entregables:** Maestros CRUD funcionales.

**Dependencias:** Fase 2D

**Criterios de aceptación:**
- Se pueden crear almacenes tipo CENTRAL y OBRA.
- Categorías soportan padre/hijo.
- Ítem tiene código autogenerado único.
- DataTable ordena, filtra, pagina.

**Testing:**
- [ ] E2E: Admin crea categoría → ítem en esa categoría → aparece en listado.
- [ ] E2E: Búsqueda con filtro de categoría funciona.

---

## FASE 3B — Importación Masiva de Ítems
**Duración:** 2-3 días · **Equipo:** 1 dev (Backend) + 1 dev (Frontend)

**Tareas técnicas — Backend:**
- [ ] Endpoint `POST /items/import` con validaciones:
  - Parsea Excel (ExcelJS)
  - Valida cada fila (código único, categoría existe, etc.)
  - Retorna preview con errores **antes** de commit
  - Si usuario confirma, inserta en batch (transacción)
- [ ] Formato de Excel esperado: columnas fijas (código, nombre, categoría, unidad, minStock, maxStock)
- [ ] Tests: archivo inválido, duplicados, datos faltantes

**Tareas técnicas — Frontend:**
- [ ] Página `/items/nuevo` con pestaña "Importar desde Excel"
- [ ] Componente `<ExcelUploadForm>`: file input + preview table + validación visual
- [ ] Preview muestra errores en rojo, datos válidos en verde
- [ ] Botón "Confirmar importación" tras revisar

**Entregables:** Importación masiva funcional.

**Dependencias:** Fase 3A

**Criterios de aceptación:**
- Excel con 100 ítems válidos importa en <5 seg.
- Errores detectados antes de DB commit.
- Transacción rollback si error en inserción.

**Testing:**
- [ ] E2E: Upload Excel válido → preview → confirmar → ítems en DB.
- [ ] E2E: Excel con duplicados rechaza (error visible).

---

## FASE 4A — Stock + Movimientos Básicos (Entradas/Salidas/Ajustes)
**Duración:** 4-5 días · **Equipo:** 1 dev (Backend) + 1 dev (Frontend)

**Tareas técnicas — Backend:**
- [ ] Modelar `Stock`, `Movement`, `MovementItem` en Prisma
- [ ] Migración: `prisma migrate dev --name add_movements`
- [ ] Módulo `stock`: consulta por almacén, por ítem, consolidado
- [ ] Módulo `movements`:
  - Crear movimiento con validaciones:
    - **Optimistic locking:** validar versión de Stock antes de actualizar
    - No permitir stock negativo en salidas
    - Transacción atómica: crear Movement + MovementItem + actualizar Stock
  - Códigos automáticos: ENT-00001, SAL-00001, AJU-00001 (secuencial)
  - Tipos: ENTRADA, SALIDA, AJUSTE
  - SourceType: COMPRA, CONSUMO, TRANSFERENCIA, AJUSTE, DEVOLUCION, BAJA
- [ ] Módulo `alerts`: crear alert si stock cae bajo mínimo (hook post-movimiento)
- [ ] Tests: transacciones, locking, validaciones, kardex correcto

**Tareas técnicas — Frontend:**
- [ ] Páginas: Entradas (nueva), Salidas (nueva), Ajustes
- [ ] Formularios con selector múltiple de ítems + autocomplete con debounce
- [ ] Vista de kardex detallado por ítem: tabla con columns (fecha, tipo, cantidad, saldo, notas)
- [ ] Gráfica de evolución de stock (Recharts line chart)
- [ ] Exportación Excel (ExcelJS) + PDF (Puppeteer con template HTML)

**Entregables:** Movimientos + kardex + alertas funcionales.

**Dependencias:** Fase 3B

**Criterios de aceptación:**
- Entrada de 100 uds incrementa stock correctamente.
- Salida de más de disponible rechaza.
- Kardex muestra saldo acumulado correcto.
- Alerta creada cuando stock < mínimo.

**Testing:**
- [ ] E2E: Crear entrada de 50 uds → stock es 50.
- [ ] E2E: Crear salida de 30 uds → stock es 20 → crear salida de 25 rechaza.
- [ ] E2E: Importar archivo con histórico de movimientos → kardex correcto.

---

## FASE 4B — Exportación (Excel + PDF con Async Queue)
**Duración:** 2-3 días · **Equipo:** 1 dev (Backend) + 1 dev (Frontend)

**Tareas técnicas — Backend:**
- [ ] Instalar `bull` (BullMQ) + Redis para queue
- [ ] Servicio `ExportService` con helpers:
  - `generateExcel()` — usa ExcelJS con estilos (headers, color, bordes)
  - `generatePDF()` — Puppeteer con template HTML (logo, cabeceras, gráficas)
- [ ] Crear queue `pdfQueue` + handlers para generatePDF con retry (3 intentos)
- [ ] Endpoints:
  - `POST /export/excel?reportType=kardex` → retorna URL descarga directa (síncrono, <1 seg)
  - `POST /export/pdf?reportType=kardex` → retorna jobId + URL de polling
  - `GET /export/pdf/:jobId` → estado del job (PENDING, PROCESSING, COMPLETED, FAILED)
- [ ] Almacenar PDFs generados en `/tmp` (local dev) o S3 (futuro prod)
- [ ] Tests: PDF generación (timeout máximo 30 seg), retry en fallos

**Tareas técnicas — Frontend:**
- [ ] Componente `<ExportButton>` genérico:
  - Opción "Descargar Excel" → descarga inmediata
  - Opción "Generar PDF" → modal con spinner + polling status
  - Cuando listo: link de descarga
- [ ] Toast notificación: "PDF listo para descargar" (o error)

**Entregables:** Exportación funcional, async sin bloqueos.

**Dependencias:** Fase 4A

**Criterios de aceptación:**
- Excel se descarga en <500ms.
- PDF se genera en 2-5 min (sin bloquear UI).
- Retry automático si Puppeteer falla una vez.
- Layout PDF usa template con logo/cabecera.

**Testing:**
- [ ] E2E: Exportar kardex a Excel → archivo descargado con datos.
- [ ] E2E: Exportar a PDF → status PENDING → COMPLETED → descarga.

---

## FASE 5A — Transferencias (CRUD + Flujo de Estados)
**Duración:** 4-5 días · **Equipo:** 1 dev (Backend) + 1 dev (Frontend)

**Tareas técnicas — Backend:**
- [ ] Modelar `Transfer`, `TransferItem` en Prisma
- [ ] Módulo `transfers`:
  - Crear solicitud: validar stock disponible (no reserva aún)
  - Aprobar: admin/jefe autoriza
  - Enviar: descuenta stock origen, crea Movement SALIDA tipo TRANSFERENCIA
  - Recibir: suma stock destino, crea Movement ENTRADA tipo TRANSFERENCIA
  - Rechazar: cancela sin mover stock
  - Manejo de diferencias: solicitado vs enviado vs recibido
  - Estados: SOLICITADA → APROBADA → EN_TRANSITO → RECIBIDA (o RECHAZADA en cualquier punto)
- [ ] Generación de código: TRF-00001 (único por origen+destino)
- [ ] Tests: flujo completo, diferencias, validaciones

**Tareas técnicas — Frontend:**
- [ ] Página `/transferencias` (listado con filtros de estado)
- [ ] Página `/transferencias/nueva` (wizard: origen → destino → ítems + cantidades)
- [ ] Página `/transferencias/pendientes` (bandeja de jefe)
- [ ] Detalle de transferencia: timeline de estados + línea de tiempo
- [ ] Cancelación de transferencia en tránsito → rollback de stock

**Entregables:** Módulo transferencias completo, trazabilidad.

**Dependencias:** Fase 4A

**Criterios de aceptación:**
- Transferencia atraviesa todos sus estados sin inconsistencias en stock.
- Recepción con diferencia genera ajuste automático.
- Rechazar en tránsito revierte stock al origen.

**Testing:**
- [ ] E2E: Almacén A solicita 100 kg a Almacén B → aprueba → envía → B recibe → stock consistente.
- [ ] E2E: Recibe 95 kg (no 100) → diferencia registrada.
- [ ] E2E: Rechaza en tránsito → stock A restaurado.

---

## FASE 5B — WebSocket en Tiempo Real (Socket.IO + Redis Adapter)
**Duración:** 3-4 días · **Equipo:** 1 dev (Backend) + 1 dev (Frontend)

**Tareas técnicas — Backend:**
- [ ] Instalar Socket.IO + Redis adapter (`@socket.io/redis-adapter`)
- [ ] Módulo `realtime`: `RealtimeGateway` + `RealtimeService`
- [ ] Guard JWT para autenticar conexiones WebSocket
- [ ] Sistema de **rooms**:
  - Por usuario: `user:${userId}`
  - Por almacén: `warehouse:${warehouseId}`
  - Por rol: `role:JEFE`, `role:ALMACENERO`, etc.
- [ ] Helpers: `emitToUser()`, `emitToWarehouse()`, `emitToRole()`
- [ ] Eventos emitidos:
  - `transfer.pending` → al crear solicitud (broadcast a Jefe + Almacenero destino)
  - `transfer.approved`, `transfer.in_transit`, `transfer.received`
  - `alert.stock` → cuando stock cae bajo mínimo
  - `requisition.new` → cuando residente crea solicitud
  - `requisition.approved` → almacenero notificado
  - `stock.changed` → cambios de stock en almacén activo (apenas se detecten)
  - `maintenance.due` → mantenimiento próximo (scheduled job diario)
- [ ] Heartbeat/ping cada 25s para evitar timeouts en Railway
- [ ] Tests: conexión, rooms, broadcast

**Tareas técnicas — Frontend:**
- [ ] `SocketProvider` global con reconexión automática
- [ ] Hook `useSocket()` para eventos
- [ ] Hook `useNotifications()` para cola de notificaciones
- [ ] Componente `<NotificationBell>` en header:
  - Badge con cantidad de notificaciones
  - Dropdown con lista (marcar como leída)
  - Toast al recibir evento crítico
- [ ] Al recibir evento, invalidar queries TanStack Query (`queryClient.invalidateQueries()`)
- [ ] Logout limpia conexión WebSocket

**Entregables:** Tiempo real funcional, notificaciones en vivo.

**Dependencias:** Fase 5A

**Criterios de aceptación:**
- Cuando Residente solicita transfer, Jefe ve badge + toast al instante.
- Reconexión automática tras desconexión.
- Socket se cierra al logout.
- Redis adapter permite múltiples instancias API.

**Testing:**
- [ ] E2E: Dos usuarios logueados → uno solicita transfer → otro ve notificación en vivo.
- [ ] E2E: Cierra navegador → reconecta → resubscribe a rooms automáticamente.

---

## FASE 6 — Módulos Especializados (Herramientas, EPP, Combustible, Maquinaria, Mantenimientos)
**Duración:** 8-10 días · **Equipo:** 2 devs (1 backend, 1 frontend)

Dividido en sub-fases (6A, 6B, 6C, 6D, 6E — pueden correr parcialmente en paralelo).

### FASE 6A — Herramientas (Préstamos/Devoluciones)
**Duración:** 2 días

- [ ] Modelar `ToolLoan` en Prisma
- [ ] Módulo `tools`: préstamo (con vencimiento), devolución (con condición: BUENO/REGULAR/DAÑADO)
- [ ] Endpoint alertas de vencimiento (scheduled job)
- [ ] Frontend: pantalla de préstamos activos, historial, devoluciones
- [ ] Tests: E2E de préstamo → devolución

### FASE 6B — Trabajadores y EPP
**Duración:** 2 días

- [ ] Modelar `Worker`, `EPPAssignment` en Prisma
- [ ] Módulo `workers`: CRUD
- [ ] Módulo `epp`: asignación (con descuento de stock), reposición (con motivo)
- [ ] Frontend: ficha del trabajador con histórico de EPP
- [ ] Tests: E2E asignación → reposición

### FASE 6C — Maquinaria/Equipos
**Duración:** 2 días

- [ ] Modelar `Equipment` en Prisma
- [ ] Módulo `equipment`: CRUD, hoja de vida, actualización de horómetro/km
- [ ] Frontend: listado filtrable por estado, detalle con gráfica de horómetro
- [ ] Tests: E2E de creación + actualización de horómetro

### FASE 6D — Combustible
**Duración:** 2 días

- [ ] Modelar `FuelDispatch` en Prisma
- [ ] Módulo `fuel`: despacho con lectura obligatoria de horómetro
- [ ] Descuento automático de stock de combustible
- [ ] Frontend: pantalla de despachos, reporte de consumo por equipo
- [ ] Tests: E2E despacho → stock descuentado

### FASE 6E — Mantenimientos
**Duración:** 2 días

- [ ] Modelar `Maintenance`, `MaintenanceItem` en Prisma
- [ ] Módulo `maintenance`: programación, ejecución (descuento de repuestos), cierre
- [ ] Alertas de mantenimiento próximo (fecha o horómetro)
- [ ] Frontend: calendario, detalle, cierre
- [ ] Tests: E2E programación → ejecución → alertas

**Entregables:** Todos los módulos especializados funcionales.

**Criterios de aceptación:**
- Un despacho de combustible descuenta stock.
- Un mantenimiento correctivo descuenta repuestos.
- Préstamos vencidos aparecen en alertas.

**Testing:**
- [ ] E2E: Crear equipo → despacho combustible → horómetro actualizado.
- [ ] E2E: Mantenimiento programado → completado → repuestos descuentados.

---

## FASE 7A — Requisiciones (Residente → Jefe → Almacenero)
**Duración:** 3-4 días · **Equipo:** 1 dev (Backend) + 1 dev (Frontend)

**Tareas técnicas — Backend:**
- [ ] Modelar `Requisition`, `RequisitionItem` en Prisma
- [ ] Módulo `requisitions`:
  - Crear: Residente pide materiales de su obra
  - Aprobar: Jefe autoriza
  - Atender: Almacenero genera salida + descuenta stock
  - Estados: PENDIENTE → APROBADA → PARCIAL/ATENDIDA o RECHAZADA
- [ ] Emitir WebSocket `requisition.new` cuando residente crea
- [ ] Emitir `requisition.approved` al almacenero
- [ ] Generación automática de Movement SALIDA al atender
- [ ] Tests: flujo completo, estados, descuentos

**Tareas técnicas — Frontend:**
- [ ] Página `/requisiciones` (listado por estado)
- [ ] Formulario de nueva requisición (Residente)
- [ ] Bandeja de aprobación (Jefe)
- [ ] Bandeja de atención (Almacenero)
- [ ] Detalle con timeline de estados

**Entregables:** Flujo de requisiciones completo.

**Dependencias:** Fase 5B

**Criterios de aceptación:**
- Residente solicita → Jefe aprueba → Almacenero atiende → stock descuentado.
- Notificación en vivo en cada paso.

**Testing:**
- [ ] E2E: Residente solicita 50 kg → Jefe aprueba → Almacenero atiende → stock actualizado.

---

## FASE 7B — Inventarios Físicos
**Duración:** 2-3 días · **Equipo:** 1 dev (Backend) + 1 dev (Frontend)

**Tareas técnicas — Backend:**
- [ ] Modelar `PhysicalInventory`, `PhysicalInventoryItem` en Prisma
- [ ] Módulo `physical-inventory`:
  - Programar conteo (fecha, supervisor, almacén)
  - Registrar conteos (cantidad física vs sistema)
  - Cerrar: genera ajustes automáticos por diferencias
  - Estados: PROGRAMADO → EN_PROCESO → COMPLETADO
- [ ] Generación de Movements AJUSTE para diferencias
- [ ] Tests: creación, conteos, ajustes

**Tareas técnicas — Frontend:**
- [ ] Página de inventarios físicos (listado)
- [ ] Detalle con form de ingreso de conteos
- [ ] Vista de diferencias + confirmación de ajustes

**Entregables:** Inventarios físicos funcionales.

**Dependencias:** Fase 4A

**Criterios de aceptación:**
- Inventario físico con diferencias genera ajustes correctos.

**Testing:**
- [ ] E2E: Crear inventario → ingresar conteos → diferencias → ajustes creados.

---

## FASE 7C — Reportes Agregados + Dashboard
**Duración:** 4-5 días · **Equipo:** 1 dev (Backend) + 1 dev (Frontend)

**Tareas técnicas — Backend:**
- [ ] Módulo `reports`: endpoints agregados optimizados
  - Stock actual (por almacén, por ítem, consolidado)
  - Rotación (ABC analysis: ítems más movidos)
  - Consumo por obra (últimos 30/90 días)
  - Alertas activas
  - Movimientos por periodo
  - EPP por trabajador
  - Combustible por equipo
  - Caching con Redis (TTL 5 min) + invalidación por eventos
- [ ] Índices en DB: `(warehouseId, createdAt)`, `(itemId, quantity)`
- [ ] Tests: queries performance <2s

**Tareas técnicas — Frontend:**
- [ ] Dashboard principal:
  - KPICards (stock total, alertas críticas, transferencias pendientes, requisiciones)
  - Gráfica line (movimientos por día, últimos 30 días — Recharts)
  - Bar chart (top 10 ítems consumidos)
  - Donut chart (distribución stock por almacén)
  - Table (últimos movimientos)
  - Panel de alertas críticas (WebSocket live update)
- [ ] Páginas de reportes: stock-actual, rotacion, consumo-obra, alertas
  - Filtros: rango fecha, almacén, categoría
  - Exportación Excel/PDF
- [ ] Skeletons en loading, no spinners

**Entregables:** Dashboard + reportes funcionales, performance ok.

**Dependencias:** Fase 5B

**Criterios de aceptación:**
- Dashboard carga en <1.5s.
- Reportes retornan en <2s.
- Gráficas interactivas (Recharts tooltips).

**Testing:**
- [ ] E2E: Dashboard carga → datos visibles.
- [ ] E2E: Exportar reporte stock-actual → Excel descargado.

---

## FASE 7D — Alertas en Vivo + Auditoría
**Duración:** 2-3 días · **Equipo:** 1 dev (Backend) + 1 dev (Frontend)

**Tareas técnicas — Backend:**
- [ ] Modelar `Alert` en Prisma
- [ ] Módulo `alerts`:
  - Crear alertas automáticamente (post-movimiento si stock < mínimo, mantenimiento vencido, EPP bajo, etc.)
  - Marcar como leída (PATCH)
  - Resolver (PATCH)
  - Tipos: STOCK_MINIMO, VENCIMIENTO, MANTENIMIENTO, EPP_BAJO
  - Niveles: INFO, WARNING, CRITICAL
- [ ] Scheduled jobs (BullMQ):
  - Cada 6 horas: revisar mantenimientos próximos (30 días) → crear alertas
  - Cada 24 horas: revisar EPP bajo en asignaciones
- [ ] Emitir evento WS `alert.created` → broadcast a Jefe + Almacenero del almacén
- [ ] Módulo `audit`: ya existe (Fase 2C), pulir queries con filtros avanzados
- [ ] Tests: creación de alertas, scheduled jobs

**Tareas técnicas — Frontend:**
- [ ] Página `/alertas`:
  - Listado con filtros (tipo, nivel, estado)
  - Marcar leída / resolver
  - Navegar al recurso (click alert → detalle del ítem/equipo)
- [ ] Panel de alertas en dashboard (solo CRITICAL + UNREAD)
- [ ] Página `/auditoria`:
  - Tabla con filtros (usuario, acción, recurso, fecha)
  - TanStack Table virtual (optimizado para >10k registros)
  - Exportación

**Entregables:** Alertas + auditoría operativos.

**Dependencias:** Fase 5B

**Criterios de aceptación:**
- Alerta creada automáticamente al caer stock bajo mínimo.
- Usuario ve alerta en vivo (WebSocket).
- Auditoría con >100 registros pagina sin lag.

**Testing:**
- [ ] E2E: Movimiento que baja stock → alerta creada → visible en dashboard.
- [ ] E2E: Auditoría filters (por usuario) → resultados correctos.

---

## FASE 8A — Testing E2E Completo (Todos los Flujos)
**Duración:** 5-7 días · **Equipo:** 1 dev (QA/Testing) + 1 dev (Backend support)

**Objetivo:** Cobertura E2E de **todos los flujos críticos y secundarios** mediante Playwright.

**Tareas técnicas:**
- [ ] Tests E2E por módulo (ver estructura `testing/e2e/`):

  **Auth (5 tests):**
  - [ ] Setup wizard (sin variables ADMIN_*)
  - [ ] Login con DNI + password recovery + reset + login nuevo password
  - [ ] Login con CE (9 dígitos) y PASAPORTE
  - [ ] Logout + sesión terminada
  - [ ] Cambio de password forzado (mustChangePassword)

  **Movimientos (8 tests):**
  - [ ] Entrada simple (1 ítem, N cantidad)
  - [ ] Salida que rechaza (stock insuficiente)
  - [ ] Entrada + salida + saldo correcto
  - [ ] Ajuste de inventario
  - [ ] Bulk entrada (múltiples ítems)
  - [ ] Ver kardex histórico
  - [ ] Exportar kardex Excel
  - [ ] Exportar kardex PDF (status polling)

  **Transfers (6 tests):**
  - [ ] Solicitar transfer (almacén A → B)
  - [ ] Jefe aprueba
  - [ ] Almacén A envía (stock descuentado)
  - [ ] Almacén B recibe (stock incrementado)
  - [ ] Recibe con diferencia (ajuste generado)
  - [ ] Rechazar en tránsito (stock revierte)

  **Requisiciones (5 tests):**
  - [ ] Residente crea requisición
  - [ ] Jefe aprueba (notificación WebSocket)
  - [ ] Almacenero atiende (movimiento generado)
  - [ ] Recepción parcial
  - [ ] Rechazar requisición

  **Equipos & Combustible (4 tests):**
  - [ ] Crear equipo + actualizar horómetro
  - [ ] Despacho de combustible (stock descuentado)
  - [ ] Programar mantenimiento → completar → repuestos descuentados
  - [ ] Alerta de mantenimiento próximo

  **Reports & Dashboard (4 tests):**
  - [ ] Dashboard carga y muestra KPIs
  - [ ] Reporte stock-actual con filtros
  - [ ] Reporte rotación ABC
  - [ ] Exportar reporte a Excel + PDF

  **EPP & Herramientas (3 tests):**
  - [ ] Asignar EPP a trabajador
  - [ ] Reposición de EPP
  - [ ] Préstamo herramienta → devolución

  **Usuarios & RBAC (4 tests):**
  - [ ] Admin crea usuario Residente
  - [ ] Residente solo ve su almacén
  - [ ] Almacenero accede ruta prohibida → 403
  - [ ] Admin ve todos los almacenes

  **WebSocket & Notificaciones (3 tests):**
  - [ ] Notificación transfer pending en vivo
  - [ ] Reconexión automática tras desconexión
  - [ ] Logout cierra socket

  **Inventario Físico (2 tests):**
  - [ ] Crear inventario → contar → diferencias → ajustes
  - [ ] Completar inventario

- [ ] Fixtures: usuarios preconfigurados (Admin, Jefe, Almacenero, Residente), almacenes, ítems
- [ ] Limpieza de DB antes de cada test (`db:reset`)
- [ ] Reportes visuales: screenshots en fallos, HTML report con traza completa
- [ ] Performance: todos los tests deben correr en <60 min (paralelo máximo)

**Criterios de aceptación:**
- 50+ tests E2E cobriendo todos los flujos.
- Cobertura ≥90% de rutas principales (no formularios edge case).
- Todos los tests pasan en CI.
- Tiempo total <60 min en paralelo.

**Testing con webapp-testing:**
- [ ] Playwright integrado en GitHub Actions (`e2e-tests.yml`)
- [ ] Reportes HTML + artifacts en fallos

---

## FASE 8B — Tests Unitarios + Integración + Performance
**Duración:** 3-4 días · **Equipo:** 1 dev (Backend) + 1 dev (QA)

**Tareas técnicas:**
- [ ] Tests unitarios en servicios críticos (cobertura ≥70%):
  - `auth.service`: bcrypt, JWT generation/validation
  - `stock.service`: optimistic locking, validaciones
  - `movement.service`: transacciones, cálculos
  - `transfer.service`: flujo de estados
  - `requisition.service`: aprobación + descuento

- [ ] Tests de integración (controlador + servicio + DB real):
  - Login flow completo
  - Movimiento + stock update
  - Transfer con transacciones
  - Requisición end-to-end

- [ ] Performance tests:
  - `/reports/stock-actual` con 1000 items: <2s
  - `/items?search=...` con 5000 items: <500ms
  - Dashboard queries paralelas: <1.5s
  - WebSocket 100 conexiones simultáneas: no lag

- [ ] Coverage report (`jest --coverage`)

**Entregables:** Cobertura de testing completa.

**Dependencias:** Todas las fases anteriores

**Criterios de aceptación:**
- Cobertura ≥70% en servicios.
- Performance tests pasan.
- CI rechaza PRs con cobertura <70%.

---

## FASE 8C — Security Review + Hardening
**Duración:** 3-4 días · **Equipo:** 1 dev (Backend) + 1 dev (DevOps/Security)

**Tareas técnicas:**
- [ ] Validación de inputs exhaustiva (class-validator + Zod)
- [ ] Sanitización de strings para PDFs (evitar inyección en templates HTML)
- [ ] CORS estricto: solo dominio Railway (frontend)
- [ ] Helmet.js (headers de seguridad)
- [ ] Rate limiting: `@nestjs/throttler` (100 req/min por IP, endpoints sensibles: 10 req/min)
- [ ] Validación de tipo de documento duplicada en backend (no confiar en frontend)
- [ ] SQL injection check: verificar que Prisma ORM es used correctly (no queries raw)
- [ ] XSS check: sanitizar inputs que van a notificaciones
- [ ] JWT: verificar que refresh tokens son HTTP-only, Secure, SameSite=Strict
- [ ] Logs: no guardar passwords, tokens, datos sensibles
- [ ] AUDIT de permisos: verificar que guards están en todos los endpoints sensibles
- [ ] Tests de seguridad: intentar acceder sin token, token expirado, permisos inválidos

**Entregables:** Aplicación hardened.

**Dependencias:** Todas las anteriores

**Criterios de aceptación:**
- Todos los endpoints sensibles requieren JWT + permisos.
- No hay secret keys en código (variables de entorno).
- Rate limiting funciona.
- CORS rechaza requests desde otros dominios.

---

## FASE 8D — Documentación Final + Presentación Cliente
**Duración:** 3-4 días · **Equipo:** 1 dev (Tech Lead) + Product Manager

**Tareas técnicas:**
- [ ] Completar `docs/`:
  - `ADR/` con todas las decisiones (7-10 docs)
  - `architecture.md` — diagrama C4, flujos principales
  - `api-contracts.md` — DTOs principales (OpenAPI via Swagger)
  - `rbac-matrix.md` — matriz permisos por rol
  - `login-bootstrap.md` — cómo se crea el primer admin (seed vs wizard)
  - `testing.md` — cómo correr E2E, fixtures, best practices
  - `error-codes.md` — catálogo de errores de negocio
  - `database-migrations.md` — strategy de rollback en Railway
  - `deployment.md` — pasos de deploy a Railway

- [ ] Generar ER diagram (`prisma-erd-generator`)

- [ ] Crear `docs/user-guide/` por rol:
  - Guía Admin (usuarios, roles, configuración)
  - Guía Jefe (aprobaciones, reportes)
  - Guía Almacenero (movimientos, transferencias)
  - Guía Residente (requisiciones, ver stock)

- [ ] Crear seed data de demo (`prisma/seed.ts` mejorado):
  - 3 almacenes (Central + 2 Obras)
  - 200 ítems ficticios (Faker.js)
  - 500 movimientos históricos
  - 50 usuarios ficticios (Admin, Jefe, Almacenero x2, Residente x2)

- [ ] Guion de presentación al cliente:
  - Flujo de login (mostrar 3 tipos de documento)
  - Crear ítem + transferencia → notificación en vivo
  - Ver kardex y exportar PDF
  - Ver dashboard y reportes
  - Auditoría (mostrar log de acciones)

- [ ] Screenshots profesionales (dark mode + light mode) de 20+ pantallas

- [ ] README final con:
  - Links a Railway deployment
  - Instrucciones de desarrollo local
  - Links a documentación
  - Créditos y stack technologies

**Entregables:** Documentación completa, cliente listo para presentación.

**Criterios de aceptación:**
- Documentación accesible (README → docs/ → ADRs).
- Screenshots profesionales de todos los flujos.
- Seed data cargado en Railway con 200+ ítems.
- Video/guion de demo <15 min.

---

## FASE 9 (Opcional) — Optimizaciones Post-Presentación
**Duración:** Abierta · **Equipo:** 1-2 devs

Si el cliente da feedback post-presentación:

**Tareas potenciales:**
- [ ] Bug fixes reportados por cliente.
- [ ] Performance tuning (profiling con DevTools).
- [ ] Capacitación de usuarios del cliente (online workshop).
- [ ] Documentación adicional (manual operacional).
- [ ] Features adicionales solicitadas (fuera del MVP).
- [ ] Cambios de branding/colors.

---

## 5. Decisiones Arquitectónicas (ADRs Iniciales)

### ADR-0001: Optimistic Locking para Stock

**Status:** Accepted

**Context:**  
En un sistema de inventario, múltiples transacciones pueden intentar actualizar el mismo stock simultáneamente (transferencias paralelas, despachos, etc.). Sin control de concurrencia, hay riesgo de overselling o inconsistencia.

**Decision:**  
Usar optimistic locking con campo `version` en tabla `Stock`. Antes de actualizar, validar que la versión no cambió; si cambió, reintentar o fallar con error específico.

**Consequences:**
- ✅ No hay deadlocks (mejor performance).
- ✅ Retry automático en cliente (TanStack Query).
- ⚠️ Si muchas colisiones, puede haber retries frecuentes (mitigable con backoff exponencial).

**Alternatives:**
- Pessimistic locking (SELECT FOR UPDATE): más simple, pero riesgo de deadlocks en transferencias en paralelo.
- Message queue (async): overkill para este caso; mejor para órdenes e-commerce.

---

### ADR-0002: Redis Adapter para Socket.IO

**Status:** Accepted

**Context:**  
Si en el futuro hay múltiples instancias del API detrás de un load balancer, Socket.IO no brodea mensajes entre servidores por defecto. Esto causa que usuarios conectados al servidor A no reciban eventos emitidos en servidor B.

**Decision:**  
Usar Redis adapter (`@socket.io/redis-adapter`) + BullMQ desde Fase 5B. Permite broadcasts entre instancias.

**Consequences:**
- ✅ Escalabilidad horizontal lista.
- ✅ Redis está disponible en Railway (BullMQ).
- ⚠️ Requiere administración de Redis (dev local + Railway); costo.

**Alternatives:**
- Sin adapter: único servidor (ok para MVP, pero no escalable).

---

### ADR-0003: Async Queue para PDFs (BullMQ)

**Status:** Accepted

**Context:**  
Puppeteer es pesado (~50-100ms por PDF). Si lo hacemos síncrono, request de exportación tarda 2-5 seg, bloqueando el usuario.

**Decision:**  
Usar BullMQ (job queue sobre Redis). Endpoint retorna jobId inmediatamente; cliente hace polling hasta COMPLETED.

**Consequences:**
- ✅ No bloquea UI.
- ✅ Reintenta automáticamente si Puppeteer falla.
- ✅ Escalable (múltiples workers).
- ⚠️ Complejidad (queue management, polling en frontend).

**Alternatives:**
- Síncrono: simple, pero mala UX (esperar 5 seg).

---

### ADR-0004: Soft Deletes Explícito

**Status:** Accepted

**Context:**  
En un sistema de auditoría, borrar registros rompe la trazabilidad. Los logs pueden referenciar items/usuarios que ya no existen.

**Decision:**  
Usar campo `deletedAt` (NULL = activo, timestamp = borrado). Índice en `deletedAt` para queries rápidas de activos. Unique constraints respetan deletedAt.

**Consequences:**
- ✅ Auditoría completa.
- ✅ Recuperación de datos (soft-restore).
- ⚠️ Queries deben siempre filtrar `WHERE deletedAt IS NULL`.

**Alternatives:**
- Borrado físico: más simple, pero pierde auditoría.

---

### ADR-0005: Railway para Presentación (NO Producción)

**Status:** Accepted

**Context:**  
El cliente aún no aprobó el proyecto final. Deploy temprano a Railway permite demostración sin costo de infraestructura AWS.

**Decision:**  
Railway para presentación (PostgreSQL managed + dominio *.railway.app). Producción final será AWS (posterior si cliente aprueba).

**Consequences:**
- ✅ MVP rápido sin costo.
- ✅ No requiere Kubernetes / DevOps complexity.
- ⚠️ Sin backups (data descartable).
- ⚠️ No multi-region (fine para presentación).

**Alternatives:**
- AWS desde inicio: más costo, mayor complejidad.
- Self-hosted VPS: sin auto-scaling, poca confiabilidad.

---

## 6. Matriz de Roles y Permisos (igual que original, referencia)

| Recurso / Acción | Admin | Jefe de Almacén | Almacenero | Residente de Obra |
|------------------|:-----:|:---------------:|:----------:|:-----------------:|
| **Usuarios** | CRUD | R | — | — |
| **Roles y Permisos** | CRUD | R | — | — |
| **Almacenes** | CRUD | R U (asignados) | R (asignado) | R (asignado) |
| **Ítems (Catálogo)** | CRUD | CRU | R | R |
| **Stock (consulta)** | R (todos) | R (todos) | R (su almacén) | R (su obra) |
| **Entradas/Salidas** | CRUD | CRU | CR (su almacén) | — |
| **Ajustes** | CRUD | CRU A | — | — |
| **Transferencias** | CRUD | C/A/X | X (su almacén) | C (su obra) |
| **Requisiciones** | C | C/A/X | X (su almacén) | C (su obra) |
| **Reportes** | R (todos) | R (asignados) | R (su almacén) | R (su obra) |
| **Auditoría** | R | — | — | — |

---

## 7. Catálogo de Errores de Negocio

**Archivo:** `packages/types/src/errors/business-error-code.ts`

```typescript
export enum BusinessErrorCode {
  // Auth
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_DOCUMENT_FORMAT = 'INVALID_DOCUMENT_FORMAT',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  MUST_CHANGE_PASSWORD = 'MUST_CHANGE_PASSWORD',
  SETUP_ALREADY_COMPLETED = 'SETUP_ALREADY_COMPLETED',
  SETUP_NOT_COMPLETED = 'SETUP_NOT_COMPLETED',

  // Stock & Movements
  STOCK_INSUFFICIENT = 'STOCK_INSUFFICIENT',
  ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',
  WAREHOUSE_NOT_FOUND = 'WAREHOUSE_NOT_FOUND',
  STOCK_CONFLICT = 'STOCK_CONFLICT', // Optimistic locking failed

  // Transfers
  TRANSFER_INVALID_STATE = 'TRANSFER_INVALID_STATE',
  TRANSFER_NOT_FOUND = 'TRANSFER_NOT_FOUND',

  // Requisitions
  REQUISITION_INVALID_STATE = 'REQUISITION_INVALID_STATE',
  REQUISITION_NOT_FOUND = 'REQUISITION_NOT_FOUND',

  // Permissions
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  WAREHOUSE_SCOPE_VIOLATION = 'WAREHOUSE_SCOPE_VIOLATION',

  // Generic
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
}
```

**Respuesta de error estándar (API):**

```json
{
  "error": {
    "code": "STOCK_INSUFFICIENT",
    "message": "Stock insuficiente. Disponible: 50 kg, solicitado: 100 kg",
    "details": {
      "available": 50,
      "requested": 100,
      "itemId": "abc123"
    }
  }
}
```

---

## 8. Estimaciones de Duración (Referencia)

| Fase | Duración | Equipo | Notas |
|------|----------|--------|-------|
| **Fase 0** | 3-5 días | 1 Tech Lead | Paralela con Fase 1A |
| **Fase 1A** | 3-4 días | 1 DevOps + 1 Backend | Docker |
| **Fase 1B** | 2-3 días | 1 Full-stack | Config compartida |
| **Fase 1C** | 3-4 días | 1 Backend | NestJS + Prisma |
| **Fase 1D** | 2-3 días | 1 Frontend | Next.js + Design system |
| **Fase 1E** | 2-3 días | 1 DevOps/QA | CI/CD + testing infra |
| **FASE 1 Total** | **17-22 días** | **3-4 devs** | |
| **Fase 2A** | 3-4 días | 1 Backend | Auth core |
| **Fase 2B** | 2-3 días | 1 Backend + 1 Frontend | Validaciones + login |
| **Fase 2C** | 3-4 días | 1 Backend | RBAC + auditoría |
| **Fase 2D** | 2-3 días | 1 Backend + 1 Frontend | Setup wizard |
| **FASE 2 Total** | **11-14 días** | **2 devs** | |
| **Fase 3A** | 4-5 días | 1 Backend + 1 Frontend | Maestros |
| **Fase 3B** | 2-3 días | 1 Backend + 1 Frontend | Importación masiva |
| **FASE 3 Total** | **6-8 días** | **2 devs** | |
| **Fase 4A** | 4-5 días | 1 Backend + 1 Frontend | Stock + movimientos |
| **Fase 4B** | 2-3 días | 1 Backend + 1 Frontend | Exportación async |
| **FASE 4 Total** | **6-8 días** | **2 devs** | |
| **Fase 5A** | 4-5 días | 1 Backend + 1 Frontend | Transferencias |
| **Fase 5B** | 3-4 días | 1 Backend + 1 Frontend | WebSocket |
| **FASE 5 Total** | **7-9 días** | **2 devs** | |
| **FASE 6 (Especializados)** | **8-10 días** | **2 devs** | Parcialmente paralelo |
| **Fase 7A** | 3-4 días | 1 Backend + 1 Frontend | Requisiciones |
| **Fase 7B** | 2-3 días | 1 Backend + 1 Frontend | Inventarios físicos |
| **Fase 7C** | 4-5 días | 1 Backend + 1 Frontend | Reportes + dashboard |
| **Fase 7D** | 2-3 días | 1 Backend + 1 Frontend | Alertas + auditoría |
| **FASE 7 Total** | **11-15 días** | **2 devs** | |
| **Fase 8A** | 5-7 días | 1 QA + 1 Backend | E2E testing |
| **Fase 8B** | 3-4 días | 1 Backend + 1 QA | Unit + integration |
| **Fase 8C** | 3-4 días | 1 Backend + 1 DevOps | Security |
| **Fase 8D** | 3-4 días | 1 Tech Lead + PM | Docs + presentación |
| **FASE 8 Total** | **14-19 días** | **3-4 devs** | |
| | | | |
| **PROYECTO TOTAL** | **72-96 días** | **3-5 devs sustained** | ~4 meses calendario |

**Notas:**
- Estimaciones para equipo **3-5 devs full-time**.
- Si equipo <3 devs: agregar +30-50%.
- Si equipo >5 devs: coordinar overhead, puede reducirse 10-20%.
- Fases pueden solaparse (1A + 0 paralelo, 3A + 2D paralelo, etc.).
- Testing integrado en **cada fase** (no esperar a Fase 8).

---

## 9. Convenciones y Estándares

### 9.1 Commits (Conventional Commits)

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`

**Scopes:** `auth`, `movements`, `transfers`, `api`, `web`, `db`, etc.

**Ejemplos:**
```
feat(auth): add document type validation
fix(transfers): fix optimistic locking collision
test(e2e): add full transfer workflow test
```

### 9.2 Branches

- `main` — producción (Railway)
- `develop` — integración (todas las features confluyen)
- `feature/short-description` — features nuevas
- `fix/issue-number` — bug fixes
- `hotfix/critical-issue` — urgencias

### 9.3 Code Review

- Mínimo 1 aprobación antes de merge.
- CI en verde obligatorio.
- Cobertura de tests no debe bajar.

### 9.4 Nombres de Archivos

- Archivos: `kebab-case` (component-name.ts)
- Componentes React: `PascalCase` (ComponentName.tsx)
- Interfaces/Types: `PascalCase` (UserInterface.ts)
- Funciones: `camelCase` (getUserByDocument())

### 9.5 API Responses

```json
// Success
{
  "data": { ... },
  "meta": {
    "timestamp": "2026-04-21T10:30:00Z",
    "requestId": "uuid"
  }
}

// Error
{
  "error": {
    "code": "STOCK_INSUFFICIENT",
    "message": "Stock insuficiente...",
    "details": { ... }
  }
}
```

---

## 10. Próximos Pasos Inmediatos

### Ya Completado ✅

1. ✅ Plan refactorizado aprobado.
2. ✅ Equipo confirmado: 1 dev (solo).
3. ✅ Repo Git inicializado localmente.
4. ✅ Fase 0 completada: ADRs + estructura base.
5. ✅ Fase 1A completada: Docker + infraestructura.

### Siguientes: Fase 1B — Configuración Compartida

```bash
# 1. Instalar dependencias root
npm install turbo

# 2. Crear estructura de packages y apps
# 3. Configurar shared configs (ESLint, TypeScript, Prettier)
# 4. Instalar Husky + lint-staged

# 5. Validar que docker está funcionando
docker-compose up -d
docker-compose ps

# 6. Revisar docker logs
docker-compose logs postgres
docker-compose logs redis
```

**Duración estimada Fases 1B-1E:** 12-16 días (1 dev en paralelo)

---

---

## 11. Conclusión

Este plan refactorizado **incorpora 10 mejoras clave:**

| # | Mejora | Fase |
|---|--------|------|
| 1 | Fases granulares (1A, 1B, etc.) | 1, 2, 8 |
| 2 | webapp-testing integrado en cada fase | 2-8 |
| 3 | Optimistic locking explícito para stock | 4A |
| 4 | Redis adapter Socket.IO | 5B |
| 5 | Async queue para PDFs | 4B |
| 6 | Soft deletes en schema | Fase 3-7 |
| 7 | Catálogo de BusinessErrorCode | Antes de Fase 2 |
| 8 | ADRs documentados | Fase 0 |
| 9 | Testing desde Fase 2 (no al final) | 2A+ |
| 10 | Estructuras compartidas (types, utils, etc.) claro | 1B |

**Duración estimada:** 72-96 días (3-5 devs full-time) = ~4 meses calendario.

**Estado del proyecto:** 🚀 **EN EJECUCIÓN** — Fases 0 + 1A + 1B completadas, iniciando Fase 1C (NestJS + Prisma).

---

> **Versión del plan:** 4.2 (En Ejecución)  
> **Fecha de Actualización:** 2026-04-21 23:00  
> **Estado:** ✅ Fases 0, 1A, 1B Completadas | 🔄 Fase 1C Siguiente  
>
> **Progreso:**
> - ✅ Fase 0 (Decisiones Arquitectónicas): 100% — 5 ADRs documentados
> - ✅ Fase 1A (Setup Docker): 100% — docker-compose.yml + .env.example + estructura base
> - ✅ Fase 1B (Config Compartida): 100% — packages/tsconfig, eslint-config, utils, types + Prettier + Husky + CI
> - 🔄 Fase 1C (NestJS + Prisma): Siguiente
> - ⏳ Fase 1D-1E: Pendientes
> - ⏳ Fases 2-8: Pendientes
>
> **Artefactos creados en Fase 1B:**
> - 4 packages compartidos: tsconfig, eslint-config, utils, types
> - BusinessErrorCode con 40+ códigos de error
> - WS_EVENTS + helpers de rooms (wsRoomForUser, etc.)
> - 30+ archivos de tipos (entities, enums, dto, errors)
> - CI/CD: ci.yml + e2e-tests.yml con services PostgreSQL + Redis
> - Conventional Commits enforced (commitlint)
>
> **Última actualización:** 2026-04-21 — 1 dev en ejecución

