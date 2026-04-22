# Testing Strategy — Kardex

> **Principio:** testing integrado en cada fase, no al final. Cada feature entregada viene con tests que la protegen de regresiones.

---

## 🎯 Niveles de Testing

| Nivel | Ubicación | Framework | Corre cuándo |
|-------|-----------|-----------|--------------|
| **Unit** | `apps/api/src/**/*.spec.ts`, `packages/*/src/**/*.spec.ts` | Jest (API) / Vitest (packages, web) | Cada PR + pre-commit |
| **Integración** | `apps/api/test/integration/` | Jest con DB real | Cada PR |
| **E2E** | `testing/e2e/**/*.spec.ts` | Playwright | Cada PR |

## 🧪 Unit Tests

**Qué validan:** lógica de negocio aislada (servicios, validators, formatters, utils).

**Qué NO validan:** HTTP, DB, WebSocket, UI — eso es E2E.

**Ejemplo:**
```typescript
// packages/utils/src/validators.spec.ts
describe('validateDocument', () => {
  it('should accept valid DNI (8 digits)', () => {
    const result = validateDocument('DNI', '12345678');
    expect(result.valid).toBe(true);
  });
});
```

**Cobertura objetivo:** ≥70% en servicios críticos (auth, stock, movements, transfers).

---

## 🔗 Integration Tests (Backend)

**Qué validan:** controladores + servicios + Prisma con una DB real (test database).

**Cuándo usarlos:** validar transacciones, locking, queries complejas.

**Ejemplo:**
```typescript
// apps/api/test/integration/movements.int-spec.ts
describe('MovementsController (integration)', () => {
  it('should create entrada and increase stock with optimistic lock', async () => {
    // Arrange: seed warehouse + item
    // Act: POST /api/movements
    // Assert: stock.quantity === 100, stock.version incremented
  });
});
```

---

## 🎭 E2E Tests (Playwright)

**Qué validan:** flujos completos usuario → UI → API → DB → UI.

**Dónde viven:** `testing/e2e/` (workspace separado).

### Estructura

```
testing/
├── e2e/
│   ├── smoke/              # Tests rápidos que corren primero
│   ├── auth/               # Login, setup wizard, password recovery
│   ├── movements/          # Entradas, salidas, ajustes, kardex
│   ├── transfers/          # Flujo completo A→B
│   ├── requisitions/       # Residente → Jefe → Almacenero
│   ├── equipment/          # Combustible, mantenimientos
│   └── reports/            # Exportación Excel/PDF
├── fixtures/               # Datos de test (user.fixture, warehouse.fixture, etc.)
├── helpers/                # auth, api, db, wait helpers
└── playwright.config.ts
```

### Correr tests

```bash
# Todos los tests (Chromium)
npm run test:e2e

# UI mode (Playwright Inspector)
npm run test:e2e:ui

# Un test específico
npm run test:e2e -- home-loads.spec.ts

# Con navegador visible
npm run test:e2e:headed

# Debug paso a paso
npm run test:e2e:debug

# Ver último reporte HTML
cd testing && npm run test:e2e:report
```

### Convenciones

**Nombres de tests** — descriptivos en español:
```typescript
test('usuario puede loguearse con DNI válido', async ({ page }) => { ... });
test('salida con stock insuficiente es rechazada', async ({ page }) => { ... });
```

**Data selectors** — usar `data-test` attributes en lugar de clases CSS:
```tsx
<button data-test="login-submit">Ingresar</button>
```
```typescript
await page.click('[data-test="login-submit"]');
```

**Arrange–Act–Assert:**
```typescript
test('...', async ({ page }) => {
  // Arrange: crear fixtures
  const user = await seedUser({ role: 'ADMIN' });

  // Act: interactuar con UI
  await loginViaUi(page, { ...user });

  // Assert: validar resultado
  await expect(page).toHaveURL(/\/dashboard/);
});
```

### Helpers disponibles

| Helper | Ubicación | Uso |
|--------|-----------|-----|
| `loginViaApi()` | `helpers/auth.helper.ts` | Login rápido por API (no UI) |
| `loginViaUi()` | `helpers/auth.helper.ts` | Login completo con UI |
| `apiGet/Post/Patch/Delete` | `helpers/api.helper.ts` | Llamadas directas a API |
| `resetDatabase()` | `helpers/db.helper.ts` | Limpieza entre tests |
| `waitForApi()` | `helpers/wait.helper.ts` | Esperar que API esté ready |

### Fixtures disponibles

| Fixture | Estado |
|---------|--------|
| `seedUser()` | ✅ Disponible (Fase 2A) |
| `seedSystemRoles()` | ✅ Disponible (Fase 2A) |
| `seedWarehouse()` | ⏳ Fase 3A |
| `seedItem()` | ⏳ Fase 3A |
| `seedMovement()` | ⏳ Fase 4A |

---

## 📏 Cobertura Planeada por Fase

| Fase | Tests E2E añadidos | Foco |
|------|---------------------|------|
| **Fase 1E** | Smoke (home, health) | Validar stack levanta |
| **Fase 2A** | Auth core (login, refresh, logout) | Login con 3 tipos de documento |
| **Fase 2B** | Recuperación de password | Flujo forgot → reset |
| **Fase 2C** | RBAC | Guards funcionan por rol |
| **Fase 2D** | Setup wizard | Bootstrap + forced password change |
| **Fase 3A** | CRUD maestros | Almacenes, categorías, ítems |
| **Fase 3B** | Importación masiva | Excel upload + preview + commit |
| **Fase 4A** | Movimientos + kardex | Entradas, salidas, stock |
| **Fase 4B** | Exportación | Excel sync + PDF async polling |
| **Fase 5A** | Transferencias completas | Flujo A→B con 6 estados |
| **Fase 5B** | WebSocket notifications | 2 tabs, evento en vivo |
| **Fase 6** | EPP, combustible, mantenimientos | Módulos especializados |
| **Fase 7** | Requisiciones, inventarios físicos, reportes | Ciclo operativo |
| **Fase 8A** | Regresión completa | 50+ tests cubriendo todo |

**Total esperado al finalizar:** ~60 tests E2E en paralelo < 10 min.

---

## 🔄 CI/CD

### `.github/workflows/ci.yml`
- ✅ Lint (ESLint)
- ✅ Format check (Prettier)
- ✅ Type check (TypeScript)
- ✅ Build all workspaces
- ✅ Unit tests con coverage

### `.github/workflows/e2e-tests.yml`
- ✅ Levanta PostgreSQL + Redis como services
- ✅ Instala Playwright browsers
- ✅ Build + run E2E tests
- ✅ Sube `playwright-report/` como artifact

**Flaky tests:** retries automáticos (2x) solo en CI. Localmente, fallan al primer intento para detectar flakiness temprano.

---

## 🐛 Debugging Tests

### Cuando un test falla

1. **Abre el reporte HTML:**
   ```bash
   cd testing && npx playwright show-report
   ```
   Click en el test fallido → ver screenshot + trace.

2. **Re-corre con trace completo:**
   ```bash
   npm run test:e2e -- --trace on
   ```

3. **Debug interactivo:**
   ```bash
   npm run test:e2e:debug -- -g "nombre del test"
   ```
   Abre Playwright Inspector — puedes avanzar paso a paso.

### Patrones para tests estables

| ❌ Frágil | ✅ Robusto |
|-----------|-----------|
| `page.waitForTimeout(1000)` | `page.waitForURL()`, `expect().toBeVisible()` |
| Clases CSS como selectores | `data-test` attributes |
| Hardcodear IDs de DB | Fixtures con fresh data por test |
| Depender de orden de ejecución | Cada test es independiente |

---

## 📚 Recursos

- [Playwright Docs](https://playwright.dev/docs/intro)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing Strategy de NestJS](https://docs.nestjs.com/fundamentals/testing)
- `testing/README.md` — guía de quick start
- `testing/e2e/smoke/README.md` — template para nuevos smoke tests
