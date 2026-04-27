import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost, unwrap } from '../../helpers/api.helper';
import { createTransferScenario } from '../../helpers/scenario.helper';

/**
 * Filtro de préstamos vencidos:
 *
 *   El DTO `CreateToolLoanDto` exige `expectedReturnAt` futuro, por lo que no
 *   se puede crear un préstamo "ya vencido" desde la API. Para validar el
 *   filtro de overdue, este test:
 *     1. Crea el préstamo vía API con fecha futura (+1 día).
 *     2. Modifica `expectedReturnAt` directamente en la DB con Prisma para
 *        moverlo al pasado (-1 día), simulando que el plazo expiró.
 *     3. Verifica que `/tool-loans/overdue` lo incluye y que
 *        `/tool-loans?overdueOnly=true` también.
 *     4. Devuelve el préstamo → status=RETURNED.
 *     5. Verifica que ya no aparece en `/tool-loans/overdue`.
 *
 *   Apunta Prisma a la MISMA DB que la API (kardex_db por defecto). Override
 *   con `E2E_API_DATABASE_URL` si la API usa otra URL.
 */

const API_DB_URL =
  process.env.E2E_API_DATABASE_URL ??
  'postgresql://kardex_user:kardex_password@localhost:5432/kardex_db';

test.describe('ToolLoan — filtro overdue', () => {
  test.setTimeout(90_000);

  test('un préstamo con expectedReturnAt en el pasado aparece en /overdue', async () => {
    const prisma = new PrismaClient({ datasourceUrl: API_DB_URL });

    try {
      const scenario = await createTransferScenario();

      // ─── Setup: specialty + worker + station + tool con stock en obra ───
      const specRes = await apiGet<{ data: Array<{ id: string }> }>('/specialties', {
        token: scenario.adminToken,
      });
      let specialtyId = specRes.data.data[0]?.id;
      if (!specialtyId) {
        const newSpec = await apiPost<{ data: { id: string } }>(
          '/specialties',
          { name: `Especialidad Overdue ${Date.now()}` },
          { token: scenario.adminToken },
        );
        specialtyId = unwrap<{ id: string }>(newSpec).id;
      }

      const workerDni = generateUniqueDni();
      const workerPhone = generateUniquePeruPhone();
      const workerRes = await apiPost<{ data: { id: string } }>(
        '/workers',
        {
          documentType: 'DNI',
          documentNumber: workerDni,
          firstName: 'Obrero',
          lastName: 'Overdue',
          phone: workerPhone,
          specialtyId,
          obraId: scenario.obraId,
        },
        { token: scenario.adminToken },
      );
      const workerId = unwrap<{ id: string }>(workerRes).id;

      const stationRes = await apiPost<{ data: { id: string } }>(
        '/work-stations',
        { obraId: scenario.obraId, name: `Estación Overdue ${Date.now()}` },
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
          name: `Martillo Overdue ${Date.now()}`,
          type: 'HERRAMIENTA',
          categoryId,
          unitId,
          minStock: 0,
        },
        { token: scenario.adminToken },
      );
      const toolItemId = unwrap<{ id: string }>(toolRes).id;

      // ENTRADA + TRANSFER + recepción para tener 3 u en obra
      const supRes = await apiGet<{
        data: { items: Array<{ id: string; code: string }> };
      }>('/suppliers?pageSize=20', { token: scenario.adminToken });
      const supplierId = supRes.data.data.items.find(
        (s) => s.code === 'PRV-EVENTUAL',
      )!.id;

      await apiPost(
        '/movements',
        {
          type: 'ENTRADA',
          source: 'COMPRA',
          warehouseId: scenario.centralWarehouseId,
          supplierId,
          notes: 'Stock para overdue',
          items: [{ itemId: toolItemId, quantity: 5, unitCost: 80 }],
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
          notes: 'TRF para overdue',
          items: [{ itemId: toolItemId, requestedQty: 3 }],
        },
        { token: scenario.adminToken },
      );
      const trf = unwrap<{
        id: string;
        items: Array<{ id: string; itemId: string }>;
      }>(trfRes);
      const transferItemId = trf.items.find((ti) => ti.itemId === toolItemId)!.id;
      await apiPatch(
        `/transfers/${trf.id}/receive`,
        { items: [{ transferItemId, receivedQty: 3 }] },
        { token: scenario.residenteToken },
      );

      // ─── 1. Crear préstamo con fecha futura (+1 día) ───
      const loanRes = await apiPost<{ data: { id: string; status: string } }>(
        '/tool-loans',
        {
          itemId: toolItemId,
          warehouseId: scenario.obraWarehouseId,
          workStationId,
          borrowerWorkerId: workerId,
          quantity: 1,
          expectedReturnAt: new Date(Date.now() + 86400000).toISOString(),
          borrowerNotes: 'Préstamo overdue test',
        },
        { token: scenario.residenteToken },
      );
      expect([200, 201]).toContain(loanRes.status);
      const loan = unwrap<{ id: string; status: string }>(loanRes);
      expect(loan.status).toBe('ACTIVE');

      // ─── 2. Mover expectedReturnAt al pasado vía Prisma directo ───
      await prisma.toolLoan.update({
        where: { id: loan.id },
        data: { expectedReturnAt: new Date(Date.now() - 86400000) },
      });

      // ─── 3. Aparece en /tool-loans/overdue ───
      const overdueRes = await apiGet<{
        data: Array<{ id: string; status: string }>;
      }>('/tool-loans/overdue', { token: scenario.adminToken });
      const overdue = overdueRes.data.data;
      expect(Array.isArray(overdue)).toBe(true);
      expect(
        overdue.find((o) => o.id === loan.id),
        'préstamo vencido aparece en /overdue',
      ).toBeDefined();

      // ─── 4. También aparece con overdueOnly=true en el listado paginado ───
      const filteredRes = await apiGet<{
        data: { items: Array<{ id: string; status: string }> };
      }>(`/tool-loans?overdueOnly=true&borrowerWorkerId=${workerId}&pageSize=20`, {
        token: scenario.adminToken,
      });
      expect(
        filteredRes.data.data.items.find((o) => o.id === loan.id),
        'préstamo vencido aparece con overdueOnly=true',
      ).toBeDefined();

      // ─── 5. Devolver → ya no es overdue ───
      const returnRes = await apiPatch(
        `/tool-loans/${loan.id}/return`,
        { condition: 'BUENO' },
        { token: scenario.residenteToken },
      );
      expect(returnRes.status).toBe(200);

      const overdueAfterRes = await apiGet<{
        data: Array<{ id: string }>;
      }>('/tool-loans/overdue', { token: scenario.adminToken });
      expect(
        overdueAfterRes.data.data.find((o) => o.id === loan.id),
        'préstamo devuelto NO aparece en /overdue',
      ).toBeUndefined();
    } finally {
      await prisma.$disconnect();
    }
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
