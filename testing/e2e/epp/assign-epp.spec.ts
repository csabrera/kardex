import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost, unwrap } from '../../helpers/api.helper';
import { createTransferScenario } from '../../helpers/scenario.helper';

/**
 * Flujo asignación de EPP (happy path):
 *
 *   1. Setup (reusa createTransferScenario): obra + almacén OBRA + residente
 *      con stock 0 en la obra. Adicionalmente: ítem tipo EPP con stock en
 *      la obra (ENTRADA al Principal + TRANSFER + recepción del residente)
 *      + worker activo en la obra.
 *   2. Residente asigna EPP al worker → response trae código EPP-XXXXX y
 *      movementId. La transacción atómica:
 *        - descuenta stock del almacén OBRA
 *        - crea Movement SALIDA (source CONSUMO)
 *        - emite WS STOCK_CHANGED
 *   3. Verifica:
 *        - stock final = stock previo − cantidad asignada
 *        - el Movement existe en /movements y referencia el itemId/warehouseId
 *        - la asignación aparece en /epp/worker/{workerId}
 */

test.describe('EPP — asignación a worker', () => {
  test.setTimeout(90_000);

  test('residente asigna EPP a un obrero de su obra', async () => {
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
        { name: `Especialidad EPP ${Date.now()}` },
        { token: scenario.adminToken },
      );
      specialtyId = unwrap<{ id: string }>(newSpecRes).id;
    }

    // 2. Worker activo en la obra
    const workerDni = generateUniqueDni();
    const workerPhone = generateUniquePeruPhone();
    const workerRes = await apiPost<{ data: { id: string } }>(
      '/workers',
      {
        documentType: 'DNI',
        documentNumber: workerDni,
        firstName: 'ObreroEPP',
        lastName: 'E2E',
        phone: workerPhone,
        specialtyId,
        obraId: scenario.obraId,
      },
      { token: scenario.adminToken },
    );
    const workerId = unwrap<{ id: string }>(workerRes).id;

    // 3. Categoría + unidad (reutilizamos las primeras sembradas)
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

    // 4. Ítem tipo EPP
    const eppItemRes = await apiPost<{ data: { id: string } }>(
      '/items',
      {
        name: `Casco E2E ${Date.now()}`,
        description: 'EPP para asignación E2E',
        type: 'EPP',
        categoryId,
        unitId,
        minStock: 0,
      },
      { token: scenario.adminToken },
    );
    const eppItemId = unwrap<{ id: string }>(eppItemRes).id;

    // 5. ENTRADA al Principal (10 u) + TRANSFER (5 u) → recepción del residente
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
        notes: 'Stock inicial EPP E2E',
        items: [{ itemId: eppItemId, quantity: 10, unitCost: 30 }],
      },
      { token: scenario.adminToken },
    );
    expect([200, 201]).toContain(entradaRes.status);

    const trfRes = await apiPost<{
      data: { id: string; items: Array<{ id: string; itemId: string }> };
    }>(
      '/transfers',
      {
        fromWarehouseId: scenario.centralWarehouseId,
        toWarehouseId: scenario.obraWarehouseId,
        notes: 'EPP para obra E2E',
        items: [{ itemId: eppItemId, requestedQty: 5 }],
      },
      { token: scenario.adminToken },
    );
    const trf = unwrap<{
      id: string;
      items: Array<{ id: string; itemId: string }>;
    }>(trfRes);
    const transferItemId = trf.items.find((ti) => ti.itemId === eppItemId)!.id;

    const receiveRes = await apiPatch(
      `/transfers/${trf.id}/receive`,
      { items: [{ transferItemId, receivedQty: 5 }] },
      { token: scenario.residenteToken },
    );
    expect([200, 201]).toContain(receiveRes.status);

    // ─── Stock pre-asignación: 5 en obra ───
    const stockBefore = await apiGet<{
      data: Array<{ warehouseId: string; quantity: number | string }>;
    }>(`/stock?itemId=${eppItemId}`, { token: scenario.residenteToken });
    const stockObraBefore = stockBefore.data.data.find(
      (s) => s.warehouseId === scenario.obraWarehouseId,
    );
    expect(Number(stockObraBefore?.quantity ?? 0)).toBe(5);

    // ─── 1. Residente asigna 2 unidades de EPP al worker ───
    const assignRes = await apiPost<{
      data: {
        id: string;
        code: string;
        movementId: string | null;
        worker: { id: string };
        item: { id: string };
        warehouse: { id: string };
      };
    }>(
      '/epp/assign',
      {
        workerId,
        itemId: eppItemId,
        warehouseId: scenario.obraWarehouseId,
        quantity: 2,
        notes: 'Entrega inicial EPP E2E',
      },
      { token: scenario.residenteToken },
    );
    expect([200, 201]).toContain(assignRes.status);
    const assignment = unwrap<{
      id: string;
      code: string;
      movementId: string | null;
      worker: { id: string };
      item: { id: string };
      warehouse: { id: string };
    }>(assignRes);

    expect(assignment.code).toMatch(/^EPP-\d{5}$/);
    expect(assignment.worker.id).toBe(workerId);
    expect(assignment.item.id).toBe(eppItemId);
    expect(assignment.warehouse.id).toBe(scenario.obraWarehouseId);
    expect(assignment.movementId, 'asignación crea Movement').toBeTruthy();

    // ─── 2. Stock post-asignación: 5 − 2 = 3 ───
    const stockAfter = await apiGet<{
      data: Array<{ warehouseId: string; quantity: number | string }>;
    }>(`/stock?itemId=${eppItemId}`, { token: scenario.residenteToken });
    const stockObraAfter = stockAfter.data.data.find(
      (s) => s.warehouseId === scenario.obraWarehouseId,
    );
    expect(Number(stockObraAfter?.quantity ?? 0)).toBe(3);

    // ─── 3. Existe el Movement SALIDA con source=CONSUMO ───
    const movRes = await apiGet<{
      data: {
        items: Array<{
          id: string;
          type: string;
          source: string;
          warehouseId: string;
          items: Array<{ itemId: string; quantity: number | string }>;
        }>;
      };
    }>(`/movements?type=SALIDA&warehouseId=${scenario.obraWarehouseId}&pageSize=20`, {
      token: scenario.adminToken,
    });
    const movement = movRes.data.data.items.find((m) => m.id === assignment.movementId);
    expect(movement, 'Movement creado por la asignación existe').toBeDefined();
    expect(movement!.source).toBe('CONSUMO');
    const movItem = movement!.items.find((mi) => mi.itemId === eppItemId);
    expect(movItem, 'Movement contiene la línea del EPP').toBeDefined();
    expect(Number(movItem!.quantity)).toBe(2);

    // ─── 4. La asignación aparece en /epp/worker/{workerId} ───
    const workerEppRes = await apiGet<{
      data: Array<{ id: string; quantity: number | string }>;
    }>(`/epp/worker/${workerId}`, { token: scenario.residenteToken });
    const found = workerEppRes.data.data.find((a) => a.id === assignment.id);
    expect(found, 'asignación visible en historial del worker').toBeDefined();
    expect(Number(found!.quantity)).toBe(2);
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
