# Plan de Trabajo — Sistema Kardex para Empresa Constructora

> **Stack:** Next.js + NestJS + PostgreSQL (Docker) · **Tipo:** Aplicación web empresarial multi-almacén · **Idioma:** Español

---

## 1. Arquitectura General

### 1.1 Diagrama de Arquitectura

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
│  shadcn/ui       │    (Socket.IO)          │  class-validator │
│  TanStack Query  │                         │  Interceptors    │
│  Zustand         │                         │  Socket.IO       │
│  socket.io-client│                         │  Gateway         │
└──────────────────┘                         └────────┬─────────┘
                                                      │
                                             ┌────────▼─────────┐
                                             │  PostgreSQL 16   │
                                             │  (managed en     │
                                             │   Railway)       │
                                             └──────────────────┘

  Desarrollo: Docker Compose (web + api + postgres + pgadmin)
  Producción: Railway (servicios web, api, postgres managed)
```

### 1.2 Patrones y Principios Aplicados

| Capa | Patrones |
|------|----------|
| **Backend** | Arquitectura Modular (NestJS), Clean Architecture light, Repository Pattern (Prisma), DTOs + Validación, Guards/Interceptors, CQRS ligero en módulos críticos, WebSocket Gateway para eventos en tiempo real |
| **Frontend** | Feature-Based Architecture, Server Components por defecto + Client Components cuando sea necesario, Separación UI / lógica de negocio / data-fetching, estado global híbrido (Zustand + TanStack Query + Socket.IO) |
| **Seguridad** | RBAC (Role-Based Access Control) con permisos granulares, JWT + Refresh Tokens httpOnly, bcrypt para passwords, Helmet, CORS estricto, Rate limiting, validación de formato por tipo de documento |
| **Datos** | Soft deletes, Auditoría automática, Transacciones ACID en movimientos, Índices compuestos en tablas de alta lectura |
| **Tiempo Real** | Estrategia híbrida: polling de TanStack Query para datos generales + WebSockets (Socket.IO) para eventos críticos (alertas, transferencias, requisiciones, mantenimientos, cambios de stock en almacén activo) |

### 1.3 Decisiones Técnicas Justificadas

- **Monorepo con Turborepo:** pipeline de build inteligente, caché remoto, excelente DX con Next.js y NestJS compartiendo tipos. Más simple que Nx para este tamaño.
- **Prisma sobre TypeORM:** mejor DX, migraciones declarativas, tipado fuerte end-to-end, mejor comunidad actual.
- **App Router de Next.js:** Server Components reducen JS en cliente, mejor performance inicial, streaming nativo.
- **shadcn/ui:** componentes copiables (no dependencia), totalmente personalizables, basados en Radix UI (accesibilidad).
- **TanStack Query:** manejo de caché de servidor, invalidación quirúrgica, optimistic updates imprescindibles en inventario.
- **Zustand:** estado cliente liviano para UI (sidebar, modales, filtros locales) sin el boilerplate de Redux.
- **Socket.IO (NestJS Gateway + socket.io-client):** tiempo real con reconexión automática, rooms por usuario/almacén, fallback a long-polling si WebSocket falla.
- **Railway:** despliegue simple con PostgreSQL managed, sin configurar reverse proxy (Railway lo maneja). Ideal para MVP/presentación.
- **Recharts + Tremor:** gráficas responsivas, componentes de dashboard listos, estándar de facto en React.
- **TanStack Table v8:** tablas headless con control total (paginación, sort, filtros, virtualización).
- **Sonner:** sistema de notificaciones toast moderno y accesible.
- **ExcelJS + Puppeteer:** ExcelJS para exportación a hojas de cálculo con estilos; Puppeteer para PDFs con layouts complejos (logo, cabeceras/pies, gráficas embebidas).
- **date-fns + date-fns-tz:** manejo de fechas ligero, tree-shakeable, con soporte de zonas horarias.

---

## 2. Estructura de Carpetas del Monorepo

### 2.1 Raíz del Monorepo

```
kardex-constructora/
├── apps/
│   ├── web/                          # Next.js (frontend)
│   └── api/                          # NestJS (backend)
├── packages/
│   ├── types/                        # Tipos TS compartidos (contratos API)
│   ├── ui/                           # Componentes UI compartidos (opcional)
│   ├── eslint-config/                # Config ESLint compartida
│   ├── tsconfig/                     # Configs base TypeScript
│   └── utils/                        # Utilidades comunes (formatters, validators)
├── docker/
│   ├── postgres/
│   │   └── init.sql                  # Script inicial de DB (solo dev)
│   ├── api/
│   │   └── Dockerfile                # Build del API
│   └── web/
│       └── Dockerfile                # Build del web
├── railway/
│   ├── railway.json                  # Config Railway (servicios + builders)
│   └── DEPLOY.md                     # Guía paso a paso de despliegue
├── docs/
│   ├── architecture.md
│   ├── api-contracts.md
│   ├── rbac-matrix.md
│   ├── login-bootstrap.md            # Flujo de login + creación del primer admin
│   └── deployment.md
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint + tests + build
│       └── deploy-railway.yml        # Despliegue a Railway
├── .env.example
├── .gitignore
├── .dockerignore
├── docker-compose.yml                # Orquestación local (dev)
├── docker-compose.dev.yml            # Overrides para desarrollo
├── turbo.json                        # Pipeline Turborepo
├── package.json                      # Workspaces
├── pnpm-workspace.yaml               # (pnpm recomendado)
└── README.md
```

### 2.2 `apps/web` — Frontend Next.js

```
apps/web/
├── public/
│   ├── icons/
│   ├── images/
│   └── fonts/
├── src/
│   ├── app/                                    # App Router
│   │   ├── (auth)/                             # Grupo público
│   │   │   ├── login/page.tsx                  # Login con selector de tipo de doc
│   │   │   ├── recuperar-password/page.tsx
│   │   │   ├── setup/page.tsx                  # Wizard primer admin (solo si DB vacía)
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/                        # Grupo protegido
│   │   │   ├── layout.tsx                      # Sidebar + Header + Guard
│   │   │   ├── page.tsx                        # Dashboard principal
│   │   │   ├── almacenes/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── nuevo/page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── editar/page.tsx
│   │   │   ├── items/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── nuevo/page.tsx
│   │   │   │   ├── categorias/page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── kardex/page.tsx         # Kardex histórico del ítem
│   │   │   ├── movimientos/
│   │   │   │   ├── entradas/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── nueva/page.tsx
│   │   │   │   ├── salidas/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── nueva/page.tsx
│   │   │   │   └── ajustes/page.tsx
│   │   │   ├── transferencias/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── nueva/page.tsx
│   │   │   │   ├── pendientes/page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── herramientas/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── prestamos/page.tsx
│   │   │   │   └── devoluciones/page.tsx
│   │   │   ├── epp/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── asignaciones/page.tsx
│   │   │   │   └── trabajadores/page.tsx
│   │   │   ├── combustible/
│   │   │   │   ├── page.tsx
│   │   │   │   └── despachos/
│   │   │   │       ├── page.tsx
│   │   │   │       └── nuevo/page.tsx
│   │   │   ├── maquinaria/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx                # Hoja de vida
│   │   │   │   │   ├── mantenimientos/page.tsx
│   │   │   │   │   └── horometro/page.tsx
│   │   │   │   └── nuevo/page.tsx
│   │   │   ├── inventarios/
│   │   │   │   ├── page.tsx                    # Inventarios físicos
│   │   │   │   └── nuevo/page.tsx
│   │   │   ├── reportes/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── stock-actual/page.tsx
│   │   │   │   ├── rotacion/page.tsx
│   │   │   │   ├── consumo-por-obra/page.tsx
│   │   │   │   └── alertas/page.tsx
│   │   │   ├── usuarios/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── roles/page.tsx
│   │   │   │   └── nuevo/page.tsx
│   │   │   ├── auditoria/page.tsx
│   │   │   └── configuracion/page.tsx
│   │   ├── api/                                # Route handlers (proxy/BFF si se requiere)
│   │   │   └── auth/[...nextauth]/route.ts
│   │   ├── layout.tsx                          # Layout raíz
│   │   ├── not-found.tsx
│   │   ├── error.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                                 # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── table.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── form.tsx
│   │   │   ├── select.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Breadcrumbs.tsx
│   │   │   └── UserMenu.tsx
│   │   ├── shared/
│   │   │   ├── DataTable.tsx                   # TanStack Table v8 con paginación/filtros
│   │   │   ├── SearchBar.tsx
│   │   │   ├── DateRangePicker.tsx
│   │   │   ├── DocumentInput.tsx               # Input documento + validación por tipo
│   │   │   ├── ExportButton.tsx                # Excel (ExcelJS) / PDF (Puppeteer)
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── NotificationBell.tsx            # Campanita con eventos WebSocket
│   │   │   └── PermissionGate.tsx              # Render condicional por permiso
│   │   └── charts/                             # Recharts + Tremor
│   │       ├── StockChart.tsx
│   │       ├── ConsumoChart.tsx
│   │       ├── RotacionChart.tsx
│   │       ├── KPICard.tsx
│   │       └── DashboardWidgets.tsx
│   ├── features/                               # Lógica por dominio
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── schemas/
│   │   ├── items/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── schemas/
│   │   ├── movimientos/
│   │   ├── transferencias/
│   │   ├── herramientas/
│   │   ├── epp/
│   │   ├── combustible/
│   │   ├── maquinaria/
│   │   └── reportes/
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePermissions.ts
│   │   ├── useDebounce.ts
│   │   ├── usePagination.ts
│   │   ├── useSocket.ts                        # Cliente Socket.IO global
│   │   └── useRealtimeStock.ts                 # Suscripción a cambios de stock
│   ├── lib/
│   │   ├── api-client.ts                       # Axios con interceptores (auth, errores)
│   │   ├── socket-client.ts                    # Instancia Socket.IO con reconexión
│   │   ├── auth.ts
│   │   ├── format.ts                           # date-fns + formatters numéricos
│   │   ├── document-validators.ts              # Validadores DNI/CE/Pasaporte
│   │   ├── cn.ts                               # clsx + tailwind-merge
│   │   └── constants.ts                        # DOCUMENT_TYPES, eventos WS, etc.
│   ├── stores/                                 # Zustand
│   │   ├── useUIStore.ts                       # sidebar, modales, loading global
│   │   ├── useFilterStore.ts                   # filtros persistentes por módulo
│   │   ├── useWarehouseStore.ts                # Almacén activo del usuario
│   │   ├── useNotificationStore.ts             # Cola de notificaciones WS
│   │   └── useRealtimeStore.ts                 # Estado de eventos en vivo
│   ├── providers/
│   │   ├── QueryProvider.tsx                   # TanStack Query + DevTools
│   │   ├── SocketProvider.tsx                  # Conexión Socket.IO global
│   │   ├── ToastProvider.tsx                   # Sonner
│   │   └── ThemeProvider.tsx
│   ├── services/                               # Llamadas a API
│   │   ├── auth.service.ts
│   │   ├── items.service.ts
│   │   ├── warehouses.service.ts
│   │   ├── movements.service.ts
│   │   └── ...
│   ├── schemas/                                # Zod schemas
│   │   ├── auth.schema.ts                      # Login con tipo doc + validación formato
│   │   ├── item.schema.ts
│   │   ├── movement.schema.ts
│   │   └── ...
│   ├── types/
│   │   └── index.ts
│   └── middleware.ts                           # Auth middleware + redirects
├── .env.local
├── .eslintrc.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── components.json                             # shadcn config
└── package.json
```

### 2.3 `apps/api` — Backend NestJS

```
apps/api/
├── prisma/
│   ├── schema.prisma                           # Modelo de datos
│   ├── migrations/
│   └── seed.ts                                 # Datos iniciales (roles, admin)
├── src/
│   ├── main.ts                                 # Bootstrap + Swagger + Helmet
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   ├── permissions.decorator.ts
│   │   │   └── public.decorator.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── permissions.guard.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   ├── transform.interceptor.ts
│   │   │   └── audit.interceptor.ts
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   ├── dto/
│   │   │   ├── pagination.dto.ts
│   │   │   └── base-response.dto.ts
│   │   └── utils/
│   │       ├── pagination.util.ts
│   │       └── hash.util.ts
│   ├── config/
│   │   ├── configuration.ts
│   │   ├── jwt.config.ts
│   │   └── env.validation.ts
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   └── modules/
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts              # login, refresh, logout, forgot, reset
│       │   ├── auth.service.ts
│       │   ├── setup.controller.ts             # POST /auth/setup (primer admin - wizard)
│       │   ├── setup.service.ts                # Bloqueado si ya existe un admin
│       │   ├── validators/
│       │   │   └── document.validator.ts       # DNI/CE/Pasaporte por tipo
│       │   ├── strategies/
│       │   │   ├── jwt.strategy.ts
│       │   │   └── refresh.strategy.ts
│       │   └── dto/
│       │       ├── login.dto.ts                # { documentType, documentNumber, password }
│       │       ├── setup.dto.ts                # Payload primer admin
│       │       ├── forgot-password.dto.ts
│       │       ├── reset-password.dto.ts
│       │       └── refresh.dto.ts
│       ├── users/
│       │   ├── users.module.ts
│       │   ├── users.controller.ts
│       │   ├── users.service.ts
│       │   └── dto/
│       ├── roles/
│       │   ├── roles.module.ts
│       │   ├── roles.controller.ts
│       │   ├── roles.service.ts
│       │   └── dto/
│       ├── permissions/
│       │   ├── permissions.module.ts
│       │   └── permissions.service.ts
│       ├── warehouses/                         # Almacenes/Obras
│       │   ├── warehouses.module.ts
│       │   ├── warehouses.controller.ts
│       │   ├── warehouses.service.ts
│       │   └── dto/
│       ├── categories/
│       │   ├── categories.module.ts
│       │   ├── categories.controller.ts
│       │   └── categories.service.ts
│       ├── units/                              # Unidades de medida
│       │   ├── units.module.ts
│       │   └── units.service.ts
│       ├── items/                              # Catálogo maestro
│       │   ├── items.module.ts
│       │   ├── items.controller.ts
│       │   ├── items.service.ts
│       │   └── dto/
│       ├── stock/                              # Stock por almacén
│       │   ├── stock.module.ts
│       │   ├── stock.controller.ts
│       │   └── stock.service.ts
│       ├── movements/                          # Entradas/salidas/ajustes
│       │   ├── movements.module.ts
│       │   ├── movements.controller.ts
│       │   ├── movements.service.ts
│       │   └── dto/
│       ├── transfers/                          # Transferencias entre almacenes
│       │   ├── transfers.module.ts
│       │   ├── transfers.controller.ts
│       │   ├── transfers.service.ts
│       │   └── dto/
│       ├── tools/                              # Herramientas (préstamos)
│       │   ├── tools.module.ts
│       │   ├── tools.controller.ts
│       │   ├── tools.service.ts
│       │   └── dto/
│       ├── epp/                                # Equipos de Protección Personal
│       │   ├── epp.module.ts
│       │   ├── epp.controller.ts
│       │   ├── epp.service.ts
│       │   └── dto/
│       ├── workers/                            # Trabajadores (para EPP)
│       │   ├── workers.module.ts
│       │   └── workers.service.ts
│       ├── fuel/                               # Combustible
│       │   ├── fuel.module.ts
│       │   ├── fuel.controller.ts
│       │   ├── fuel.service.ts
│       │   └── dto/
│       ├── equipment/                          # Maquinaria/Equipos
│       │   ├── equipment.module.ts
│       │   ├── equipment.controller.ts
│       │   ├── equipment.service.ts
│       │   └── dto/
│       ├── maintenance/                        # Mantenimientos
│       │   ├── maintenance.module.ts
│       │   ├── maintenance.controller.ts
│       │   ├── maintenance.service.ts
│       │   └── dto/
│       ├── physical-inventory/                 # Inventarios físicos
│       │   ├── physical-inventory.module.ts
│       │   ├── physical-inventory.controller.ts
│       │   └── physical-inventory.service.ts
│       ├── requisitions/                       # Solicitudes (Residente → Almacén)
│       │   ├── requisitions.module.ts
│       │   ├── requisitions.controller.ts
│       │   └── requisitions.service.ts
│       ├── reports/
│       │   ├── reports.module.ts
│       │   ├── reports.controller.ts
│       │   └── reports.service.ts
│       ├── alerts/                             # Alertas de stock mínimo
│       │   ├── alerts.module.ts
│       │   └── alerts.service.ts
│       ├── audit/
│       │   ├── audit.module.ts
│       │   ├── audit.controller.ts
│       │   └── audit.service.ts
│       ├── realtime/                           # WebSocket Gateway (Socket.IO)
│       │   ├── realtime.module.ts
│       │   ├── realtime.gateway.ts             # Rooms por user/warehouse/role
│       │   ├── realtime.service.ts             # emit helpers (emitToWarehouse, etc.)
│       │   ├── guards/
│       │   │   └── ws-jwt.guard.ts             # Auth de conexión WebSocket
│       │   └── events/                         # Catálogo de eventos tipados
│       │       └── event-types.ts
│       └── export/                             # Export Excel (ExcelJS) / PDF (Puppeteer)
│           ├── export.module.ts
│           ├── export.service.ts
│           ├── excel/
│           │   └── excel.service.ts
│           └── pdf/
│               ├── pdf.service.ts              # Puppeteer - render de HTML complejos
│               └── templates/                  # Plantillas HTML (logo, cabeceras)
├── test/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env
├── .eslintrc.js
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
└── package.json
```

### 2.4 `packages/` — Paquetes Compartidos

```
packages/
├── types/
│   ├── src/
│   │   ├── entities/                           # User, Item, Movement, etc.
│   │   ├── enums/                              # MovementType, TransferStatus, etc.
│   │   ├── dto/                                # Contratos API
│   │   └── index.ts
│   └── package.json
├── ui/                                         # (opcional) Design system
│   ├── src/
│   └── package.json
├── eslint-config/
│   ├── base.js
│   ├── next.js
│   ├── nest.js
│   └── package.json
├── tsconfig/
│   ├── base.json
│   ├── nextjs.json
│   ├── nestjs.json
│   └── package.json
└── utils/
    ├── src/
    │   ├── date.ts
    │   ├── number.ts
    │   ├── validators.ts
    │   └── index.ts
    └── package.json
```

---

## 3. Modelo de Datos (Alto Nivel)

### 3.1 Entidades Principales

| Entidad | Campos clave | Relaciones |
|---------|--------------|------------|
| **User** | id, documentType (DNI/CE/PASAPORTE), documentNumber, passwordHash, firstName, lastName, email (opcional), phone, roleId, active, mustChangePassword, lastLoginAt · **Unique compuesto:** (documentType, documentNumber) | N:1 Role · 1:N Movement · 1:N AuditLog |
| **Role** | id, name, description, systemRole | 1:N User · N:M Permission |
| **Permission** | id, resource, action, description | N:M Role |
| **Warehouse** | id, code, name, type (CENTRAL/OBRA), address, managerId, active | 1:N Stock · 1:N Movement · N:1 User (manager) |
| **Category** | id, code, name, parentId, itemType (MATERIAL/HERRAMIENTA/EPP/COMBUSTIBLE/REPUESTO/EQUIPO) | 1:N Item · self-reference |
| **Unit** | id, code (KG/M/UND/GAL), name, symbol | 1:N Item |
| **Item** | id, code, name, description, categoryId, unitId, itemType, minStock, maxStock, active, imageUrl | N:1 Category · N:1 Unit · 1:N Stock · 1:N MovementItem |
| **Stock** | id, itemId, warehouseId, quantity, reservedQuantity, updatedAt | N:1 Item · N:1 Warehouse (unique: itemId+warehouseId) |
| **Movement** | id, code, type (ENTRADA/SALIDA/AJUSTE), warehouseId, userId, date, reference, notes, sourceType (COMPRA/CONSUMO/TRANSFERENCIA/AJUSTE/DEVOLUCION/BAJA) | N:1 Warehouse · N:1 User · 1:N MovementItem |
| **MovementItem** | id, movementId, itemId, quantity, notes | N:1 Movement · N:1 Item |
| **Transfer** | id, code, originWarehouseId, destinationWarehouseId, status (SOLICITADA/APROBADA/EN_TRANSITO/RECIBIDA/RECHAZADA/CANCELADA), requestedBy, approvedBy, receivedBy, requestedAt, receivedAt | N:1 Warehouse (origin) · N:1 Warehouse (dest) · 1:N TransferItem |
| **TransferItem** | id, transferId, itemId, quantityRequested, quantitySent, quantityReceived | N:1 Transfer · N:1 Item |
| **Worker** | id, documentType, documentNumber, firstName, lastName, position, warehouseId, active, hireDate | N:1 Warehouse · 1:N EPPAssignment |
| **EPPAssignment** | id, workerId, itemId, quantity, assignedAt, returnedAt, replacementReason, signature | N:1 Worker · N:1 Item |
| **ToolLoan** | id, toolItemId, borrowerType (USER/WORKER), borrowerId, warehouseId, loanedAt, dueDate, returnedAt, condition (BUENO/REGULAR/DANADO), notes | N:1 Item · N:1 Warehouse |
| **Equipment** | id, code, name, brand, model, serial, plate, year, equipmentType, currentHorometer, currentKm, warehouseId, status (OPERATIVO/MANTENIMIENTO/INOPERATIVO/BAJA), acquiredAt | N:1 Warehouse · 1:N FuelDispatch · 1:N Maintenance |
| **FuelDispatch** | id, equipmentId, itemId (tipo combustible), quantity, horometerReading, kmReading, dispatchedBy, dispatchedAt, warehouseId | N:1 Equipment · N:1 Item · N:1 Warehouse · N:1 User |
| **Maintenance** | id, equipmentId, type (PREVENTIVO/CORRECTIVO), description, scheduledDate, executedDate, cost (opcional), status (PROGRAMADO/EN_PROCESO/COMPLETADO/CANCELADO), horometerAtService | N:1 Equipment · 1:N MaintenanceItem |
| **MaintenanceItem** | id, maintenanceId, itemId (repuesto), quantity | N:1 Maintenance · N:1 Item |
| **PhysicalInventory** | id, code, warehouseId, scheduledDate, executedDate, status (PROGRAMADO/EN_PROCESO/COMPLETADO), supervisorId | N:1 Warehouse · 1:N PhysicalInventoryItem |
| **PhysicalInventoryItem** | id, physicalInventoryId, itemId, systemQuantity, countedQuantity, difference, notes | N:1 PhysicalInventory · N:1 Item |
| **Requisition** | id, code, warehouseId, requestedBy, status (PENDIENTE/APROBADA/PARCIAL/ATENDIDA/RECHAZADA), priority, notes, createdAt | N:1 Warehouse · N:1 User · 1:N RequisitionItem |
| **RequisitionItem** | id, requisitionId, itemId, quantityRequested, quantityDelivered | N:1 Requisition · N:1 Item |
| **Alert** | id, type (STOCK_MINIMO/VENCIMIENTO/MANTENIMIENTO), itemId, warehouseId, equipmentId, message, level (INFO/WARNING/CRITICAL), read, resolvedAt | N:1 Item · N:1 Warehouse |
| **AuditLog** | id, userId, action, resource, resourceId, changes (JSON), ipAddress, userAgent, createdAt | N:1 User |
| **SystemSetting** | id, key (unique), value, description · Ej: `SETUP_COMPLETED=true` (bloquea el wizard `/setup` tras el primer admin) | — |

### 3.2 Diagrama de Relaciones (resumen textual)

```
User ──── Role ──── Permission
  │         
  └── Movement ──── MovementItem ──── Item ──── Category
                                        │         │
                                        │         └── Unit
                                        │
                                        └── Stock ──── Warehouse
                                                          │
Warehouse ──── Transfer ──── TransferItem                 │
                                                          │
Worker ──── EPPAssignment ──── Item                       │
                                                          │
Equipment ──── FuelDispatch ──── Item                     │
    │                                                     │
    └── Maintenance ──── MaintenanceItem ──── Item        │
                                                          │
PhysicalInventory ──── PhysicalInventoryItem ──── Item    │
                                                          │
Requisition ──── RequisitionItem ──── Item ───────────────┘
```

---

## 4. Módulos del Backend (NestJS)

| Módulo | Responsabilidad | Endpoints principales |
|--------|-----------------|-----------------------|
| **auth** | Login (tipo doc + número + password), logout, refresh, recuperación de contraseña, setup del primer admin | POST /auth/login, POST /auth/refresh, POST /auth/logout, POST /auth/forgot-password, POST /auth/reset-password, GET /auth/setup-status, POST /auth/setup |
| **users** | CRUD usuarios, activación/desactivación | GET/POST/PATCH/DELETE /users, PATCH /users/:id/activate |
| **roles** | CRUD roles, asignación de permisos | GET/POST/PATCH/DELETE /roles, POST /roles/:id/permissions |
| **permissions** | Listado de permisos del sistema (seed) | GET /permissions |
| **warehouses** | CRUD almacenes/obras, asignación de jefe | GET/POST/PATCH/DELETE /warehouses |
| **categories** | CRUD categorías jerárquicas por tipo de ítem | GET/POST/PATCH/DELETE /categories |
| **units** | CRUD unidades de medida | GET/POST/PATCH/DELETE /units |
| **items** | CRUD catálogo maestro, búsqueda, importación masiva | GET/POST/PATCH/DELETE /items, POST /items/import, GET /items/:id/kardex |
| **stock** | Consulta de stock por almacén/global, stock consolidado | GET /stock, GET /stock/warehouse/:id, GET /stock/item/:id |
| **movements** | Registro de entradas, salidas, ajustes | GET/POST /movements, GET /movements/:id, POST /movements/bulk |
| **transfers** | Solicitud, aprobación, envío, recepción de transferencias | GET/POST /transfers, PATCH /transfers/:id/approve, PATCH /transfers/:id/send, PATCH /transfers/:id/receive, PATCH /transfers/:id/reject |
| **tools** | Préstamos y devoluciones de herramientas | GET/POST /tools/loans, PATCH /tools/loans/:id/return |
| **epp** | Asignación y reposición de EPP a trabajadores | GET/POST /epp/assignments, PATCH /epp/assignments/:id/replace |
| **workers** | CRUD trabajadores | GET/POST/PATCH/DELETE /workers |
| **fuel** | Despacho de combustible a maquinaria | GET/POST /fuel/dispatches |
| **equipment** | CRUD maquinaria, hoja de vida, horómetro | GET/POST/PATCH/DELETE /equipment, PATCH /equipment/:id/horometer |
| **maintenance** | Programación y ejecución de mantenimientos | GET/POST /maintenance, PATCH /maintenance/:id/execute, PATCH /maintenance/:id/complete |
| **physical-inventory** | Inventarios físicos, conteos, ajustes | GET/POST /physical-inventory, POST /physical-inventory/:id/items, PATCH /physical-inventory/:id/close |
| **requisitions** | Solicitudes del Residente de Obra | GET/POST /requisitions, PATCH /requisitions/:id/approve, PATCH /requisitions/:id/fulfill |
| **reports** | Reportes agregados | GET /reports/stock-actual, GET /reports/rotacion, GET /reports/consumo-obra, GET /reports/alertas |
| **alerts** | Listado y resolución de alertas | GET /alerts, PATCH /alerts/:id/read, PATCH /alerts/:id/resolve |
| **audit** | Consulta de logs de auditoría | GET /audit |
| **realtime** | WebSocket Gateway (Socket.IO) para eventos en vivo | WS `/realtime` (eventos: `transfer.pending`, `requisition.new`, `alert.stock`, `maintenance.due`, `stock.changed`) |
| **export** | Exportación Excel (ExcelJS) / PDF (Puppeteer con HTML templates) | POST /export/excel, POST /export/pdf |

---

## 5. Módulos / Features del Frontend (Next.js)

| Sección / Pantalla | Propósito | Roles con acceso |
|--------------------|-----------|------------------|
| **Setup (Wizard primer admin)** | Pantalla única que aparece si la DB no tiene usuarios (o si no se corrió el seed). Crea el primer Admin con tipo de documento + número + password | Público (solo primera vez) |
| **Login** | Autenticación con selector de tipo de documento (DNI / CE / Pasaporte) + número + password | Todos (público) |
| **Recuperar contraseña** | Solicitar y confirmar reseteo de password | Todos (público) |
| **Cambio de contraseña forzado** | Si `mustChangePassword = true` (primer login del admin creado por seed), obliga a cambiar antes de entrar | Todos los usuarios en ese estado |
| **Dashboard** | KPIs, alertas críticas en vivo (WS), accesos rápidos | Admin, Jefe, Almacenero, Residente |
| **Almacenes (Listado/CRUD)** | Gestión de obras y almacenes | Admin, Jefe |
| **Categorías / Unidades** | Mantenimiento de maestros | Admin, Jefe |
| **Ítems (Listado/CRUD/Importación)** | Catálogo maestro | Admin, Jefe; Almacenero (solo lectura) |
| **Detalle de Ítem / Kardex histórico** | Ver movimientos históricos y stock por almacén | Admin, Jefe, Almacenero, Residente |
| **Entradas de inventario** | Registro de ingresos (compras, devoluciones) | Admin, Jefe, Almacenero |
| **Salidas de inventario** | Registro de consumos | Admin, Jefe, Almacenero |
| **Ajustes de inventario** | Correcciones de stock | Admin, Jefe |
| **Transferencias (listado, nueva, pendientes)** | Gestión completa del flujo de transferencias | Admin, Jefe, Almacenero (envío/recepción en su almacén), Residente (solicitud) |
| **Herramientas — Préstamos/Devoluciones** | Control de herramientas prestadas | Admin, Jefe, Almacenero |
| **EPP — Asignaciones / Trabajadores** | Asignar EPP a trabajadores | Admin, Jefe, Almacenero |
| **Combustible — Despachos** | Registrar despachos de combustible | Admin, Jefe, Almacenero |
| **Maquinaria — Listado / Hoja de vida** | Gestión de equipos y maquinaria | Admin, Jefe, Residente (solo lectura de su obra) |
| **Maquinaria — Horómetro** | Actualización de horómetro/km | Admin, Jefe, Almacenero |
| **Mantenimientos** | Programar y ejecutar mantenimientos | Admin, Jefe |
| **Inventarios Físicos** | Conteos y cierre de diferencias | Admin, Jefe |
| **Solicitudes (Requisiciones)** | Residente solicita, Jefe aprueba, Almacenero atiende | Admin, Jefe, Almacenero, Residente |
| **Reportes (stock, rotación, consumo, alertas)** | Visualización y exportación | Admin, Jefe, Residente (consumo de su obra) |
| **Usuarios / Roles** | Gestión de accesos | Admin |
| **Auditoría** | Log de acciones sensibles | Admin |
| **Configuración** | Parámetros del sistema | Admin |

---

## 6. Matriz de Roles y Permisos

Formato: `C` = Crear · `R` = Leer · `U` = Actualizar · `D` = Eliminar · `A` = Aprobar · `X` = Acción especial · `—` = Sin acceso

| Recurso / Acción | Admin | Jefe de Almacén | Almacenero | Residente de Obra |
|------------------|:-----:|:---------------:|:----------:|:-----------------:|
| **Usuarios** | CRUD | R | — | — |
| **Roles y Permisos** | CRUD | R | — | — |
| **Almacenes** | CRUD | R U (asignados) | R (asignado) | R (asignado) |
| **Categorías / Unidades** | CRUD | CRU | R | R |
| **Ítems (Catálogo)** | CRUD | CRU | R | R |
| **Importación masiva de ítems** | X | X | — | — |
| **Stock (consulta)** | R (todos) | R (todos) | R (su almacén) | R (su obra) |
| **Entradas de inventario** | CRUD | CRU | CR (su almacén) | — |
| **Salidas de inventario** | CRUD | CRU | CR (su almacén) | — |
| **Ajustes de inventario** | CRUD | CRU A | — | — |
| **Transferencias — Solicitar** | C | C | C | C (de su obra) |
| **Transferencias — Aprobar** | A | A | — | — |
| **Transferencias — Enviar** | X | X | X (su almacén) | — |
| **Transferencias — Recibir** | X | X | X (su almacén) | X (su obra) |
| **Transferencias — Rechazar** | X | X | — | — |
| **Herramientas — Préstamos** | CRUD | CRU | CR (su almacén) | — |
| **Herramientas — Devoluciones** | X | X | X (su almacén) | — |
| **EPP — Asignaciones** | CRUD | CRU | CR (su almacén) | — |
| **Trabajadores** | CRUD | CRU | R | R (su obra) |
| **Combustible — Despachos** | CRUD | CRU | CR (su almacén) | — |
| **Maquinaria** | CRUD | CRU | R | R (su obra) |
| **Maquinaria — Actualizar horómetro** | X | X | X (su almacén) | — |
| **Mantenimientos** | CRUD | CRUD | R | R (su obra) |
| **Inventarios Físicos** | CRUD | CRUD | R (su almacén, ejecutar conteo) | — |
| **Solicitudes — Crear** | C | C | — | C (de su obra) |
| **Solicitudes — Aprobar** | A | A | — | — |
| **Solicitudes — Atender** | X | X | X (su almacén) | — |
| **Reportes — Globales** | R | R | — | — |
| **Reportes — Por almacén** | R | R (asignados) | R (su almacén) | R (su obra) |
| **Alertas** | CRUD | RU | R (su almacén) | R (su obra) |
| **Auditoría** | R | — | — | — |
| **Configuración del sistema** | CRUD | — | — | — |
| **Exportación Excel/PDF** | X | X | X (su almacén) | X (su obra) |

> **Regla transversal:** todos los roles (excepto Admin) están **limitados por ámbito de almacén/obra asignado**. El Admin ve todos los almacenes.

---

## 7. Plan de Trabajo por Fases

### FASE 1 — Setup Inicial e Infraestructura
**Objetivo:** dejar el entorno de desarrollo completo, dockerizado y con CI funcionando.

**Tareas técnicas:**
- [ ] Inicializar monorepo con Turborepo + pnpm workspaces
- [ ] Configurar `apps/web` (Next.js 14+ con App Router, TS, Tailwind, shadcn/ui)
- [ ] Configurar `apps/api` (NestJS 10+ con TS)
- [ ] Configurar `packages/types`, `packages/eslint-config`, `packages/tsconfig`, `packages/utils`
- [ ] Crear `docker-compose.yml` (solo para desarrollo local) con servicios: postgres, pgadmin, api, web
- [ ] Crear `Dockerfile` de desarrollo y producción para web y api
- [ ] Configurar variables de entorno (`.env.example` en cada app)
- [ ] Configurar Prisma + conexión a Postgres + migración inicial vacía
- [ ] Configurar ESLint + Prettier + Husky + lint-staged
- [ ] Configurar Swagger en NestJS
- [ ] Configurar GitHub Actions con pipeline básico (lint + build + test)
- [ ] README con instrucciones claras de arranque

**Entregables:** Monorepo funcionando, `docker-compose up` levanta todo el stack, CI pasa en verde.

**Dependencias:** ninguna
**Criterios de aceptación:**
- Cualquier dev clona el repo y en ≤15 min tiene el entorno arriba.
- `pnpm dev` arranca web (3000) y api (4000) con hot-reload.
- Swagger accesible en `/api/docs`.
- CI valida en cada PR.

---

### FASE 2 — Autenticación, Usuarios, Roles, Permisos y Bootstrap del Primer Admin
**Objetivo:** sistema de acceso completo con RBAC granular, login por tipo de documento y creación segura del primer Admin.

**Tareas técnicas — Modelado y datos base:**
- [ ] Modelar `User` con campos: `documentType` (enum DNI/CE/PASAPORTE), `documentNumber`, `passwordHash`, `firstName`, `lastName`, `email` (opcional), `phone`, `roleId`, `active`, `mustChangePassword`, `lastLoginAt`
- [ ] Índice **único compuesto** en `(documentType, documentNumber)`
- [ ] Modelar `Role`, `Permission`, `RolePermission`
- [ ] Modelar `SystemSetting` (key/value) para flags como `SETUP_COMPLETED`
- [ ] Seed de permisos del sistema y roles base (Admin, Jefe, Almacenero, Residente)

**Tareas técnicas — Validación de documento:**
- [ ] Archivo `validators/document.validator.ts`:
  - DNI: regex `^\d{8}$`
  - CE: regex `^\d{9}$`
  - PASAPORTE: regex `^[A-Z0-9]{6,12}$` (alfanumérico mayúsculas, 6 a 12)
- [ ] DTO `LoginDto` con `class-validator`: `documentType`, `documentNumber` (custom validator según tipo), `password` (min 8)
- [ ] Mismo validador replicado en frontend con Zod para UX inmediata (`lib/document-validators.ts`)

**Tareas técnicas — Bootstrap del primer Admin (Opción A + B híbrida):**
- [ ] **A. Seed automático al levantar el stack:**
  - Script `prisma/seed.ts` lee variables de entorno:
    - `ADMIN_DOC_TYPE`, `ADMIN_DOC_NUMBER`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`
  - Si existen y no hay admin creado → crea el primer Admin con `mustChangePassword = true` y marca `SystemSetting.SETUP_COMPLETED = true`
  - Si no existen las variables → no hace nada (deja vía libre al wizard)
- [ ] **B. Setup Wizard en la UI:**
  - Endpoint `GET /auth/setup-status` retorna `{ setupCompleted: boolean }`
  - Endpoint `POST /auth/setup` (público, pero **bloqueado si `SETUP_COMPLETED = true`**) crea el primer Admin y marca la bandera
  - Página `/setup` en Next.js: si `setupCompleted = true`, redirige a `/login`; si no, muestra formulario (tipoDoc + número + nombres + password + confirmación)
  - Middleware de Next.js: si el backend reporta `setupCompleted = false`, redirigir desde cualquier ruta a `/setup`
- [ ] **Cambio de contraseña forzado:** si al loguearse el user tiene `mustChangePassword = true`, el backend retorna un token de single-use que solo permite `POST /auth/change-password`. Frontend muestra pantalla obligatoria.

**Tareas técnicas — Auth core:**
- [ ] Módulo `auth`: login, refresh, logout, forgot-password, reset-password, setup, setup-status
- [ ] Hash de passwords con **bcrypt** (cost 12)
- [ ] JWT (access 15 min) + Refresh Token (httpOnly cookie, 7 días)
- [ ] Strategies: `JwtStrategy`, `RefreshStrategy`
- [ ] Recuperación de contraseña: token temporal de un solo uso, guardado con hash en DB (sin email externo — endpoint devuelve token en dev; en producción el Admin lo entrega manualmente)

**Tareas técnicas — Autorización RBAC:**
- [ ] Guards: `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `WarehouseScopeGuard` (limita acceso por almacén asignado)
- [ ] Decoradores: `@Public()`, `@Roles()`, `@Permissions()`, `@CurrentUser()`
- [ ] Módulo `users`: CRUD + activación/desactivación + reset de password por Admin
- [ ] Módulo `roles`: CRUD + asignación masiva de permisos
- [ ] Módulo `permissions`: listado (seed-only)

**Tareas técnicas — Frontend:**
- [ ] Página `/login`: `<Select>` de tipo documento + `<Input>` número (con máscara dinámica según tipo seleccionado) + `<Input>` password + mensaje de error claro
- [ ] Página `/setup`: wizard de 1 o 2 pasos para crear primer Admin
- [ ] Página `/recuperar-password` y `/reset-password/[token]`
- [ ] Página `/cambio-password` (obligatoria si `mustChangePassword`)
- [ ] Middleware Next.js: redirección según `setupCompleted` y token válido
- [ ] Provider global `<AuthProvider>` con hook `useAuth()` + `usePermissions()`
- [ ] Componente `<PermissionGate permission="...">` para render condicional
- [ ] Layout dashboard con Sidebar dinámico según permisos
- [ ] Páginas CRUD de usuarios (con `<DocumentInput>` reutilizable) y roles
- [ ] Interceptor de Axios: refresh automático en 401, logout si refresh falla

**Entregables:**
- Login funcional con tipo de documento.
- Wizard de setup + seed automático (ambos caminos probados).
- CRUD de usuarios y roles.
- Sidebar filtrado por permisos.
- Documento `docs/login-bootstrap.md` explicando ambos flujos paso a paso.

**Dependencias:** Fase 1
**Criterios de aceptación:**
- Si levanto el stack con las variables `ADMIN_*` definidas, al entrar por primera vez a la web puedo loguearme como Admin con esas credenciales y se me fuerza el cambio de password.
- Si levanto el stack sin esas variables, la primera visita redirige a `/setup` y puedo crear el Admin desde la UI.
- Tras crear el primer Admin, `/setup` queda bloqueada (retorna 403 o redirige a login).
- Intentar loguearse con DNI de 7 dígitos falla con mensaje claro antes de consultar la DB.
- Intentar loguearse con Pasaporte de 15 caracteres también falla.
- El Admin puede crear un usuario Residente, asignarle un almacén y ese usuario solo ve su obra.
- Token expira y se refresca sin romper la sesión; logout limpia refresh cookie.

---

### FASE 3 — Módulos Maestros (Almacenes, Categorías, Unidades, Ítems)
**Objetivo:** catálogos base sobre los que opera todo el kardex.

**Tareas técnicas:**
- [ ] Modelar Warehouse, Category (jerárquica), Unit, Item en Prisma
- [ ] Migración y seed de unidades comunes (KG, M, UND, GAL, L, etc.)
- [ ] Módulo `warehouses`: CRUD + asignación de jefe
- [ ] Módulo `categories`: CRUD con soporte jerárquico
- [ ] Módulo `units`: CRUD simple
- [ ] Módulo `items`: CRUD, búsqueda avanzada (por código, nombre, categoría, tipo), paginación, filtros
- [ ] Importación masiva de ítems desde Excel (ExcelJS, con preview y validación de filas)
- [ ] Frontend: páginas listado + detalle + formularios (React Hook Form + Zod)
- [ ] Tabla genérica `<DataTable>` reutilizable basada en **TanStack Table v8** (paginación, sort, filtros, column visibility)
- [ ] Upload de imágenes de ítems (local filesystem en dev, volumen de Railway en prod)

**Entregables:** Maestros completos operativos.

**Dependencias:** Fase 2
**Criterios de aceptación:**
- Se pueden crear almacenes tipo CENTRAL y OBRA.
- Categorías soportan jerarquía (padre/hijo) y se diferencian por tipo de ítem.
- Un ítem puede tener código manual o autogenerado (secuencial por categoría).
- Importación masiva valida filas, muestra preview y reporta errores antes de commit.

---

### FASE 4 — Movimientos de Inventario y Kardex
**Objetivo:** registro de entradas, salidas, ajustes, y el kardex histórico.

**Tareas técnicas:**
- [ ] Modelar Stock, Movement, MovementItem en Prisma
- [ ] Módulo `stock`: consulta por almacén, por ítem, consolidado
- [ ] Módulo `movements`: registro con **transacciones atómicas** (actualización de Stock + creación de Movement + MovementItem)
- [ ] Validaciones: no permitir stock negativo en salidas
- [ ] Generación automática de códigos de movimiento (ENT-00001, SAL-00001, AJU-00001)
- [ ] Endpoint de kardex por ítem con filtros (almacén, rango de fechas, tipo)
- [ ] Módulo `alerts`: detección de stock bajo mínimo (hook post-movimiento)
- [ ] Frontend: formularios de entrada/salida con selector múltiple de ítems, autocomplete con debounce
- [ ] Vista de kardex detallado con gráfica de evolución de stock (Recharts)
- [ ] Exportación Excel (ExcelJS) / PDF (Puppeteer con template HTML) del kardex
- [ ] Interceptor de auditoría activo para movimientos

**Entregables:** Movimientos + kardex + alertas + exportación funcionales.

**Dependencias:** Fase 3
**Criterios de aceptación:**
- Una entrada de 100 uds de cemento incrementa stock correctamente.
- Una salida por más de lo disponible falla con mensaje claro.
- El kardex muestra saldo acumulado correcto en cada movimiento.
- Alerta se crea automáticamente cuando un ítem cae bajo el mínimo.

---

### FASE 5 — Transferencias entre Almacenes + Tiempo Real (WebSockets)
**Objetivo:** flujo completo de movimientos entre obras/almacenes con notificaciones en vivo.

**Tareas técnicas — Transferencias:**
- [ ] Modelar Transfer, TransferItem (con estados)
- [ ] Módulo `transfers`: crear solicitud, aprobar, enviar, recibir, rechazar, cancelar
- [ ] En **envío**: descontar stock del origen + crear movimiento SALIDA tipo TRANSFERENCIA
- [ ] En **recepción**: sumar stock al destino + crear movimiento ENTRADA tipo TRANSFERENCIA
- [ ] Manejo de diferencias: cantidad solicitada vs enviada vs recibida
- [ ] Frontend: wizard de solicitud, bandeja de pendientes, detalle con línea de tiempo de estados
- [ ] Reporte de transferencias por rango de fechas

**Tareas técnicas — Tiempo Real (Socket.IO):**
- [ ] Instalar `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` en el API
- [ ] Crear `RealtimeModule` + `RealtimeGateway` con guard JWT para autenticar conexiones
- [ ] Sistema de **rooms** por: usuario, almacén asignado, rol
- [ ] Servicio `RealtimeService` con helpers: `emitToUser()`, `emitToWarehouse()`, `emitToRole()`
- [ ] Emitir evento `transfer.pending` cuando se crea una transferencia con destino al almacén X → se envía al room del Jefe y Almacenero de ese almacén
- [ ] Emitir `transfer.approved`, `transfer.in_transit`, `transfer.received`, `transfer.rejected` según cambios de estado
- [ ] Instalar `socket.io-client` en el frontend
- [ ] `SocketProvider` global con reconexión automática, uso del token JWT para handshake
- [ ] Hook `useSocket()` + `useNotifications()` para consumir eventos
- [ ] Componente `<NotificationBell>` en el header con badge y dropdown
- [ ] Toast (Sonner) al recibir evento crítico
- [ ] Al llegar un evento, invalidar queries relacionadas de TanStack Query (ej. `queryClient.invalidateQueries(['transfers'])`)

**Entregables:** Módulo de transferencias con trazabilidad completa + notificaciones en vivo funcionando.

**Dependencias:** Fase 4
**Criterios de aceptación:**
- Una transferencia atraviesa todos sus estados sin inconsistencias en stock.
- Si el destino recibe menos que lo enviado, se registra la diferencia como "pérdida en tránsito" (ajuste).
- Rechazar una transferencia en tránsito revierte el stock al origen.
- Cuando el Residente de la Obra A solicita una transferencia, el Jefe ve el badge y toast al instante sin recargar la página.
- Al cerrar sesión, la conexión WebSocket se cierra limpiamente.
- Al reconectarse, el cliente vuelve a suscribirse a sus rooms automáticamente.

---

### FASE 6 — Módulos Especializados
**Objetivo:** cubrir los casos particulares del rubro (herramientas, EPP, combustible, maquinaria).

**Sub-fase 6.1 — Herramientas (préstamos/devoluciones)**
- [ ] Modelar ToolLoan
- [ ] Módulo `tools`: préstamo, devolución (con condición)
- [ ] Frontend: pantalla de préstamos activos, historial, alertas de vencimiento

**Sub-fase 6.2 — Trabajadores y EPP**
- [ ] Modelar Worker, EPPAssignment
- [ ] Módulo `workers`: CRUD
- [ ] Módulo `epp`: asignación, reposición con motivo (desgaste/pérdida/daño)
- [ ] Frontend: ficha del trabajador con historial de EPP asignado
- [ ] Reporte de EPP entregado por trabajador/periodo

**Sub-fase 6.3 — Maquinaria y Equipos**
- [ ] Modelar Equipment
- [ ] Módulo `equipment`: CRUD, hoja de vida, actualización de horómetro/km
- [ ] Frontend: listado con filtros por estado, detalle con histórico de horómetro

**Sub-fase 6.4 — Combustible**
- [ ] Modelar FuelDispatch
- [ ] Módulo `fuel`: despacho con lectura de horómetro/km obligatoria
- [ ] Descuento automático de stock del combustible
- [ ] Reporte de consumo por equipo y por periodo

**Sub-fase 6.5 — Mantenimientos**
- [ ] Modelar Maintenance, MaintenanceItem
- [ ] Módulo `maintenance`: programación, ejecución (descuento de repuestos), cierre
- [ ] Alertas de mantenimientos próximos (por fecha o horómetro)
- [ ] Frontend: calendario de mantenimientos programados

**Dependencias:** Fases 3, 4
**Criterios de aceptación:**
- Un despacho de combustible descuenta stock y queda asociado al equipo.
- Un mantenimiento correctivo descuenta repuestos del stock.
- Préstamos vencidos aparecen en alertas.
- EPP asignado queda trazable por trabajador.

---

### FASE 7 — Solicitudes, Inventarios Físicos, Reportes, Dashboards, Alertas en Vivo y Auditoría
**Objetivo:** cerrar el ciclo operativo con los módulos de gestión, análisis y tiempo real.

**Tareas técnicas — Requisiciones e Inventarios físicos:**
- [ ] Modelar Requisition, RequisitionItem
- [ ] Módulo `requisitions`: flujo Residente → Jefe → Almacenero
- [ ] Emitir evento WS `requisition.new` al Jefe cuando el Residente crea una
- [ ] Emitir evento WS `requisition.approved` al Almacenero del almacén origen
- [ ] Generación automática de Movimiento SALIDA al atender requisición
- [ ] Modelar PhysicalInventory + PhysicalInventoryItem
- [ ] Módulo `physical-inventory`: programar conteo, registrar conteos, generar ajustes automáticos por diferencias

**Tareas técnicas — Reportes y Dashboards:**
- [ ] Módulo `reports`: endpoints agregados optimizados (queries con índices, vistas materializadas en tablas pesadas)
- [ ] Reportes: stock actual, rotación, consumo por obra, alertas activas, movimientos por periodo, EPP por trabajador, combustible por equipo
- [ ] Dashboard principal con widgets usando **Tremor** + **Recharts**:
  - KPICards (stock total, valor estimado, transferencias pendientes, alertas críticas)
  - Gráfica de movimientos por día (line chart)
  - Top 10 ítems más consumidos (bar chart)
  - Distribución de stock por almacén (donut chart)
  - Lista de últimos movimientos
  - Panel de alertas críticas en vivo (WS)
- [ ] Frontend: páginas de reportes con filtros avanzados + exportación Excel/PDF
- [ ] Plantillas HTML para Puppeteer (PDFs con logo de la empresa, cabeceras, pies con numeración de página, gráficas renderizadas)

**Tareas técnicas — Alertas en vivo:**
- [ ] Emitir evento WS `alert.stock` cuando un movimiento deja un ítem bajo stock mínimo (broadcast a Jefe + Almacenero del almacén)
- [ ] Emitir evento WS `maintenance.due` (scheduled job diario que verifica mantenimientos próximos y notifica)
- [ ] Emitir evento WS `stock.changed` solo al room del almacén activo del usuario (para refresh automático del kardex/stock visible)
- [ ] Página `/alertas`: listado con filtros, marcar como leída, resolver

**Tareas técnicas — Auditoría:**
- [ ] Módulo `audit`: consulta de logs con filtros (usuario, acción, recurso, fecha)
- [ ] Interceptor global de auditoría ya conectado desde Fase 2 (ajustes finales)
- [ ] Frontend: página de auditoría con tabla virtualizada (TanStack Table)

**Entregables:** Ciclo operativo completo + visibilidad ejecutiva.

**Dependencias:** Fases 4, 5, 6
**Criterios de aceptación:**
- Un Residente solicita materiales y el Almacenero los atiende generando salida.
- Un inventario físico con diferencias genera ajustes y deja traza.
- Los reportes retornan en <2s con datos reales.
- Dashboard carga en <1.5s con SSR.

---

### FASE 8 — Testing, Hardening, Despliegue en Railway y Documentación
**Objetivo:** producto listo para presentación al cliente, desplegado en Railway con dominio por defecto.

**Tareas técnicas — Testing:**
- [ ] Tests unitarios en servicios críticos (movements, transfers, stock, auth): cobertura ≥ 70%
- [ ] Tests de integración en endpoints clave (auth, movements, transfers, requisitions)
- [ ] Tests E2E con Playwright en flujos principales:
  - Setup inicial (wizard de primer Admin)
  - Login con los 3 tipos de documento
  - Crear ítem, registrar entrada, transferir entre almacenes
  - Requisición completa (Residente → Jefe → Almacenero)
  - Recepción de notificaciones en vivo (WebSocket)

**Tareas técnicas — Seguridad y optimización:**
- [ ] Helmet, CORS estricto (solo dominio Railway del frontend), rate-limiting (`@nestjs/throttler`)
- [ ] Validación exhaustiva de inputs (class-validator + Zod)
- [ ] Sanitización de strings que van a PDFs (prevenir inyección en templates)
- [ ] Optimización: índices en DB, paginación obligatoria, consultas N+1 revisadas con Prisma
- [ ] Logs estructurados con **pino** (Railway captura stdout automáticamente)
- [ ] Health checks en api (`/health`) y web (`/api/health`) — usados por Railway para restart policy

**Tareas técnicas — Despliegue en Railway (producción única):**
- [ ] Crear proyecto en Railway con 3 servicios:
  1. **PostgreSQL** (managed — Railway Postgres addon)
  2. **api** (desde `apps/api`) — con `DATABASE_URL` inyectada automáticamente
  3. **web** (desde `apps/web`) — con `NEXT_PUBLIC_API_URL` apuntando al api
- [ ] Configurar `railway.json` con builders Nixpacks o Docker
- [ ] Variables de entorno en Railway:
  - `DATABASE_URL` (auto)
  - `JWT_SECRET`, `JWT_REFRESH_SECRET`
  - `ADMIN_DOC_TYPE`, `ADMIN_DOC_NUMBER`, `ADMIN_PASSWORD` (opcional — seed del primer Admin)
  - `NODE_ENV=production`
  - `CORS_ORIGIN` con dominio del web
- [ ] Habilitar **Railway WebSocket support** (está habilitado por defecto, pero verificar timeouts)
- [ ] Configurar dominio por defecto `*.up.railway.app` para web y api
- [ ] Ejecutar migraciones Prisma en deploy: hook `prisma migrate deploy` antes de `start`
- [ ] Correr seed al primer deploy (solo una vez)
- [ ] GitHub Actions: workflow `deploy-railway.yml` que despliega en push a `main`
- [ ] Probar el flujo completo en producción con el dominio Railway

**Tareas técnicas — Documentación:**
- [ ] Guía de usuario por rol (Admin, Jefe, Almacenero, Residente) con capturas
- [ ] `docs/login-bootstrap.md`: cómo se crea el primer admin (seed vs wizard)
- [ ] `docs/deployment.md`: pasos para replicar el despliegue en Railway
- [ ] Diagrama ER actualizado (generado con `prisma-erd-generator`)
- [ ] README final con links al entorno de producción
- [ ] Manual de presentación al cliente (guion de demo con datos de prueba)

**Entregables:** Producto desplegado en Railway, documentado, listo para presentar al cliente.

**Dependencias:** todas las anteriores
**Criterios de aceptación:**
- La URL pública de Railway carga el sistema sin errores.
- El primer Admin se crea correctamente (seed o wizard) en producción.
- Los WebSockets funcionan sobre HTTPS/WSS en Railway.
- Los PDFs se generan correctamente en producción (Puppeteer con Chromium en contenedor).
- CI despliega automáticamente en cada merge a `main`.
- Documentación completa y datos de demo cargados para la presentación.

> **Nota:** No se configuran backups porque este deploy es solo para presentación al cliente. Si el cliente aprueba y se pasa a producción real, se debe agregar Railway Pro con backups automáticos o script externo.

---

## 8. Equipo y Riesgos

### 8.1 Equipo Mínimo Recomendado

| Rol | Cantidad | Dedicación |
|-----|:--------:|------------|
| Tech Lead / Arquitecto | 1 | 50% (apoyo técnico, revisiones, decisiones) |
| Desarrollador Backend (NestJS/Prisma) | 1 — 2 | 100% |
| Desarrollador Frontend (Next.js) | 1 — 2 | 100% |
| Diseñador UI/UX | 1 | 50% (primeras fases, después consultas puntuales) |
| QA / Tester | 1 | 50% desde Fase 4 en adelante |
| Product Owner / Analista Funcional | 1 | 50% (definir reglas de negocio, validar entregables) |
| DevOps | 1 | 25% (Fases 1 y 8 principalmente) |

**Recomendación:** equipo core de **3 a 5 personas full-time** durante todo el proyecto.

### 8.2 Riesgos Principales y Mitigaciones

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|:-------:|:------------:|------------|
| Reglas de negocio cambian a mitad del proyecto | Alto | Alta | Validar con stakeholders al inicio de cada fase + demos quincenales |
| Concurrencia en movimientos de stock (doble despacho) | Alto | Media | Transacciones atómicas + locks optimistas/pesimistas en Stock |
| Importación masiva de datos legacy sucios | Medio | Alta | Plantilla Excel estricta + validación exhaustiva + preview antes de commit |
| Usuarios con baja alfabetización digital | Medio | Alta | UX simple con selectores y autocomplete, capacitación presencial |
| Conectividad intermitente en obra | Alto | Media | Plan futuro de modo offline con sincronización (fuera de este alcance — dejarlo escalable) |
| Performance en reportes con mucho histórico | Medio | Media | Índices, paginación, vistas materializadas, caché en TanStack Query |
| Seguridad (accesos indebidos) | Alto | Baja | RBAC estricto, auditoría, validación estricta de tipo de documento |
| Pérdida de datos en entorno de presentación | Medio | Media | Seed con datos de demo reproducibles; sin backups (presentación al cliente) |
| WebSockets fallan en Railway por timeouts | Medio | Baja | Heartbeat/ping cada 25s + reconexión automática en cliente |
| Puppeteer no arranca en contenedor Railway | Alto | Media | Usar imagen base con Chromium preinstalado o `@sparticuz/chromium` para slim |

---

## 9. Próximos Pasos Inmediatos

Primeras 10 tareas priorizadas para arrancar la **Fase 1**:

1. **Aprobación formal del plan** por parte del sponsor (alcance, tiempos, equipo).
2. **Inicializar repositorio Git** con estructura monorepo (Turborepo + pnpm).
3. **Crear `apps/api`** con NestJS + Prisma + conexión a Postgres.
4. **Crear `apps/web`** con Next.js 14 App Router + Tailwind + shadcn/ui.
5. **Escribir `docker-compose.yml`** con postgres, pgadmin, api, web.
6. **Configurar `packages/types`, `packages/eslint-config`, `packages/tsconfig`**.
7. **Definir convenciones de commits** (Conventional Commits) y **estrategia de branches** (trunk-based o Git Flow).
8. **Configurar Husky + lint-staged + Prettier + ESLint** en todo el monorepo.
9. **Configurar GitHub Actions** (lint + typecheck + build en cada PR).
10. **Crear tablero de gestión** (Jira / Linear / GitHub Projects) con las fases y tareas de este plan como backlog inicial.

---

## 10. Convenciones y Estándares del Proyecto

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- **Branches:** `main` (producción) · `develop` (integración) · `feature/*` · `fix/*` · `hotfix/*`
- **Code Review:** mínimo 1 aprobación, CI en verde obligatorio
- **Nombres de archivos:** `kebab-case` para archivos, `PascalCase` para componentes React
- **API:** REST con OpenAPI/Swagger, respuestas en formato `{ data, meta, error }` consistente
- **Fechas:** ISO 8601 en API, zona horaria del servidor documentada
- **Idiomas:** código en inglés, UI en español, documentación en español

---

## 11. Diseño Frontend Profesional — Lineamientos

> **Objetivo:** entregar una interfaz **elegante, moderna y profesional**, con una experiencia pulida que transmita confianza al cliente durante la presentación. No basta con que funcione: debe verse y sentirse como un producto premium.

### 11.1 Sistema de Diseño (Design System)

| Elemento | Definición |
|----------|------------|
| **Base UI** | shadcn/ui sobre Radix UI (accesibilidad AA garantizada) + TailwindCSS |
| **Inspiración** | Dashboards de Linear, Vercel, Stripe, Tremor Pro — estética minimalista, generosa en espacio, contraste calibrado |
| **Tema** | Soporte **dark mode + light mode** con `next-themes` (persistencia por usuario) |
| **Paleta** | Primario neutro (slate/zinc) + un **color de acento** (azul corporativo o personalizable por el cliente) · Semánticos: verde (éxito), ámbar (warning), rojo (error/crítico), azul (info) |
| **Tipografía** | **Inter** (sans) como principal + **JetBrains Mono** para códigos/números · Cargada vía `next/font` (sin FOUC, sin request externo) |
| **Escala tipográfica** | Sistema modular: `text-xs` 12 → `text-sm` 14 → `text-base` 15 → `text-lg` 18 → `text-xl` 20 → `text-2xl` 24 → `text-3xl` 30 → `text-4xl` 36 |
| **Espaciado** | Grid base de 4px (TailwindCSS default). Secciones con `gap-4/6/8` según jerarquía |
| **Radius** | `rounded-lg` (8px) para inputs/cards · `rounded-xl` (12px) para contenedores grandes · `rounded-2xl` (16px) para hero sections |
| **Sombras** | Uso sutil: `shadow-sm` por defecto, `shadow-md` en hover de cards clickeables. Evitar sombras pesadas |
| **Iconografía** | **Lucide Icons** (coherente con shadcn/ui) · tamaño estándar 16/20/24 px |

### 11.2 Principios de UX

1. **Jerarquía visual clara:** un único punto focal por pantalla. Acciones primarias destacadas, secundarias en ghost/outline.
2. **Consistencia:** los mismos patrones siempre se ven igual (listado, detalle, formulario, confirmación).
3. **Feedback inmediato:** toda acción muestra respuesta en <100ms (spinner, skeleton, toast, optimistic update).
4. **Estados vacíos con sentido:** no mostrar tablas vacías; mostrar ilustración simple + CTA ("No hay transferencias aún — Crea la primera").
5. **Progressive disclosure:** mostrar lo esencial por defecto, expandir detalles bajo demanda.
6. **Accesibilidad AA:** contraste mínimo 4.5:1, navegación por teclado, `aria-labels`, focus-ring visible.
7. **Responsive-first:** diseño móvil (≥360px), tablet (≥768px), desktop (≥1024px), wide (≥1440px).
8. **Internacionalización preparada:** textos fuera del JSX (archivo `messages/es.json`) aunque solo haya español.

### 11.3 Componentes de Interfaz Clave

| Patrón | Implementación |
|--------|----------------|
| **App Shell** | Sidebar colapsable (ancho 256px / 64px colapsada) + Header sticky (64px) + Main con `max-w-screen-2xl mx-auto` |
| **Sidebar** | Logo + selector de almacén activo + navegación agrupada por sección + perfil del usuario abajo · Iconos + texto, colapsa a solo iconos |
| **Header** | Breadcrumbs + buscador global (cmd+k) + selector de tema + campanita de notificaciones (WS) + avatar/menú |
| **Cards** | Bordes `border` en lugar de shadows pesadas, padding `p-6`, hover sutil (`hover:bg-muted/50`) si es clickeable |
| **Tablas (DataTable)** | TanStack Table con header sticky, zebra rows opcional, paginación abajo, acciones en popover al hover, filtros en toolbar superior, column visibility toggle |
| **Formularios** | React Hook Form + Zod + componentes `<Form>` de shadcn · labels arriba, helper text debajo, error en rojo con icono, botones al final alineados a la derecha |
| **Modales / Dialogs** | Radix Dialog con overlay `bg-black/60 backdrop-blur-sm`, animación suave, cierre con ESC/click fuera |
| **Drawers** | Para formularios largos (alternativa a modal) — desde la derecha, ancho 480/640/800px según contenido |
| **Command Palette (⌘K)** | `cmdk` con shadcn — búsqueda global de ítems, almacenes, usuarios; atajos a pantallas frecuentes |
| **Toasts** | Sonner con posición bottom-right, auto-dismiss, acciones inline (Deshacer) |
| **Empty States** | Ilustración SVG ligera + título + descripción + CTA primario |
| **Skeletons** | `<Skeleton>` de shadcn en todos los loading states (tablas, cards, gráficas) — nunca spinners genéricos a pantalla completa |
| **Tooltips** | Solo para iconos sin label — nunca como único medio de transmitir info crítica |
| **Badges / Pills** | Para estados (transferencia pendiente, stock bajo) con color semántico consistente |
| **Progress Indicators** | Barra superior global (nprogress-style) en navegación entre páginas |

### 11.4 Pantallas Destacadas (mood)

- **Dashboard:** grid de KPICards en la parte superior (stock total, alertas críticas, transferencias pendientes, requisiciones por atender) → debajo gráficas Tremor/Recharts con filtros de rango de fecha → al pie últimos 5 movimientos + panel de alertas en vivo.
- **Kardex del ítem:** hero con info del ítem (imagen, código, categoría, stock consolidado) → tabs (Movimientos | Stock por almacén | Histórico gráfico) → tabla dense con saldo acumulado en columna fija.
- **Listado de ítems:** barra de filtros arriba (categoría, tipo, almacén, texto libre) → DataTable con thumbnails → click abre drawer con vista rápida.
- **Login:** split layout — izquierda: formulario centrado con logo y branding · derecha: imagen/ilustración de construcción con gradiente sutil. Transiciones suaves entre estados.
- **Setup wizard:** card centrado con pasos numerados, progreso visual arriba, botones grandes, mensajes tranquilizadores ("Solo la primera vez — tomará 1 minuto").

### 11.5 Microinteracciones y Animaciones

- **Framer Motion** para transiciones de página, fade-in de cards, animaciones de listados.
- **View Transitions API** (soporte Next.js 15) en navegación entre rutas relacionadas.
- Hover states sutiles (200ms ease-in-out).
- Números animados en KPICards al cargar (`react-countup` o Motion).
- Spinners solo cuando el skeleton no tiene sentido (ej. botón de submit).

### 11.6 Librerías de Apoyo al Diseño

| Propósito | Librería |
|-----------|----------|
| **Design primitives** | shadcn/ui + Radix UI |
| **Iconos** | lucide-react |
| **Temas (dark/light)** | next-themes |
| **Command Palette** | cmdk |
| **Animaciones** | framer-motion |
| **Gráficas** | recharts + @tremor/react |
| **Tablas** | @tanstack/react-table |
| **Toasts** | sonner |
| **Fechas** | react-day-picker (ya viene con shadcn) |
| **Font loader** | next/font |

### 11.7 Integración en las Fases

El diseño no es una fase aislada, se integra transversalmente:

- **Fase 1:** configurar Tailwind con paleta + tipografía + dark mode + instalar shadcn/ui inicial.
- **Fase 2:** diseñar pantallas de login, setup, recuperación con el layout split profesional.
- **Fase 3:** construir componentes base reutilizables (`<DataTable>`, `<FormField>`, `<PageHeader>`, `<EmptyState>`, `<StatusBadge>`).
- **Fase 4 en adelante:** aplicar los componentes base a cada módulo manteniendo consistencia.
- **Fase 7:** dashboard pulido con Tremor/Recharts, microinteracciones en KPIs, paneles en vivo.
- **Fase 8:** revisión global de consistencia, pulido de detalles, modo oscuro revisado en todas las pantallas, capturas oficiales para la presentación al cliente.

### 11.8 Criterios de Calidad Visual (Definition of Done estético)

- [ ] Todas las pantallas funcionan en dark y light mode sin glitches.
- [ ] Contraste verificado con axe-devtools en todas las páginas.
- [ ] Navegación completa por teclado en formularios y tablas.
- [ ] Ningún spinner a pantalla completa — skeletons en loading states.
- [ ] Empty states con ilustración + CTA en listados sin datos.
- [ ] Transiciones suaves entre rutas (no saltos bruscos).
- [ ] Tipografía y espaciado consistentes (auditoría visual al cierre de cada fase).
- [ ] Iconos todos de Lucide (sin mezclar librerías).
- [ ] Mobile usable (la app no será mobile-first pero debe verse decente ≥360px).
- [ ] Capturas profesionales del producto listas para la presentación.

---

## 12. Flujo Detallado de Login y Bootstrap del Primer Admin

### 12.1 Tipos de Documento y Validaciones

| Tipo | Código | Formato | Validación (regex) | Ejemplo válido |
|------|:------:|---------|--------------------|----------------|
| DNI (Documento Nacional de Identidad) | `DNI` | 8 dígitos numéricos | `^\d{8}$` | `12345678` |
| Carné de Extranjería | `CE` | 9 dígitos numéricos | `^\d{9}$` | `123456789` |
| Pasaporte | `PASAPORTE` | Alfanumérico mayúsculas, 6 a 12 caracteres | `^[A-Z0-9]{6,12}$` | `AB123456`, `X1Y2Z3W4` |

**Implementación:**
- Validación duplicada en backend (`class-validator` custom decorator) y frontend (Zod schema) para UX inmediata.
- El `<Select>` de tipo de documento cambia la **máscara del input** de número dinámicamente.
- Mensajes de error específicos: _"El DNI debe tener exactamente 8 dígitos numéricos"_.

### 12.2 Identidad del Usuario

- La identidad NO se hace por email (email es opcional).
- Clave única compuesta: **`(documentType, documentNumber)`**.
- En la tabla `users` hay un `UNIQUE INDEX` sobre esas dos columnas.
- Dos usuarios pueden compartir el mismo número si tienen distinto tipo (ej. un DNI `12345678` y un Pasaporte `12345678`).

### 12.3 Payload de Login

```json
POST /auth/login
{
  "documentType": "DNI",
  "documentNumber": "12345678",
  "password": "MiPasswordSegura123"
}
```

**Respuesta exitosa:**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "user": {
      "id": "uuid",
      "documentType": "DNI",
      "documentNumber": "12345678",
      "firstName": "Juan",
      "lastName": "Pérez",
      "role": { "name": "ADMIN", "permissions": [...] },
      "warehouses": [...],
      "mustChangePassword": false
    }
  }
}
```
El `refreshToken` viaja en una cookie `httpOnly`, no en el JSON.

### 12.4 Bootstrap del Primer Admin — Flujo Completo

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    1. DEPLOY INICIAL (Docker o Railway)                  │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
             ┌───────────────────┴───────────────────┐
             │                                       │
    ¿Variables ADMIN_*                       ¿Variables ADMIN_*
     definidas en .env?                       definidas en .env?
             │ SÍ                                    │ NO
             ▼                                       ▼
  ┌─────────────────────────┐            ┌─────────────────────────┐
  │  OPCIÓN A - SEED AUTO   │            │  OPCIÓN B - WIZARD UI   │
  ├─────────────────────────┤            ├─────────────────────────┤
  │ prisma/seed.ts crea:    │            │ SETUP_COMPLETED = false │
  │ - Admin con:            │            │ Primera visita al web:  │
  │   • documentType        │            │   redirect a /setup     │
  │   • documentNumber      │            │                         │
  │   • password (hash)     │            │ Usuario completa:       │
  │ - Marca                 │            │ - Tipo doc + número     │
  │   SETUP_COMPLETED=true  │            │ - Nombres + apellidos   │
  │ - mustChangePassword=   │            │ - Password + confirmar  │
  │   true                  │            │                         │
  └───────────┬─────────────┘            │ POST /auth/setup        │
              │                          │ → crea Admin            │
              │                          │ → SETUP_COMPLETED=true  │
              │                          └───────────┬─────────────┘
              │                                      │
              └──────────────────┬───────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────────┐
                    │  2. Admin se loguea con    │
                    │     tipoDoc + número + pwd │
                    └──────────────┬─────────────┘
                                   │
                    ┌──────────────┴─────────────┐
                    │  3. ¿mustChangePassword?   │
                    └──────┬───────────────┬─────┘
                           │ SÍ            │ NO
                           ▼               ▼
               ┌──────────────────┐   ┌─────────────────┐
               │ Redirige a       │   │ Entra al        │
               │ /cambio-password │   │ dashboard       │
               │ (obligatorio)    │   │                 │
               └──────────────────┘   └─────────────────┘
```

### 12.5 Variables de Entorno del Seed Automático

```env
# apps/api/.env (o variables en Railway)
ADMIN_DOC_TYPE=DNI                          # DNI | CE | PASAPORTE
ADMIN_DOC_NUMBER=12345678                   # formato según tipo
ADMIN_PASSWORD=CambiarEn_PrimerLogin_2026   # se fuerza cambio al primer login
ADMIN_FIRST_NAME=Administrador
ADMIN_LAST_NAME=Principal
ADMIN_EMAIL=admin@empresa.com               # opcional
```

### 12.6 Protecciones de Seguridad

- El endpoint `POST /auth/setup` está **público** pero devuelve **403** si `SystemSetting.SETUP_COMPLETED = true`.
- La página `/setup` del frontend verifica `GET /auth/setup-status` antes de renderizar; si ya está completado, redirige a `/login`.
- El seed solo crea el Admin si **no existe ningún usuario en la tabla `users`**.
- El password del seed se hashea con bcrypt antes de guardarlo (nunca se guarda en texto plano, ni siquiera temporalmente).
- En Railway, las variables `ADMIN_*` se pueden borrar después del primer deploy exitoso.

---

> **Versión del plan:** 3.0
> **Fecha:** 2026-04-21
> **Estado:** Ajustado — incluye diseño profesional, tiempo real, bootstrap híbrido y despliegue en Railway
> **Cambios v2 → v3:**
> - Agregada sección 11 con lineamientos completos de diseño frontend profesional (design system, principios UX, componentes, pantallas destacadas, microinteracciones, criterios de calidad visual)
> - Removidas todas las estimaciones de tiempo (a nivel fase y a nivel global)
> - Sección 8 renombrada a "Equipo y Riesgos"
> - Sección de login renumerada a 12
> **Cambios v1 → v2 (previos):**
> - Login con `documentType` + `documentNumber` + validaciones por tipo
> - Flujo de bootstrap del primer Admin (seed + wizard)
> - Tiempo real híbrido (TanStack Query + Socket.IO Gateway)
> - Stack de reportes/gráficas (Recharts, Tremor, TanStack Table, Sonner, ExcelJS, Puppeteer, date-fns)
> - Despliegue en Railway (Postgres managed, dominio por defecto, sin backups)
> - Removida generación de códigos QR/barras
