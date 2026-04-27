import { expect, test } from '@playwright/test';

/**
 * Smoke autenticado — valida que el storageState guardado en globalSetup
 * permite entrar directo al dashboard sin pasar por /login.
 *
 * Si este test falla, probablemente globalSetup rompió (revisar E2E_ADMIN_*
 * env vars o que el admin no tenga mustChangePassword=true).
 */
test.describe('Smoke — sesión autenticada', () => {
  test('entra al dashboard sin pasar por login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/(dashboard|mi-obra)/, { timeout: 15_000 });

    // Sidebar shadcn/ui v2 (UI v10) — su data-sidebar attr es el marker estable.
    // El SessionInitializer y el dashboard ya cargaron contenido visible.
    await expect(page.locator('[data-sidebar="sidebar"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('puede visitar /dashboard/almacen-principal sin ser rebotado a login', async ({
    page,
  }) => {
    // /dashboard/items se fusionó con /dashboard/almacen-principal en UI v11.4.
    await page.goto('/dashboard/almacen-principal');
    await expect(page).toHaveURL(/\/dashboard\/almacen-principal/);

    // El header del hub se renderiza
    await expect(page.getByText(/Almacén Principal/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
