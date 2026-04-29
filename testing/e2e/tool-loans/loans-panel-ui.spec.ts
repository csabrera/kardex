import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost, unwrap } from '../../helpers/api.helper';
import { createTransferScenario } from '../../helpers/scenario.helper';

/**
 * Pestaña Préstamos del Almacén Principal — UI:
 *
 *   Regression test para el bug del 2026-04-29 donde la tabla salía vacía
 *   aunque la BD tenía préstamos. Causa raíz: el frontend mandaba
 *   `?overdueOnly=false`, el backend con `enableImplicitConversion=true` lo
 *   leía como `true` (Boolean("false") === true) y filtraba `status=ACTIVE`.
 *
 *   El test crea un préstamo activo via API, abre la pestaña y verifica:
 *     1. Filtro default ("Todos los estados") muestra el préstamo.
 *     2. Filtro "Activos" lo sigue mostrando.
 *     3. Filtro "Vencidos" NO lo muestra (expectedReturnAt es futuro).
 *
 *   Cualquier regresión del Transform de boolean en el query DTO de
 *   /tool-loans hace fallar este test.
 */

test.describe('Almacén Principal · pestaña Préstamos — UI', () => {
  test.setTimeout(90_000);

  test('renderiza préstamos creados via API y respeta filtros de estado', async ({
    page,
  }) => {
    const scenario = await createTransferScenario();

    // ─── Setup: specialty + worker + station + tool con stock en obra ───
    const specRes = await apiGet<{ data: Array<{ id: string }> }>('/specialties', {
      token: scenario.adminToken,
    });
    let specialtyId = specRes.data.data[0]?.id;
    if (!specialtyId) {
      const newSpec = await apiPost<{ data: { id: string } }>(
        '/specialties',
        { name: `Especialidad UI ${Date.now()}` },
        { token: scenario.adminToken },
      );
      specialtyId = unwrap<{ id: string }>(newSpec).id;
    }

    const workerDni = generateUniqueDni();
    const workerRes = await apiPost<{ data: { id: string } }>(
      '/workers',
      {
        documentType: 'DNI',
        documentNumber: workerDni,
        firstName: 'Obrero',
        lastName: 'UIPanel',
        phone: generateUniquePeruPhone(),
        specialtyId,
        obraId: scenario.obraId,
      },
      { token: scenario.adminToken },
    );
    const workerId = unwrap<{ id: string }>(workerRes).id;

    const stationRes = await apiPost<{ data: { id: string } }>(
      '/work-stations',
      { obraId: scenario.obraId, name: `Estación UI ${Date.now()}` },
      { token: scenario.adminToken },
    );
    const workStationId = unwrap<{ id: string }>(stationRes).id;

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

    const toolRes = await apiPost<{ data: { id: string } }>(
      '/items',
      {
        name: `Taladro UIPanel ${Date.now()}`,
        type: 'HERRAMIENTA',
        categoryId,
        unitId,
        minStock: 0,
      },
      { token: scenario.adminToken },
    );
    const toolItemId = unwrap<{ id: string }>(toolRes).id;

    const supRes = await apiGet<{
      data: { items: Array<{ id: string; code: string }> };
    }>('/suppliers?pageSize=20', { token: scenario.adminToken });
    const supplierId = supRes.data.data.items.find((s) => s.code === 'PRV-EVENTUAL')!.id;

    await apiPost(
      '/movements',
      {
        type: 'ENTRADA',
        source: 'COMPRA',
        warehouseId: scenario.centralWarehouseId,
        supplierId,
        notes: 'Stock UIPanel',
        items: [{ itemId: toolItemId, quantity: 3, unitCost: 80 }],
      },
      { token: scenario.adminToken },
    );

    const trfRes = await apiPost<{
      data: { id: string; items: Array<{ id: string; itemId: string }> };
    }>(
      '/transfers',
      {
        fromWarehouseId: scenario.centralWarehouseId,
        toWarehouseId: scenario.obraWarehouseId,
        notes: 'Trf UIPanel',
        items: [{ itemId: toolItemId, requestedQty: 2 }],
      },
      { token: scenario.adminToken },
    );
    const trf = unwrap<{ id: string; items: Array<{ id: string; itemId: string }> }>(
      trfRes,
    );
    const transferItemId = trf.items.find((ti) => ti.itemId === toolItemId)!.id;

    await apiPatch(
      `/transfers/${trf.id}/receive`,
      { items: [{ transferItemId, receivedQty: 2 }] },
      { token: scenario.residenteToken },
    );

    // Préstamo activo con vencimiento futuro
    const loanRes = await apiPost<{ data: { id: string; code: string } }>(
      '/tool-loans',
      {
        itemId: toolItemId,
        warehouseId: scenario.obraWarehouseId,
        workStationId,
        borrowerWorkerId: workerId,
        quantity: 1,
        expectedReturnAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        borrowerNotes: 'UIPanel test',
      },
      { token: scenario.residenteToken },
    );
    const loan = unwrap<{ id: string; code: string }>(loanRes);

    // ─── Navegación a la pestaña Préstamos del Almacén Principal ───
    await page.goto('/dashboard/almacen-principal?tab=prestamos');

    // El DataTable renderiza dos vistas (tabla md+ y cards mobile, alternadas
    // por CSS); apuntamos sólo a la tabla para evitar matches duplicados.
    const tableCode = page.getByRole('table').getByText(loan.code, { exact: true });

    // Filtro default ("Todos los estados") → la fila aparece
    await expect(tableCode).toBeVisible({ timeout: 15_000 });

    // Filtro "Activos" → sigue visible
    await page
      .getByRole('combobox')
      .filter({ hasText: /todos|activos|vencidos/i })
      .click();
    await page.getByRole('option', { name: /^activos$/i }).click();
    await expect(tableCode).toBeVisible({ timeout: 10_000 });

    // Filtro "Vencidos" → ya NO visible (expectedReturnAt es futuro)
    await page
      .getByRole('combobox')
      .filter({ hasText: /activos|todos|vencidos/i })
      .click();
    await page.getByRole('option', { name: /^vencidos$/i }).click();
    await expect(tableCode).toHaveCount(0, { timeout: 10_000 });
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
  const eight = String((base * 100 + rand) % 100_000_000).padStart(8, '0');
  return `9${eight}`;
}
