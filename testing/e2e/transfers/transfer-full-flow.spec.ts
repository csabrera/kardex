import { expect, test } from '@playwright/test';

import { apiGet, apiPost, unwrap } from '../../helpers/api.helper';
import { createTransferScenario } from '../../helpers/scenario.helper';

/**
 * Flujo completo de negocio — el más crítico del sistema:
 *
 *   Admin crea obra + almacén + ítem → ENTRADA al Principal → TRANSFER
 *   Principal → Almacén de Obra → el Residente responsable CONFIRMA
 *   la recepción desde su UI → stock queda actualizado en destino.
 *
 * El setup lo hace via API (rápido y determinístico). La recepción se
 * hace via UI para ejercitar el dialog ReceiveTransferDialogSimple.
 */

test.describe('Transfer — flujo end-to-end Principal → Obra → Residente', () => {
  // Este test hace bastante I/O: setup de datos + login + UI.
  test.setTimeout(60_000);

  test('ENTRADA → TRANSFER → RESIDENTE confirma recepción', async ({ browser }) => {
    // ─── 1. Setup del escenario vía API ───
    const scenario = await createTransferScenario();

    // ─── 2. Crear la transferencia como admin ───
    const transferRes = await apiPost<{
      data: { id: string; code: string; status: string };
    }>(
      '/transfers',
      {
        fromWarehouseId: scenario.centralWarehouseId,
        toWarehouseId: scenario.obraWarehouseId,
        notes: 'TRF E2E Principal → Obra',
        items: [{ itemId: scenario.itemId, requestedQty: 30 }],
      },
      { token: scenario.adminToken },
    );
    const transfer = unwrap<{ id: string; code: string; status: string }>(transferRes);
    expect(transfer.status).toBe('EN_TRANSITO');
    expect(transfer.code).toMatch(/^TRF-\d{5}$/);

    // ─── 3. Login como residente en un contexto LIMPIO ───
    // Pasar storageState vacío explícitamente: el project 'chromium' inyecta
    // el del admin por default y el residente quedaría auto-logueado como admin.
    const residenteContext = await browser.newContext({
      baseURL: process.env.WEB_URL ?? 'http://localhost:3000',
      storageState: { cookies: [], origins: [] },
    });
    const page = await residenteContext.newPage();

    await page.goto('/login');
    await page.locator('#documentNumber').fill(scenario.residenteUser.documentNumber);
    await page.locator('#password').fill(scenario.residenteUser.password);
    await page.getByRole('button', { name: /ingresar al sistema/i }).click();
    await page.waitForURL(/\/mi-obra/, { timeout: 15_000 });

    // ─── 4. El residente ve la transferencia pendiente en /mi-obra ───
    await expect(page.getByText(transfer.code)).toBeVisible({ timeout: 10_000 });

    // ─── 5. Abre el detalle y confirma recepción ───
    // El residente ve el listado dentro de /almacen-principal?tab=transferencias
    // (también es accesible desde /mi-obra). Click en "Ver detalle" en la fila
    // correcta abre el TransferDetailDialog que contiene el botón "Confirmar
    // recepción" y los inputs de cantidad pre-llenados con `requestedQty`.
    await page.goto(`/dashboard/almacen-principal?tab=transferencias`);
    const row = page.locator('tr', { hasText: transfer.code });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: 'Ver detalle' }).click();

    // Botón "Confirmar recepción" del dialog → dispara la mutation directamente
    // (los inputs ya vienen pre-llenados con la cantidad requestedQty).
    await page.getByRole('button', { name: /confirmar recepción/i }).click();

    // Toast de éxito
    await expect(
      page.locator('[data-sonner-toast][data-type="success"]').first(),
    ).toBeVisible({ timeout: 10_000 });

    await residenteContext.close();

    // ─── 6. Verificación server-side: stock quedó en destino ───
    const stockRes = await apiGet<{
      data: Array<{ warehouseId: string; quantity: string | number }>;
    }>(`/stock?itemId=${scenario.itemId}`, { token: scenario.adminToken });

    const stockEnObra = stockRes.data.data.find(
      (s) => s.warehouseId === scenario.obraWarehouseId,
    );
    expect(stockEnObra).toBeDefined();
    expect(Number(stockEnObra!.quantity)).toBe(30);

    // Transfer ahora RECIBIDA
    const finalTransferRes = await apiGet<{
      data: { status: string; receivedBy: { id: string } | null };
    }>(`/transfers/${transfer.id}`, { token: scenario.adminToken });
    const finalTransfer = unwrap<{
      status: string;
      receivedBy: { id: string } | null;
    }>(finalTransferRes);

    expect(finalTransfer.status).toBe('RECIBIDA');
    expect(finalTransfer.receivedBy?.id).toBe(scenario.residenteUser.id);
  });
});
