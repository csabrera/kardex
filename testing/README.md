# E2E Testing with Playwright

> Tests end-to-end de todos los flujos de la aplicación.

## 📋 Estructura

```
testing/
├── fixtures/           # Data precargado para tests (usuarios, almacenes, ítems)
├── helpers/            # Funciones de utilidad (auth, API calls, DB cleanup)
├── e2e/                # Tests organizados por feature
│   ├── auth/           # Login, setup, password recovery
│   ├── movements/      # Entradas, salidas, ajustes
│   ├── transfers/      # Transferencias completas
│   ├── requisitions/   # Requisiciones
│   ├── equipment/      # Equipos, combustible, mantenimientos
│   └── reports/        # Reportes y exportación
├── playwright.config.ts
└── package.json
```

## 🚀 Ejecutar Tests

### Todos los tests

```bash
npm run test:e2e
```

### Tests específicos

```bash
# Solo auth
npm run test:e2e -- auth

# Solo un archivo
npm run test:e2e -- login.spec.ts

# Con modo headed (ver navegador)
npm run test:e2e -- --headed

# Una sola prueba
npm run test:e2e -- --grep "user can login"
```

### Modo Debug

```bash
# Abre Playwright Inspector
npm run test:e2e -- --debug

# Genera trace (grabar todo lo que pasó)
npm run test:e2e -- --trace on

# Ver report HTML
npx playwright show-report
```

## 📝 Escribir Tests

### Estructura Básica

```typescript
// testing/e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test';
import { loginWithDNI, logout } from '../../helpers/auth.helper';
import { seedUser } from '../../fixtures/user.fixture';

test.describe('Authentication', () => {
  let userId: string;

  test.beforeEach(async ({ page }) => {
    // Setup antes de cada test
    userId = await seedUser({
      documentType: 'DNI',
      documentNumber: '12345678',
      password: 'TestPassword123!',
      role: 'ADMIN'
    });
  });

  test('user can login with valid DNI', async ({ page }) => {
    // Arrange
    await page.goto('http://localhost:3000/login');

    // Act
    await loginWithDNI(page, '12345678', 'TestPassword123!');

    // Assert
    await expect(page).toHaveURL('**/dashboard');
    await expect(page.locator('text=Bienvenido')).toBeVisible();
  });

  test('login fails with invalid credentials', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await loginWithDNI(page, '12345678', 'WrongPassword');

    await expect(page.locator('text=Credenciales inválidas')).toBeVisible();
  });

  test.afterEach(async () => {
    // Cleanup después de cada test
    // (base de datos se resetea automáticamente)
  });
});
```

### Fixtures

**Crear usuario:**

```typescript
// testing/fixtures/user.fixture.ts
import { apiClient } from '../helpers/api.helper';

export async function seedUser(data: {
  documentType: string;
  documentNumber: string;
  password: string;
  role: string;
}) {
  const response = await apiClient.post('/users', data);
  return response.data.id;
}
```

**Crear almacén:**

```typescript
// testing/fixtures/warehouse.fixture.ts
export async function seedWarehouse(data: {
  code: string;
  name: string;
  type: 'CENTRAL' | 'OBRA';
}) {
  const response = await apiClient.post('/warehouses', data);
  return response.data.id;
}
```

### Helpers

**Auth Helper:**

```typescript
// testing/helpers/auth.helper.ts
export async function loginWithDNI(
  page,
  documentNumber: string,
  password: string
) {
  await page.selectOption('select[name="documentType"]', 'DNI');
  await page.fill('input[name="documentNumber"]', documentNumber);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

export async function logout(page) {
  await page.click('button[aria-label="Usuario"]');
  await page.click('text=Cerrar sesión');
  await page.waitForURL('**/login');
}
```

**API Helper:**

```typescript
// testing/helpers/api.helper.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: 'http://localhost:4000/api',
  validateStatus: () => true // No throw on any status
});

export async function callAPI(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  data?: any,
  token?: string
) {
  const response = await apiClient({
    method,
    url: path,
    data,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return response;
}
```

**DB Helper:**

```typescript
// testing/helpers/db.helper.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function resetDatabase() {
  // Truncate all tables
  await prisma.$executeRaw`TRUNCATE TABLE "User" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE "Warehouse" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE "Item" CASCADE;`;
  // ... etc
}

export async function cleanupAfterTest() {
  await resetDatabase();
  await prisma.$disconnect();
}
```

## 🧪 Ejemplos de Tests por Feature

### Auth (login.spec.ts)

```typescript
test('login with DNI', async ({ page }) => { ... });
test('login fails with invalid format', async ({ page }) => { ... });
test('password recovery flow', async ({ page }) => { ... });
test('forced password change on first login', async ({ page }) => { ... });
```

### Movimientos (entradas.spec.ts)

```typescript
test('create entrada of 100 units', async ({ page }) => {
  // Setup
  const itemId = await seedItem({ name: 'Cemento', minStock: 10 });
  const warehouseId = await seedWarehouse({ code: 'CENTRAL' });

  // Act
  await page.goto('/movimientos/entradas/nueva');
  await page.fill('input[name="quantity"]', '100');
  await page.selectOption('select[name="itemId"]', itemId);
  await page.click('button[type="submit"]');

  // Assert
  await expect(page.locator('text=Entrada registrada')).toBeVisible();

  // Verificar stock en API
  const stock = await apiClient.get(`/stock/${itemId}`);
  expect(stock.data.quantity).toBe(100);
});
```

### Transferencias (full-flow.spec.ts)

```typescript
test('complete transfer workflow', async ({ page }) => {
  // Setup: 2 almacenes, 1 ítem con stock
  const warehouseA = await seedWarehouse({ code: 'A', name: 'Almacén A' });
  const warehouseB = await seedWarehouse({ code: 'B', name: 'Almacén B' });
  const item = await seedItem({ name: 'Acero', minStock: 0 });
  await seedMovement({ warehouseId: warehouseA, itemId: item, quantity: 100 });

  // Act 1: Crear solicitud
  await page.goto('/transferencias/nueva');
  await page.selectOption('[name="originWarehouse"]', warehouseA);
  await page.selectOption('[name="destinationWarehouse"]', warehouseB);
  await page.fill('[name="quantity"]', '50');
  await page.click('button:has-text("Solicitar")');
  const transferCode = await page.locator('[data-test="transfer-code"]').textContent();

  // Assert 1: Stock no cambió aún
  let stockA = await apiClient.get(`/stock/${item}/warehouse/${warehouseA}`);
  expect(stockA.data.quantity).toBe(100);

  // Act 2: Jefe aprueba
  await logout(page);
  await loginAs(page, 'JEFE');
  await page.goto(`/transferencias/${transferCode}`);
  await page.click('button:has-text("Aprobar")');

  // Act 3: Almacén A envía
  await logout(page);
  await loginAs(page, 'ALMACENERO_A');
  await page.goto(`/transferencias/${transferCode}`);
  await page.click('button:has-text("Enviar")');

  // Assert 2: Stock descuentado de A
  stockA = await apiClient.get(`/stock/${item}/warehouse/${warehouseA}`);
  expect(stockA.data.quantity).toBe(50);

  // Act 4: Almacén B recibe
  await logout(page);
  await loginAs(page, 'ALMACENERO_B');
  await page.goto(`/transferencias/${transferCode}`);
  await page.click('button:has-text("Recibir")');

  // Assert 3: Stock incrementado en B
  const stockB = await apiClient.get(`/stock/${item}/warehouse/${warehouseB}`);
  expect(stockB.data.quantity).toBe(50);
});
```

## ⚙️ Configuración

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],
  webServer: {
    // CI: tests esperan que web + api estén arriba
    // Dev: ejecutar `npm run dev` primero
    // command: 'npm run dev',
    // url: 'http://localhost:3000',
    // reuseExistingServer: !process.env.CI,
  }
});
```

## 🎯 Best Practices

1. **Fixtures por feature:** `user.fixture.ts`, `warehouse.fixture.ts`, etc.
2. **Data cleanup:** Cada test empieza con DB limpia.
3. **Explicit waits:** Usar `waitForURL`, `waitForSelector`, no `sleep`.
4. **Naming:** Tests describiendo comportamiento en español (ej. "usuario puede loguearse").
5. **Arrange-Act-Assert:** Estructura clara en cada test.
6. **Reutilización:** Helpers para login, API calls, etc.

## 🚨 Troubleshooting

### Tests timeout

```typescript
test('slow operation', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ...
});
```

### WebSocket timeout en notificaciones

```typescript
test('receive notification via WebSocket', async ({ page }) => {
  // Esperar mensaje en listener
  const messagePromise = page.waitForEvent('websocket', ws => {
    ws.on('frameSent', data => {
      expect(data).toContain('transfer.pending');
    });
  });

  // Trigger notification
  await triggerTransfer(page);

  // Esperar mensaje
  await messagePromise;
});
```

### Base de datos no limpia

```bash
# Reset manual
cd apps/api
npx prisma db push --skip-generate --force-reset
npx prisma db seed
```

---

**¿Más info?** Ver [Playwright Docs](https://playwright.dev)
