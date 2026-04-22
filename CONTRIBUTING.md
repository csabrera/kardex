# Contributing to Kardex

## 🎯 Guía para Desarrolladores

### Convenciones de Commits (Conventional Commits)

Todos los commits deben seguir el formato:

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Types

- **feat:** Nueva feature
- **fix:** Bug fix
- **chore:** Cambios en build, deps, tooling
- **docs:** Documentación
- **refactor:** Cambios de código sin añadir features
- **test:** Agregar/actualizar tests
- **perf:** Mejoras de performance

#### Scopes

Ejemplos: `auth`, `movements`, `transfers`, `api`, `web`, `db`, `types`, `e2e`

#### Ejemplos

```
feat(auth): add document type validation

fix(stock): fix optimistic locking collision on parallel transfers

test(e2e): add full transfer workflow test

docs(adr): document redis adapter decision

chore(deps): update nestjs to 10.2.0
```

### Branches

- `main` — Producción (no commits directos)
- `develop` — Integración (default branch)
- `feature/<name>` — Nuevas features
- `fix/<name>` — Bug fixes
- `hotfix/<name>` — Urgencias

**Ejemplo:**

```bash
git checkout -b feature/document-validation
# ... cambios
git commit -m "feat(auth): add document type validation"
git push origin feature/document-validation
# → Create Pull Request contra develop
```

### Code Review & Merge

1. ✅ Crear PR contra `develop`
2. ✅ CI debe pasar (lint, type-check, build)
3. ✅ Mínimo 1 aprobación (si es solo dev, self-review está OK)
4. ✅ Tests cobertura no baja (≥70% en servicios)
5. ✅ Merge con "Squash and merge" (opcional, mantener historia limpia)

### Naming Conventions

#### Archivos

```
kebab-case.ts       ← ✅ Correcto
camelCase.ts        ← ❌ No
PascalCase.ts       ← ❌ No (solo componentes React)
```

#### Componentes React

```typescript
// ✅ Correcto
export const ComponentName = () => { ... }

// ❌ No
export const componentName = () => { ... }
```

#### Funciones & Variables

```typescript
// ✅ Correcto
const getUserByDocument = async (docType, docNumber) => { ... }
let isLoading = false;

// ❌ No
const get_user_by_document = async (...) => { ... }
let is_loading = false;
```

#### Interfaces & Types

```typescript
// ✅ Correcto
interface UserDTO { ... }
type DocumentType = 'DNI' | 'CE' | 'PASAPORTE';

// ❌ No
interface userDTO { ... }
type document_type = ...;
```

### Desarrollo Local

#### Pre-commit Hooks

Husky automáticamente valida:
- ESLint
- Prettier
- TypeScript type-check

Si un commit falla:

```bash
# Ver qué está mal
npm run lint

# Arreglar automáticamente
npm run lint -- --fix

# Commitear de nuevo
git commit -m "fix: lint issues"
```

#### Hot-Reload

```bash
npm run dev
# Cambios en web/ y api/ se recargan automáticamente
```

#### Debuging

**Backend (NestJS):**

```bash
# VS Code: Agregar en .vscode/launch.json
{
  "type": "node",
  "request": "attach",
  "name": "Debug API",
  "port": 9229,
  "skipFiles": ["<node_internals>/**"]
}

# Iniciar con debug
node --inspect-brk apps/api/dist/main.js
```

**Frontend (Next.js):**

```bash
# VS Code: Open DevTools
# F12 en navegador → Console
# Debugger integrado en VS Code
```

### Testing

#### Tests Unitarios

```bash
npm run test
```

**Ubicación:** `apps/api/src/**/*.spec.ts`

**Ejemplo:**

```typescript
// auth.service.spec.ts
describe('AuthService', () => {
  describe('validateDocumentNumber', () => {
    it('should accept valid DNI', () => {
      const result = service.validateDocumentNumber('DNI', '12345678');
      expect(result).toBe(true);
    });

    it('should reject invalid DNI', () => {
      const result = service.validateDocumentNumber('DNI', '123');
      expect(result).toBe(false);
    });
  });
});
```

#### Tests E2E (Playwright)

```bash
npm run test:e2e
```

**Ubicación:** `testing/e2e/**/*.spec.ts`

**Ejemplo:**

```typescript
// testing/e2e/auth/login.spec.ts
test('user can login with valid DNI', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.fill('input[name="documentNumber"]', '12345678');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
});
```

### Database Migrations

Cuando cambies `prisma/schema.prisma`:

```bash
cd apps/api

# 1. Crear migración
npx prisma migrate dev --name describe_your_change

# 2. Revisar SQL generado en prisma/migrations/
# 3. Commit tanto schema.prisma como migration files

git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add new_table migration"
```

### Documentación

- Cambios arquitectónicos → Crear ADR en `docs/adr/`
- Cambios en API → Actualizar `docs/api-contracts.md`
- Guías de features → Crear `docs/feature-name.md`

**Formato ADR:**

```markdown
# ADR-NNNN: Título

## Status
Accepted / Proposed / Deprecated

## Context
...

## Decision
...

## Consequences
...

## Alternatives Considered
...
```

### Performance & Security

#### Code Review Checklist

- [ ] ¿Hay SQL injection posible? (usar Prisma, nunca queries raw)
- [ ] ¿Hay validación de inputs? (class-validator backend, Zod frontend)
- [ ] ¿Hay sanitización en salidas (PDFs, reportes)?
- [ ] ¿Hay N+1 queries? (revisar con Prisma include/select)
- [ ] ¿Performance OK? (reportes <2s, dashboards <1.5s)
- [ ] ¿Logs sensibles? (no guardar passwords, tokens)

### Comunicación

- **Dudas técnicas:** Comentar en PR o crear issue
- **Design decisions:** Proponer ADR primero
- **Features nuevas:** Discutir scope antes de implementar

---

**¿Dudas?** Ver [README.md](./README.md) o crear issue.
