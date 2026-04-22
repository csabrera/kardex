# @kardex/api

NestJS backend for the Kardex system.

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 20+ / npm 11+
- Docker running (PostgreSQL + Redis via `docker-compose up -d` in repo root)

### 2. Install dependencies

From repo root:

```bash
npm install
```

### 3. Configure env

```bash
cp .env.example .env
# Edit .env as needed (defaults work for local dev)
```

### 4. Run database migrations

```bash
npm run prisma:generate        # Generate Prisma client
npm run prisma:migrate          # Apply migrations (create DB schema)
npm run prisma:seed             # Load seed data (roles, permissions, optional admin)
```

### 5. Start dev server

```bash
npm run dev
```

The API will be available at:

- **API:** http://localhost:4000/api
- **Health:** http://localhost:4000/health
- **Swagger:** http://localhost:4000/docs

---

## 📋 Scripts

| Command                      | What it does                              |
| ---------------------------- | ----------------------------------------- |
| `npm run dev`                | Start dev server with hot-reload          |
| `npm run build`              | Build for production (output in `dist/`)  |
| `npm run start:prod`         | Run production build                      |
| `npm run lint`               | Lint + auto-fix                           |
| `npm run type-check`         | TypeScript type check (no emit)           |
| `npm run test`               | Run unit tests                            |
| `npm run test:watch`         | Unit tests in watch mode                  |
| `npm run test:cov`           | Unit tests with coverage                  |
| `npm run test:e2e`           | Integration/E2E tests                     |
| `npm run prisma:generate`    | Regenerate Prisma Client                  |
| `npm run prisma:migrate`     | Create + apply new migration              |
| `npm run prisma:studio`      | Open Prisma Studio (DB GUI) at :5555      |
| `npm run prisma:seed`        | Run seed script                           |
| `npm run prisma:reset`       | Drop + recreate DB (DESTRUCTIVE)          |

---

## 📦 Structure

```
apps/api/
├── prisma/
│   ├── schema.prisma          # Database schema (DO NOT edit without migration)
│   ├── seed.ts                # Seed script (roles, permissions, first admin)
│   └── migrations/            # Auto-generated migration history
├── src/
│   ├── main.ts                # Entry point (bootstrap, Swagger, Helmet, CORS)
│   ├── app.module.ts          # Root module
│   ├── common/
│   │   ├── dto/               # Reusable DTOs (PaginationQueryDto, etc.)
│   │   ├── exceptions/        # BusinessException
│   │   ├── filters/           # AllExceptionsFilter (global error handler)
│   │   └── interceptors/      # TransformInterceptor (response envelope)
│   ├── config/
│   │   ├── configuration.ts   # Typed config tree
│   │   └── env.validation.ts  # class-validator env check
│   ├── prisma/
│   │   ├── prisma.module.ts   # Global Prisma module
│   │   └── prisma.service.ts  # Prisma Client wrapper
│   └── modules/
│       └── health/            # Liveness + DB health check
└── test/                      # E2E integration tests
```

---

## 🧩 Key Conventions

### Error Handling

Throw `BusinessException` for known business-rule violations:

```typescript
import { BusinessException } from '@/common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import { HttpStatus } from '@nestjs/common';

throw new BusinessException(
  BusinessErrorCode.STOCK_INSUFFICIENT,
  `Stock disponible: ${available}, solicitado: ${requested}`,
  HttpStatus.CONFLICT,
  { available, requested },
);
```

The `AllExceptionsFilter` serialises this into the shared `ApiError` envelope.

### Response Envelope

Every successful response is wrapped by `TransformInterceptor`:

```json
{
  "data": {
    "id": "abc123",
    "name": "Cemento"
  },
  "meta": {
    "timestamp": "2026-04-21T22:30:00.000Z",
    "requestId": "..."
  }
}
```

Return raw data from your controllers — do NOT wrap manually.

### Pagination

Use the shared `PaginationQueryDto`:

```typescript
import { PaginationQueryDto } from '@/common/dto/pagination.dto';

@Get()
async list(@Query() query: PaginationQueryDto) {
  // query.page, query.pageSize, query.sortBy, query.sortOrder, query.search
}
```

---

## 🧪 Testing

### Unit Tests

Located alongside source files as `*.spec.ts`:

```bash
npm run test
```

### E2E / Integration Tests

Separate suite using a real PostgreSQL test DB.

Playwright E2E tests (full UI flows) live in the repo-root `testing/` package.

---

## 🔐 Security

- `helmet` middleware enabled (stricter CSP in production)
- CORS restricted to `CORS_ORIGIN` from env
- Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`
- JWT secrets validated at boot (env.validation.ts)
- Errors do not leak stack traces in production

---

## 📚 More Info

- Root README: [../../README.md](../../README.md)
- Full plan: [../../plan-kardex-refactorizado.md](../../plan-kardex-refactorizado.md)
- ADRs: [../../docs/adr/](../../docs/adr/)
