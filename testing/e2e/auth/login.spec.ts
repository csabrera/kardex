import { expect, test } from '@playwright/test';

import { loginViaUi } from '../../helpers/auth.helper';

const E2E_ADMIN = {
  documentType: (process.env.E2E_ADMIN_DOC_TYPE ?? 'DNI') as 'DNI' | 'CE' | 'PASAPORTE',
  documentNumber: process.env.E2E_ADMIN_DOC_NUMBER ?? '12345678',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'CambiarEn_PrimerLogin_2026',
};

test.describe('Auth — flujo de login (UI)', () => {
  // Estos tests parten sin sesión — vienen del proyecto auth-flows (sin storageState)
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/login');
  });

  test('rechaza credenciales inválidas con mensaje de error', async ({ page }) => {
    await page.locator('#documentNumber').fill(E2E_ADMIN.documentNumber);
    await page.locator('#password').fill('password-mal-777');
    await page.getByRole('button', { name: /ingresar al sistema/i }).click();

    // Toast sonner con error
    const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
    await expect(errorToast).toBeVisible({ timeout: 10_000 });

    // Seguimos en /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('valida formato del DNI en el cliente', async ({ page }) => {
    await page.locator('#documentNumber').fill('123'); // demasiado corto
    await page.locator('#password').fill('cualquiera');
    await page.getByRole('button', { name: /ingresar al sistema/i }).click();

    // El mensaje de formato inválido aparece en el DOM sin llegar al server
    await expect(page.getByText(/formato inválido|ingresa tu/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('login exitoso redirige al dashboard y muestra el sidebar', async ({ page }) => {
    await loginViaUi(page, E2E_ADMIN);

    // Debería haber redirigido a /dashboard o /mi-obra según rol
    await expect(page).toHaveURL(/\/(dashboard|mi-obra)/);

    // Sidebar presente (entrada "Dashboard" o "Mi Obra")
    const anyNavLink = page.getByRole('link', { name: /dashboard|mi obra/i }).first();
    await expect(anyNavLink).toBeVisible();
  });
});
