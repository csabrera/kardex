import { expect, test } from '@playwright/test';

/**
 * Smoke público — la home `/` es split-layout brand+login (UI v9+). El middleware
 * redirige rutas no-auth+no-públicas+no-`/` al login, así que la página 404 real
 * solo se ve bajo `/dashboard/...` autenticado.
 */

test.describe('Smoke público (home + 404)', () => {
  // Anular storageState del admin para ver la home pública
  test.use({ storageState: { cookies: [], origins: [] } });

  test('home page loads with split layout (brand + login)', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/(login|$)/);

    // Brand del panel izquierdo
    await expect(page.getByText('Kardex').first()).toBeVisible();

    // Tagline del panel brand
    await expect(page.getByText(/Control total de tus obras/i)).toBeVisible();

    // Form de login renderiza el botón principal
    await expect(
      page.getByRole('button', { name: /ingresar al sistema/i }),
    ).toBeVisible();

    await expect(page.locator('#documentNumber')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('Geist Sans font is loaded and theme class is applied', async ({ page }) => {
    await page.goto('/');

    // Geist Sans (paquete `geist`) — UI v9 reemplazó Inter por Geist
    const body = page.locator('body');
    const fontFamily = await body.evaluate((el) => {
      return window.getComputedStyle(el).fontFamily;
    });
    expect(fontFamily.toLowerCase()).toContain('geist');

    // next-themes aplica `dark` o `light` en <html> tras hidratación
    await expect(page.locator('html')).toHaveClass(/dark|light/, { timeout: 5_000 });
  });
});

test.describe('Smoke autenticado (404)', () => {
  // Mantiene storageState del project chromium (admin) para llegar al not-found
  // del layout `/dashboard`.

  test('404 page renders for unknown route under /dashboard', async ({ page }) => {
    await page.goto('/dashboard/this-route-does-not-exist');

    // not-found.tsx del dashboard renderiza heading + link de volver
    await expect(
      page.getByRole('heading', { name: /Página no encontrada|404/i }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole('link', { name: /Volver al inicio|Inicio/i }),
    ).toBeVisible();
  });
});
