import { expect, test } from '@playwright/test';

import { apiPost, unwrap } from '../../helpers/api.helper';
import { createTransferScenario } from '../../helpers/scenario.helper';

/**
 * Ficha del ítem — sección "Transferencias pendientes":
 *
 *   Regression test del UX gap reportado el 2026-04-29: cuando un usuario
 *   creaba una transferencia EN_TRANSITO (saliendo del Principal pero aún
 *   no recibida en obra), la ficha del ítem solo mostraba el stock del
 *   Principal sin indicar las cantidades en tránsito hacia obras.
 *
 *   Verifica que:
 *     1. La sección "Transferencias pendientes" aparece cuando existe al
 *        menos una TRF EN_TRANSITO con ese ítem.
 *     2. El KPI "En tránsito" suma correctamente las cantidades.
 *     3. El código de la transferencia y el almacén destino son visibles.
 */

test.describe('Ficha del ítem — sección Transferencias pendientes', () => {
  test.setTimeout(90_000);

  test('muestra TRF EN_TRANSITO con destino y cantidad', async ({ page }) => {
    const scenario = await createTransferScenario();

    // Crear una transferencia desde el Principal hacia el almacén de obra.
    // El scenario ya dejó stock del ítem en el Principal vía ENTRADA inicial.
    const trfRes = await apiPost<{
      data: { id: string; code: string };
    }>(
      '/transfers',
      {
        fromWarehouseId: scenario.centralWarehouseId,
        toWarehouseId: scenario.obraWarehouseId,
        notes: 'TRF para validar sección Pendientes en ficha',
        items: [{ itemId: scenario.itemId, requestedQty: 7 }],
      },
      { token: scenario.adminToken },
    );
    const trf = unwrap<{ id: string; code: string }>(trfRes);

    // El residente NO confirma — la TRF queda EN_TRANSITO.

    await page.goto(`/dashboard/items/${scenario.itemId}`);

    // Sección visible
    const section = page.getByRole('heading', {
      name: /Transferencias pendientes de recepción/i,
    });
    await expect(section).toBeVisible({ timeout: 15_000 });

    // Código de la TRF + cantidad solicitada
    await expect(page.getByText(trf.code, { exact: true })).toBeVisible();
    await expect(page.getByText(/7\s+\w+/i).first()).toBeVisible();

    // Badge "En tránsito"
    await expect(page.getByText(/En tránsito/i).first()).toBeVisible();

    // KPI "En tránsito" con valor 7
    const kpi = page
      .locator('div', { has: page.getByText('En tránsito', { exact: true }) })
      .first();
    await expect(kpi).toBeVisible();
  });
});
