import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost, unwrap } from '../../helpers/api.helper';
import { createTransferScenario } from '../../helpers/scenario.helper';

/**
 * Flujo de rechazo de transferencia:
 *
 *   Admin crea TRF Principal → Obra (30 u). El backend descuenta las 30 del
 *   Principal inmediatamente (status EN_TRANSITO). El residente responsable
 *   de la obra RECHAZA la transferencia → el stock debe REVERTIRSE al
 *   Principal (vuelve a 100) y el destino queda sin stock.
 *
 *   Verifica:
 *     - status = RECHAZADA
 *     - rejectedBy = residente
 *     - stock Principal vuelve a 100
 *     - stock obra = 0 (o ausente)
 *     - rejectionReason persiste en el registro
 */

test.describe('Transfer — flujo de rechazo', () => {
  test.setTimeout(60_000);

  test('el residente rechaza una TRF y el stock revierte al Principal', async () => {
    const scenario = await createTransferScenario();

    // ─── 1. Crear TRF vía API (stock inicial Principal: 100) ───
    const trfRes = await apiPost<{
      data: {
        id: string;
        code: string;
        status: string;
        items: Array<{ id: string; itemId: string }>;
      };
    }>(
      '/transfers',
      {
        fromWarehouseId: scenario.centralWarehouseId,
        toWarehouseId: scenario.obraWarehouseId,
        notes: 'TRF E2E para probar rechazo',
        items: [{ itemId: scenario.itemId, requestedQty: 30 }],
      },
      { token: scenario.adminToken },
    );
    const trf = unwrap<{
      id: string;
      status: string;
      items: Array<{ id: string; itemId: string }>;
    }>(trfRes);
    expect(trf.status).toBe('EN_TRANSITO');

    // El stock en Principal debería haberse descontado a 70 (100 - 30).
    const stockDuring = await apiGet<{
      data: Array<{ warehouseId: string; quantity: number | string }>;
    }>(`/stock?itemId=${scenario.itemId}`, { token: scenario.adminToken });
    const principalDuring = stockDuring.data.data.find(
      (s) => s.warehouseId === scenario.centralWarehouseId,
    );
    expect(Number(principalDuring?.quantity ?? 0)).toBe(70);

    // ─── 2. Residente rechaza la transferencia ───
    const rejectRes = await apiPatch<{
      data: {
        status: string;
        rejectedBy: { id: string } | null;
        rejectionReason: string | null;
      };
    }>(
      `/transfers/${trf.id}/reject`,
      { reason: 'Ítem incorrecto — pedimos cemento, no este' },
      { token: scenario.residenteToken },
    );
    expect(rejectRes.status).toBe(200);
    const rejected = unwrap<{
      status: string;
      rejectedBy: { id: string } | null;
      rejectionReason: string | null;
    }>(rejectRes);

    expect(rejected.status).toBe('RECHAZADA');
    expect(rejected.rejectedBy?.id).toBe(scenario.residenteUser.id);
    expect(rejected.rejectionReason).toContain('Ítem incorrecto');

    // ─── 3. Stock debe haber revertido completamente ───
    const stockAfter = await apiGet<{
      data: Array<{ warehouseId: string; quantity: number | string }>;
    }>(`/stock?itemId=${scenario.itemId}`, { token: scenario.adminToken });

    const principalAfter = stockAfter.data.data.find(
      (s) => s.warehouseId === scenario.centralWarehouseId,
    );
    expect(principalAfter, 'stock en Principal existe').toBeDefined();
    expect(Number(principalAfter!.quantity)).toBe(100);

    const obraAfter = stockAfter.data.data.find(
      (s) => s.warehouseId === scenario.obraWarehouseId,
    );
    // El registro puede no existir en absoluto, o existir con quantity=0.
    expect(Number(obraAfter?.quantity ?? 0)).toBe(0);

    // ─── 4. No se puede rechazar dos veces ───
    const doubleReject = await apiPatch(
      `/transfers/${trf.id}/reject`,
      { reason: 'Segundo intento' },
      { token: scenario.residenteToken },
    );
    expect(doubleReject.status).toBeGreaterThanOrEqual(400);
  });
});
