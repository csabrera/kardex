import { expect, test } from '@playwright/test';

import { apiGet, apiPost, unwrap } from '../../helpers/api.helper';
import { loginAsAdmin } from '../../helpers/scenario.helper';

/**
 * Flujo "olvidé mi contraseña" end-to-end:
 *
 *   1. Admin crea usuario; éste cambia su pass inicial por una estable
 *      (para que no quede con mustChangePassword=true y así probar el
 *      reset "real", no el primer-login).
 *   2. UI: entra a /recuperar-password, pide reset por DNI → en modo dev el
 *      backend devuelve el raw token y la UI lo expone como link.
 *   3. Visita /reset-password/:token, llena la nueva pass → UI redirige a
 *      /login.
 *   4. Verifica: login API con pass nueva funciona (200) y con la anterior
 *      falla (401).
 *
 * Proyecto: `auth-flows` (sin storageState).
 */

test.describe('Auth — recuperar contraseña (flujo reset completo)', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('forgot-password → reset → login con nueva pass', async ({ page }) => {
    const { accessToken: adminToken } = await loginAsAdmin();

    // ─── 1. Crear usuario ALMACENERO ───
    const rolesRes = await apiGet<{ data: Array<{ id: string; name: string }> }>(
      '/users/roles',
      { token: adminToken },
    );
    const almaceneroRole = rolesRes.data.data.find((r) => r.name === 'ALMACENERO');
    expect(almaceneroRole, 'rol ALMACENERO sembrado').toBeTruthy();

    const suffix = `E2ERP${Date.now().toString(36).toUpperCase()}`;
    const dni = generateUniqueDni();
    const tempPassword = 'Temp_Init_42';
    const stablePassword = 'Estable_2026!A';
    const resetPassword = `Reseteada_${suffix}_9`;

    const createRes = await apiPost<{ data: { id: string } }>(
      '/users',
      {
        documentType: 'DNI',
        documentNumber: dni,
        firstName: `Reset${suffix}`,
        lastName: 'Test',
        password: tempPassword,
        roleId: almaceneroRole!.id,
      },
      { token: adminToken },
    );
    unwrap<{ id: string }>(createRes);

    // ─── 2. Cambiar la pass inicial (mustChangePassword → false) ───
    const firstLogin = unwrap<{ accessToken: string }>(
      await apiPost('/auth/login', {
        documentType: 'DNI',
        documentNumber: dni,
        password: tempPassword,
      }),
    );

    const changeRes = await apiPost(
      '/auth/change-password',
      {
        oldPassword: tempPassword,
        newPassword: stablePassword,
        confirmPassword: stablePassword,
      },
      { token: firstLogin.accessToken },
    );
    expect([200, 204]).toContain(changeRes.status);

    // ─── 3. UI: /recuperar-password ───
    await page.goto('/recuperar-password');
    await page.locator('#documentNumber').fill(dni);
    await page.getByRole('button', { name: /solicitar recuperación/i }).click();

    // En modo dev, el backend devuelve el token y la UI lo muestra como link.
    const devLink = page.getByRole('link', { name: /\/reset-password\//i });
    await expect(devLink).toBeVisible({ timeout: 10_000 });

    const href = await devLink.getAttribute('href');
    expect(href).toMatch(/^\/reset-password\//);

    // ─── 4. UI: visita el link, establece nueva pass ───
    await page.goto(href!);
    await page.locator('#newPassword').fill(resetPassword);
    await page.locator('#confirmPassword').fill(resetPassword);
    await page.getByRole('button', { name: /establecer nueva contraseña/i }).click();

    // useResetPassword redirige a /login al tener éxito
    await page.waitForURL(/\/login/, { timeout: 10_000 });

    // ─── 5. Verificación API: nueva pass funciona, vieja no ───
    const reLogin = await apiPost<{ data: { accessToken: string } }>('/auth/login', {
      documentType: 'DNI',
      documentNumber: dni,
      password: resetPassword,
    });
    expect(reLogin.status).toBe(200);
    const reLoginData = unwrap<{ accessToken: string }>(reLogin);
    expect(reLoginData.accessToken).toBeTruthy();

    const oldLogin = await apiPost('/auth/login', {
      documentType: 'DNI',
      documentNumber: dni,
      password: stablePassword,
    });
    expect(oldLogin.status).toBe(401);
  });
});

function generateUniqueDni(): string {
  const base = Date.now() % 100_000_000;
  const rand = Math.floor(Math.random() * 100);
  return String((base * 100 + rand) % 100_000_000).padStart(8, '0');
}
