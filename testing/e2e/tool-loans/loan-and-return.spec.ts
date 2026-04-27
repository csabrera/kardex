import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost, unwrap } from '../../helpers/api.helper';
import { createTransferScenario } from '../../helpers/scenario.helper';

/**
 * Flujo herramienta — préstamo + devolución:
 *
 *   1. Setup (reusa createTransferScenario): obra + almacén OBRA + residente.
 *      Adicionalmente: item tipo HERRAMIENTA con stock en la obra (vía
 *      ENTRADA + TRANSFER) + workStation + worker con specialty.
 *   2. Residente crea préstamo → estado ACTIVE, stock NO se descuenta.
 *   3. Residente devuelve en condición BUENO → estado RETURNED, returnedBy
 *      = residente, condición registrada.
 *   4. El count de préstamos activos de la obra regresa a 0.
 */

test.describe('ToolLoan — flujo préstamo + devolución', () => {
  test.setTimeout(90_000);

  test('residente presta y devuelve una herramienta', async () => {
    const scenario = await createTransferScenario();

    // ─── Setup adicional ───

    // 1. Specialty (tomar la primera sembrada; si no hay, crearla)
    const specRes = await apiGet<{ data: Array<{ id: string }> }>('/specialties', {
      token: scenario.adminToken,
    });
    let specialtyId = specRes.data.data[0]?.id;
    if (!specialtyId) {
      const newSpecRes = await apiPost<{ data: { id: string } }>(
        '/specialties',
        { name: `Especialidad E2E ${Date.now()}` },
        { token: scenario.adminToken },
      );
      specialtyId = unwrap<{ id: string }>(newSpecRes).id;
    }

    // 2. Worker perteneciente a la obra
    const workerDni = generateUniqueDni();
    const workerPhone = generateUniquePeruPhone();
    const workerRes = await apiPost<{ data: { id: string } }>(
      '/workers',
      {
        documentType: 'DNI',
        documentNumber: workerDni,
        firstName: 'Obrero',
        lastName: 'E2E',
        phone: workerPhone,
        specialtyId,
        obraId: scenario.obraId,
      },
      { token: scenario.adminToken },
    );
    const workerId = unwrap<{ id: string }>(workerRes).id;

    // 3. WorkStation de la obra
    const stationRes = await apiPost<{ data: { id: string } }>(
      '/work-stations',
      {
        obraId: scenario.obraId,
        name: `Estación E2E ${Date.now()}`,
      },
      { token: scenario.adminToken },
    );
    const workStationId = unwrap<{ id: string }>(stationRes).id;

    // 4. Categoría + unidad (reutilizamos las primeras sembradas)
    const catRes = await apiGet<{ data: { items: Array<{ id: string }> } }>(
      '/categories?pageSize=1',
      { token: scenario.adminToken },
    );
    const categoryId = catRes.data.data.items[0]!.id;

    const unitRes = await apiGet<{ data: { items: Array<{ id: string }> } }>(
      '/units?pageSize=5',
      { token: scenario.adminToken },
    );
    const unitId = unitRes.data.data.items[0]!.id;

    // 5. Item tipo HERRAMIENTA
    const toolRes = await apiPost<{ data: { id: string } }>(
      '/items',
      {
        name: `Taladro E2E ${Date.now()}`,
        description: 'Herramienta para préstamo E2E',
        type: 'HERRAMIENTA',
        categoryId,
        unitId,
        minStock: 0,
      },
      { token: scenario.adminToken },
    );
    const toolItemId = unwrap<{ id: string }>(toolRes).id;

    // 6. ENTRADA al Principal + TRANSFER al almacén de obra para tener stock
    const supRes = await apiGet<{
      data: { items: Array<{ id: string; code: string }> };
    }>('/suppliers?pageSize=20', { token: scenario.adminToken });
    const supplierId = supRes.data.data.items.find((s) => s.code === 'PRV-EVENTUAL')!.id;

    const entradaRes = await apiPost(
      '/movements',
      {
        type: 'ENTRADA',
        source: 'COMPRA',
        warehouseId: scenario.centralWarehouseId,
        supplierId,
        notes: 'Stock inicial herramienta E2E',
        items: [{ itemId: toolItemId, quantity: 5, unitCost: 120 }],
      },
      { token: scenario.adminToken },
    );
    expect([200, 201]).toContain(entradaRes.status);

    const trfRes = await apiPost<{
      data: { id: string; code: string; items: Array<{ id: string; itemId: string }> };
    }>(
      '/transfers',
      {
        fromWarehouseId: scenario.centralWarehouseId,
        toWarehouseId: scenario.obraWarehouseId,
        notes: 'Herramientas para obra E2E',
        items: [{ itemId: toolItemId, requestedQty: 2 }],
      },
      { token: scenario.adminToken },
    );
    const trf = unwrap<{
      id: string;
      items: Array<{ id: string; itemId: string }>;
    }>(trfRes);
    const transferItemId = trf.items.find((ti) => ti.itemId === toolItemId)!.id;

    // Residente confirma la recepción (necesario para que el stock entre al obraWarehouse).
    const receiveRes = await apiPatch(
      `/transfers/${trf.id}/receive`,
      {
        items: [{ transferItemId, receivedQty: 2 }],
      },
      { token: scenario.residenteToken },
    );
    expect([200, 201]).toContain(receiveRes.status);

    // ─── Stock pre-préstamo: 2 en obra ───
    const stockBefore = await apiGet<{
      data: Array<{ warehouseId: string; quantity: number | string }>;
    }>(`/stock?itemId=${toolItemId}`, { token: scenario.residenteToken });
    const stockObraBefore = stockBefore.data.data.find(
      (s) => s.warehouseId === scenario.obraWarehouseId,
    );
    expect(Number(stockObraBefore?.quantity ?? 0)).toBe(2);

    // ─── 2. El residente crea el préstamo ───
    const loanRes = await apiPost<{
      data: { id: string; code: string; status: string };
    }>(
      '/tool-loans',
      {
        itemId: toolItemId,
        warehouseId: scenario.obraWarehouseId,
        workStationId,
        borrowerWorkerId: workerId,
        quantity: 1,
        expectedReturnAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        borrowerNotes: 'Para trabajos de fijación',
      },
      { token: scenario.residenteToken },
    );
    expect([200, 201]).toContain(loanRes.status);
    const loan = unwrap<{ id: string; code: string; status: string }>(loanRes);
    expect(loan.status).toBe('ACTIVE');
    expect(loan.code).toMatch(/^PRT-\d{5}$/);

    // ─── Stock post-préstamo: NO debe haber cambiado (préstamo no descuenta stock) ───
    const stockDuring = await apiGet<{
      data: Array<{ warehouseId: string; quantity: number | string }>;
    }>(`/stock?itemId=${toolItemId}`, { token: scenario.residenteToken });
    const stockObraDuring = stockDuring.data.data.find(
      (s) => s.warehouseId === scenario.obraWarehouseId,
    );
    expect(Number(stockObraDuring?.quantity ?? 0)).toBe(2);

    // ─── 3. Residente devuelve en condición BUENO ───
    const returnRes = await apiPatch<{
      data: {
        id: string;
        status: string;
        returnCondition: string | null;
        returnedBy: { id: string } | null;
      };
    }>(
      `/tool-loans/${loan.id}/return`,
      { condition: 'BUENO', notes: 'Devuelto sin daños' },
      { token: scenario.residenteToken },
    );
    expect(returnRes.status).toBe(200);
    const returned = unwrap<{
      status: string;
      returnCondition: string;
      returnedBy: { id: string } | null;
    }>(returnRes);
    expect(returned.status).toBe('RETURNED');
    expect(returned.returnCondition).toBe('BUENO');
    expect(returned.returnedBy?.id).toBe(scenario.residenteUser.id);

    // ─── 4. No quedan préstamos activos para el worker ───
    const activeRes = await apiGet<{
      data: { items: Array<{ id: string; status: string }> };
    }>(`/tool-loans?borrowerWorkerId=${workerId}&status=ACTIVE&pageSize=10`, {
      token: scenario.residenteToken,
    });
    expect(activeRes.data.data.items.length).toBe(0);
  });
});

function generateUniqueDni(): string {
  const base = Date.now() % 100_000_000;
  const rand = Math.floor(Math.random() * 100);
  return String((base * 100 + rand) % 100_000_000).padStart(8, '0');
}

function generateUniquePeruPhone(): string {
  const base = Date.now() % 100_000_000;
  const rand = Math.floor(Math.random() * 100);
  const eightDigits = String((base * 100 + rand) % 100_000_000).padStart(8, '0');
  return `9${eightDigits}`;
}
