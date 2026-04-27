import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost, unwrap } from '../../helpers/api.helper';
import { createTransferScenario } from '../../helpers/scenario.helper';

/**
 * Flujo inventario físico (happy path con varianza):
 *
 *   1. Setup: createTransferScenario crea un ítem con stock 100 en el Principal,
 *      una obra y su almacén OBRA dedicado por scenario. Transferimos 50 u al
 *      almacén OBRA y el residente confirma la recepción → stock obra = 50.
 *      (Usar el almacén OBRA del scenario evita colisiones con otros tests
 *      paralelos sobre el almacén PRINCIPAL único.)
 *   2. Admin crea InventoryCount sobre el almacén OBRA → status IN_PROGRESS.
 *      Snapshot: items[] incluye el ítem con expectedQty=50, countedQty=null.
 *   3. Cargar countedQty=45 (faltan 5 unidades) → variance = -5.
 *   4. Cerrar conteo → status CLOSED, adjustmentMovementId presente.
 *      La transacción atómica:
 *        - actualiza stock del almacén OBRA a 45 (con optimistic lock)
 *        - crea UN solo Movement AJUSTE (source INVENTARIO, code AJU-XXXXX)
 *        - emite WS INVENTORY_COUNT_CLOSED + STOCK_CHANGED
 *   5. Verifica:
 *        - status CLOSED + adjustmentMovementId no nulo
 *        - el Movement existe en /movements?type=AJUSTE
 *        - el Movement tiene source=INVENTARIO, código AJU-XXXXX
 *        - stock final del almacén OBRA = 45
 *        - cerrar dos veces falla con 4xx
 */

test.describe('InventoryCount — flujo conteo + cierre con varianza', () => {
  test.setTimeout(90_000);

  test('admin crea conteo, registra varianza y al cerrar genera Movement AJUSTE', async () => {
    const scenario = await createTransferScenario();

    // ─── 0. Transferir 50 u al obra warehouse y residente confirma ───
    const trfRes = await apiPost<{
      data: { id: string; items: Array<{ id: string; itemId: string }> };
    }>(
      '/transfers',
      {
        fromWarehouseId: scenario.centralWarehouseId,
        toWarehouseId: scenario.obraWarehouseId,
        notes: 'Stock para conteo E2E',
        items: [{ itemId: scenario.itemId, requestedQty: 50 }],
      },
      { token: scenario.adminToken },
    );
    const trf = unwrap<{
      id: string;
      items: Array<{ id: string; itemId: string }>;
    }>(trfRes);
    const transferItemId = trf.items.find((ti) => ti.itemId === scenario.itemId)!.id;
    const receiveRes = await apiPatch(
      `/transfers/${trf.id}/receive`,
      { items: [{ transferItemId, receivedQty: 50 }] },
      { token: scenario.residenteToken },
    );
    expect([200, 201]).toContain(receiveRes.status);

    // ─── 1. Crear conteo sobre el obra warehouse ───
    const createRes = await apiPost<{
      data: {
        id: string;
        code: string;
        status: string;
        warehouseId: string;
        items: Array<{
          id: string;
          itemId: string;
          expectedQty: number | string;
          countedQty: number | string | null;
        }>;
      };
    }>(
      '/inventory-counts',
      {
        warehouseId: scenario.obraWarehouseId,
        notes: 'Conteo físico E2E',
      },
      { token: scenario.adminToken },
    );
    expect([200, 201]).toContain(createRes.status);
    const count = unwrap<{
      id: string;
      code: string;
      status: string;
      items: Array<{
        id: string;
        itemId: string;
        expectedQty: number | string;
        countedQty: number | string | null;
      }>;
    }>(createRes);

    expect(count.status).toBe('IN_PROGRESS');
    expect(count.code).toMatch(/^INV-\d{5}$/);

    const line = count.items.find((l) => l.itemId === scenario.itemId);
    expect(line, 'snapshot incluye el ítem del scenario').toBeDefined();
    expect(Number(line!.expectedQty)).toBe(50);
    expect(line!.countedQty).toBeNull();

    // ─── 2. Cargar countedQty=45 (variance=-5) ───
    const updateRes = await apiPatch<{
      data: {
        countedQty: number | string;
        variance: number | string;
      };
    }>(
      `/inventory-counts/${count.id}/items/${scenario.itemId}`,
      { countedQty: 45, notes: 'Faltan 5 unidades' },
      { token: scenario.adminToken },
    );
    expect(updateRes.status).toBe(200);
    const updatedLine = unwrap<{
      countedQty: number | string;
      variance: number | string;
    }>(updateRes);
    expect(Number(updatedLine.countedQty)).toBe(45);
    expect(Number(updatedLine.variance)).toBe(-5);

    // ─── 3. Cerrar conteo ───
    const closeRes = await apiPatch<{
      data: {
        id: string;
        status: string;
        adjustmentMovementId: string | null;
        closedAt: string;
        closedById: string;
      };
    }>(
      `/inventory-counts/${count.id}/close`,
      { notes: 'Cierre E2E con ajuste' },
      { token: scenario.adminToken },
    );
    expect(closeRes.status).toBe(200);
    const closed = unwrap<{
      id: string;
      status: string;
      adjustmentMovementId: string | null;
    }>(closeRes);

    expect(closed.status).toBe('CLOSED');
    expect(closed.adjustmentMovementId, 'cierre con varianza crea Movement').toBeTruthy();

    // ─── 4. El Movement AJUSTE existe y referencia el itemId ───
    const movRes = await apiGet<{
      data: {
        items: Array<{
          id: string;
          code: string;
          type: string;
          source: string;
          warehouseId: string;
          items: Array<{
            itemId: string;
            quantity: number | string;
            stockBefore: number | string;
            stockAfter: number | string;
          }>;
        }>;
      };
    }>(`/movements?type=AJUSTE&warehouseId=${scenario.obraWarehouseId}&pageSize=20`, {
      token: scenario.adminToken,
    });
    const movement = movRes.data.data.items.find(
      (m) => m.id === closed.adjustmentMovementId,
    );
    expect(movement, 'Movement AJUSTE creado por el cierre existe').toBeDefined();
    expect(movement!.source).toBe('INVENTARIO');
    expect(movement!.code).toMatch(/^AJU-\d{5}$/);
    const movItem = movement!.items.find((mi) => mi.itemId === scenario.itemId);
    expect(movItem, 'Movement contiene la línea del ítem ajustado').toBeDefined();
    expect(Number(movItem!.stockBefore)).toBe(50);
    expect(Number(movItem!.stockAfter)).toBe(45);
    expect(Number(movItem!.quantity)).toBe(45);

    // ─── 5. Stock final del obra warehouse = 45 ───
    const stockAfter = await apiGet<{
      data: Array<{ warehouseId: string; quantity: number | string }>;
    }>(`/stock?itemId=${scenario.itemId}`, { token: scenario.adminToken });
    const obraAfter = stockAfter.data.data.find(
      (s) => s.warehouseId === scenario.obraWarehouseId,
    );
    expect(Number(obraAfter?.quantity ?? 0)).toBe(45);

    // ─── 6. No se puede cerrar dos veces ───
    const doubleClose = await apiPatch(
      `/inventory-counts/${count.id}/close`,
      {},
      { token: scenario.adminToken },
    );
    expect(doubleClose.status).toBeGreaterThanOrEqual(400);
  });
});
