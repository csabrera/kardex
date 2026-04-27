import { expect, test } from '@playwright/test';

import { apiGet, apiPost, unwrap } from '../../helpers/api.helper';
import { loginAsAdmin } from '../../helpers/scenario.helper';

/**
 * Flujo "cambio de contraseña forzado":
 *
 *   Admin crea un usuario nuevo (backend lo marca mustChangePassword=true).
 *   El usuario loguea con la pass inicial → UI redirige a /cambiar-password
 *   (no al dashboard). Llena el form → UI redirige a /dashboard y el flag
 *   queda en false en backend.
 *
 * Pertenece al proyecto `auth-flows` (sin storageState — partimos sin sesión).
 */

test.describe('Auth — mustChangePassword forzado al primer login', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('usuario con flag es redirigido a /cambiar-password y al cambiar vuelve al dashboard', async ({
    page,
  }) => {
    // ─── 1. Setup — Admin crea un usuario nuevo ───
    const { accessToken: adminToken } = await loginAsAdmin();

    const rolesRes = await apiGet<{ data: Array<{ id: string; name: string }> }>(
      '/users/roles',
      { token: adminToken },
    );
    const almaceneroRole = rolesRes.data.data.find((r) => r.name === 'ALMACENERO');
    expect(almaceneroRole).toBeTruthy();

    const suffix = `E2EMCP${Date.now().toString(36).toUpperCase()}`;
    const dni = generateUniqueDni();
    const initialPassword = 'Inicial_2026!';
    const newPassword = `Nueva_${suffix}_42`;

    const createRes = await apiPost<{
      data: { id: string; mustChangePassword: boolean };
    }>(
      '/users',
      {
        documentType: 'DNI',
        documentNumber: dni,
        firstName: `Nuevo${suffix}`,
        lastName: 'Test',
        password: initialPassword,
        roleId: almaceneroRole!.id,
      },
      { token: adminToken },
    );
    const createdUser = unwrap<{ id: string; mustChangePassword: boolean }>(createRes);
    expect(createdUser.mustChangePassword).toBe(true);

    // ─── 2. El usuario loguea con la pass inicial desde la UI ───
    await page.goto('/login');
    await page.locator('#documentNumber').fill(dni);
    await page.locator('#password').fill(initialPassword);
    await page.getByRole('button', { name: /ingresar al sistema/i }).click();

    // ─── 3. Debe redirigir a /cambiar-password (no /dashboard) ───
    await page.waitForURL(/\/cambiar-password/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/cambiar-password/);
    await expect(page.getByText(/cambio de contraseña requerido/i)).toBeVisible();

    // ─── 4. Llenar el form y actualizar ───
    await page.locator('#old').fill(initialPassword);
    await page.locator('#new').fill(newPassword);
    await page.locator('#confirm').fill(newPassword);
    await page.getByRole('button', { name: /actualizar contraseña/i }).click();

    // ─── 5. UI redirige al dashboard ───
    await page.waitForURL(/\/(dashboard|mi-obra)/, { timeout: 10_000 });

    // ─── 6. Verificación server-side: el flag ya está en false ───
    // Al hacer login fresh con la nueva pass el backend devuelve mustChangePassword=false
    const finalLogin = await apiPost<{
      data: { user: { mustChangePassword: boolean } };
    }>('/auth/login', {
      documentType: 'DNI',
      documentNumber: dni,
      password: newPassword,
    });
    const finalUser = unwrap<{ user: { mustChangePassword: boolean } }>(finalLogin);
    expect(finalUser.user.mustChangePassword).toBe(false);
  });
});

function generateUniqueDni(): string {
  const base = Date.now() % 100_000_000;
  const rand = Math.floor(Math.random() * 100);
  return String((base * 100 + rand) % 100_000_000).padStart(8, '0');
}
