# Kardex — Sistema de Inventario para Empresas Constructoras

> Solución integral de gestión de almacenes, inventario, transferencias, equipos y reportes para construcción.

## 🚀 Stack

- **Frontend:** Next.js 14+ (App Router, SSR, TailwindCSS, shadcn/ui)
- **Backend:** NestJS 10+ (REST, WebSocket, Prisma ORM)
- **Database:** PostgreSQL 16
- **Cache & Queue:** Redis + BullMQ
- **Testing:** Playwright (E2E)
- **Monorepo:** Turborepo + npm workspaces
- **Infrastructure:** Docker Compose (dev), Railway (presentation)

## 📋 Requisitos

- **Node.js:** v20+ (recomendado v24+)
- **npm:** v11+
- **Docker & Docker Compose:** (para PostgreSQL + Redis)
- **VS Code:** (recomendado, con extensiones ESLint + Prettier)

## 🏃 Quick Start

### 1. Clonar Repo (cuando esté en GitHub)

```bash
git clone <repo-url>
cd kardex
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` según tus necesidades (defaults están OK para local dev).

### 4. Levantar Docker (PostgreSQL + Redis)

```bash
docker-compose up -d
```

Verifica que estén arriba:

```bash
docker-compose ps
```

Deberías ver 3 servicios: `postgres`, `redis`, `pgadmin`.

### 5. Inicializar Base de Datos (Prisma)

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma db seed
cd ../..
```

Esto crea las tablas y carga datos de prueba.

### 6. Levantar Dev Server

```bash
npm run dev
```

Deberías ver:

```
> api dev
  ▲ Next.js 14.x
  - ready on http://localhost:3000

> @nestjs/core
  [Nest] 12345 - 04/21/2026, 10:30:00 AM     LOG [NestFactory] Nest application successfully started
  - Listening on port 4000
```

### 7. Acceder a la App

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:4000
- **API Docs (Swagger):** http://localhost:4000/docs
- **pgAdmin:** http://localhost:5050 (Email: admin@kardex.local, Password: admin)

## 📦 Estructura del Monorepo

```
kardex/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # NestJS backend
├── packages/
│   ├── types/        # Tipos TS compartidos
│   ├── ui/           # Componentes reutilizables
│   ├── utils/        # Utilidades comunes
│   ├── eslint-config/
│   └── tsconfig/
├── testing/          # Tests E2E (Playwright)
├── docs/
│   ├── adr/          # Architecture Decision Records
│   └── ...
├── docker/           # Dockerfiles + scripts
└── docker-compose.yml
```

## 🛠️ Comandos Principales

```bash
# Development
npm run dev              # Levanta web + api con hot-reload

# Building
npm run build            # Build production de web + api

# Linting & Type Checking
npm run lint             # ESLint en todo el monorepo
npm run type-check       # TypeScript check sin emit

# Testing
npm run test             # Tests unitarios
npm run test:e2e         # Tests E2E (Playwright)
npm run test:coverage    # Tests con reporte de cobertura

# Database
cd apps/api
npx prisma migrate dev   # Crear migración nuevo schema
npx prisma studio       # UI para navegar DB
npx prisma db seed      # Cargar datos de seed
cd ../..

# Clean
npm run clean            # Elimina node_modules + build artifacts
```

## 📖 Documentación

- **[Plan de Trabajo](./plan-kardex-refactorizado.md)** — Fases, estimaciones, arquitectura
- **[ADRs](./docs/adr/)** — Decisiones arquitectónicas justificadas
- **[API Contracts](./docs/api-contracts.md)** — DTOs y endpoints (próximamente)
- **[Testing Guide](./docs/testing.md)** — Cómo correr E2E (próximamente)
- **[RBAC Matrix](./docs/rbac-matrix.md)** — Permisos por rol (próximamente)

## 🔧 Troubleshooting

### Docker no inicia

```bash
# Limpiar volúmenes
docker-compose down -v

# Reiniciar
docker-compose up -d
```

### Prisma error "connect ECONNREFUSED"

```bash
# Asegurar que postgres está healthy
docker-compose logs postgres

# Si está arriba, reiniciar API
cd apps/api && npx prisma db push
```

### Puerto 5432 (PostgreSQL) ya en uso

```bash
# Cambiar puerto en docker-compose.yml
# Línea "5432:5432" → "5433:5432"
# Y actualizar DATABASE_URL en .env.local
DATABASE_URL=postgresql://kardex_user:kardex_password@localhost:5433/kardex_db
```

## 📊 Status del Proyecto

**Fase Actual:** Fase 1A (Setup Infraestructura)

| Fase | Estado | ETA |
|------|--------|-----|
| **Fase 0** | ✅ Completada | - |
| **Fase 1A** | 🔄 En Progreso | - |
| **Fase 1B** | ⏳ Pendiente | - |
| Resto | ⏳ Pendiente | - |

Ver [Plan Refactorizado](./plan-kardex-refactorizado.md) para detalles.

## 🤝 Convenciones de Código

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, etc.)
- **Branches:** `main` (prod), `develop` (integration), `feature/*` (features)
- **Code Style:** ESLint + Prettier (auto-format en save)
- **IDE:** VS Code recomendado

## 📝 Licencia

Privado - Empresa Constructora

## 👤 Autor

Desarrollado con ❤️ para optimizar la gestión de inventario.

---

**¿Preguntas?** Ver [docs/](./docs/) o crear un issue.
