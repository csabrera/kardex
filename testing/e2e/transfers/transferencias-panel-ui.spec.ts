import { expect, test } from '@playwright/test';

/**
 * Pestaña Transferencias del Almacén Principal — UI:
 *
 *   Regression test que valida la presencia del CTA "Nueva transferencia"
 *   en el panel cuando se renderiza desde el hub. Antes del fix del
 *   2026-04-29, el page del hub renderizaba <TransferenciasPanel/> sin
 *   `headerAction` y el panel tampoco tenía botón default — los usuarios
 *   no tenían punto de entrada visible para crear una transferencia.
 *
 *   Verifica:
 *     1. El botón aparece en el panel.
 *     2. Apunta a /dashboard/transferencias/nueva.
 *     3. Click navega correctamente a esa página y carga el formulario.
 */

test.describe('Almacén Principal · pestaña Transferencias — UI', () => {
  test('muestra botón "Nueva transferencia" que navega al formulario', async ({
    page,
  }) => {
    await page.goto('/dashboard/almacen-principal?tab=transferencias');

    const cta = page.getByRole('link', { name: /nueva transferencia/i });
    await expect(cta).toBeVisible({ timeout: 10_000 });
    await expect(cta).toHaveAttribute('href', '/dashboard/transferencias/nueva');

    await cta.click();
    await page.waitForURL('**/dashboard/transferencias/nueva', { timeout: 10_000 });

    // El form pide al menos almacén origen y destino — confirma que llegamos
    // al formulario de creación, no a un 404 o redirect.
    await expect(page.getByText(/almac[eé]n.*origen/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
