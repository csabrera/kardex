import ExcelJS from 'exceljs';
import FormData from 'form-data';
import { expect, test } from '@playwright/test';

import { apiClient, apiGet, apiPost, unwrap } from '../../helpers/api.helper';
import { loginAsAdmin } from '../../helpers/scenario.helper';

/**
 * Flujo importación Excel de ítems con stockinicial:
 *
 *   1. Generar XLSX en memoria con 2 ítems: uno con stockinicial=50, otro con
 *      stockinicial=0. Categorías y unidades por código (sembradas).
 *   2. POST /items/import/preview (multipart) → totalValid=2, totalErrors=0.
 *   3. POST /items/import/confirm con las rows válidas →
 *      imported=2, stockInitialized=1.
 *   4. Verificar:
 *      - los 2 ítems existen en /items
 *      - se creó UNA Movement ENTRADA al Principal (source COMPRA)
 *        con stockBefore=0, stockAfter=50 para el ítem con stockinicial>0
 *      - el ítem sin stockinicial NO aparece en el Movement
 */

test.describe('Items — import Excel con stockinicial', () => {
  test.setTimeout(90_000);

  test('admin importa Excel y se crea ENTRADA automática al Principal', async () => {
    const { accessToken: adminToken } = await loginAsAdmin();
    const suffix = `IMP${Date.now().toString(36).toUpperCase()}`;

    // ─── 1. Obtener categoría + unidad sembradas (sus codes) ───
    const catRes = await apiGet<{
      data: { items: Array<{ id: string; code: string }> };
    }>('/categories?pageSize=1', { token: adminToken });
    const categoryCode = catRes.data.data.items[0]?.code;
    expect(categoryCode, 'hay al menos 1 categoría sembrada').toBeTruthy();

    const unitRes = await apiGet<{
      data: { items: Array<{ id: string; code: string }> };
    }>('/units?pageSize=5', { token: adminToken });
    const unitCode = unitRes.data.data.items[0]?.code;
    expect(unitCode, 'hay al menos 1 unidad sembrada').toBeTruthy();

    // ─── 2. Generar XLSX en memoria ───
    const codeWithStock = `IMP-${suffix}-A`;
    const codeWithoutStock = `IMP-${suffix}-B`;

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Ítems');
    sheet.addRow([
      'codigo',
      'nombre',
      'tipo',
      'categoria',
      'unidad',
      'stockmin',
      'stockmax',
      'stockinicial',
      'descripcion',
    ]);
    sheet.addRow([
      codeWithStock,
      `Cemento Import ${suffix}`,
      'MATERIAL',
      categoryCode,
      unitCode,
      10,
      200,
      50,
      'Importado vía Excel E2E',
    ]);
    sheet.addRow([
      codeWithoutStock,
      `Tornillo Import ${suffix}`,
      'MATERIAL',
      categoryCode,
      unitCode,
      0,
      0,
      0,
      'Sin stock inicial',
    ]);
    const buffer = (await wb.xlsx.writeBuffer()) as unknown as Buffer;

    // ─── 3. POST /items/import/preview (multipart) ───
    const previewForm = new FormData();
    previewForm.append('file', buffer, {
      filename: `import-${suffix}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const previewRes = await apiClient.post<{
      data: {
        rows: Array<{
          row: number;
          code?: string;
          name: string;
          type: string;
          categoryCode: string;
          unitCode: string;
          minStock?: number;
          maxStock?: number;
          stockInicial?: number;
          valid: boolean;
          errors: string[];
        }>;
        totalValid: number;
        totalErrors: number;
      };
    }>('/items/import/preview', previewForm, {
      headers: {
        ...previewForm.getHeaders(),
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect([200, 201]).toContain(previewRes.status);
    const preview = unwrap<{
      rows: Array<{
        row: number;
        code?: string;
        name: string;
        type: string;
        categoryCode: string;
        unitCode: string;
        minStock?: number;
        maxStock?: number;
        stockInicial?: number;
        valid: boolean;
        errors: string[];
      }>;
      totalValid: number;
      totalErrors: number;
    }>(previewRes);

    expect(preview.totalValid).toBe(2);
    expect(preview.totalErrors).toBe(0);
    const rowA = preview.rows.find((r) => r.code === codeWithStock);
    const rowB = preview.rows.find((r) => r.code === codeWithoutStock);
    expect(rowA?.valid).toBe(true);
    expect(rowB?.valid).toBe(true);
    expect(rowA?.stockInicial).toBe(50);

    // ─── 4. POST /items/import/confirm ───
    const validRows = preview.rows
      .filter((r) => r.valid)
      .map((r) => ({
        row: r.row,
        code: r.code,
        name: r.name,
        type: r.type,
        categoryCode: r.categoryCode,
        unitCode: r.unitCode,
        minStock: r.minStock,
        maxStock: r.maxStock,
        stockInicial: r.stockInicial,
      }));

    const confirmRes = await apiPost<{
      data: { imported: number; stockInitialized: number };
    }>('/items/import/confirm', { rows: validRows }, { token: adminToken });
    expect([200, 201]).toContain(confirmRes.status);
    const confirmed = unwrap<{ imported: number; stockInitialized: number }>(confirmRes);

    expect(confirmed.imported).toBe(2);
    expect(confirmed.stockInitialized).toBe(1);

    // ─── 5. Los ítems existen y son consultables ───
    const itemsRes = await apiGet<{
      data: { items: Array<{ id: string; code: string; name: string }> };
    }>(`/items?search=${suffix}&pageSize=20`, { token: adminToken });
    const itemA = itemsRes.data.data.items.find((i) => i.code === codeWithStock);
    const itemB = itemsRes.data.data.items.find((i) => i.code === codeWithoutStock);
    expect(itemA, 'ítem con stockinicial existe').toBeDefined();
    expect(itemB, 'ítem sin stockinicial existe').toBeDefined();

    // ─── 6. Almacén Principal ───
    const whRes = await apiGet<{
      data: { items: Array<{ id: string; code: string }> };
    }>('/warehouses?type=CENTRAL&pageSize=5', { token: adminToken });
    const principalId = whRes.data.data.items.find((w) => w.code === 'ALM-PRINCIPAL')!.id;

    // ─── 7. Movement ENTRADA generado: contiene solo el ítem A (50 u) ───
    const movRes = await apiGet<{
      data: {
        items: Array<{
          id: string;
          code: string;
          type: string;
          source: string;
          warehouseId: string;
          notes: string | null;
          items: Array<{
            itemId: string;
            quantity: number | string;
            stockBefore: number | string;
            stockAfter: number | string;
          }>;
        }>;
      };
    }>(`/movements?type=ENTRADA&warehouseId=${principalId}&pageSize=20`, {
      token: adminToken,
    });

    // Buscar el movement que contiene al ítem A (puede haber otros del dataset)
    const movement = movRes.data.data.items.find((m) =>
      m.items.some((mi) => mi.itemId === itemA!.id),
    );
    expect(movement, 'Movement ENTRADA con el ítem importado existe').toBeDefined();
    expect(movement!.source).toBe('COMPRA');

    const movItemA = movement!.items.find((mi) => mi.itemId === itemA!.id);
    expect(movItemA).toBeDefined();
    expect(Number(movItemA!.quantity)).toBe(50);
    expect(Number(movItemA!.stockBefore)).toBe(0);
    expect(Number(movItemA!.stockAfter)).toBe(50);

    // El ítem B (stockinicial=0) NO debe aparecer en NINGÚN movement
    const movWithB = movRes.data.data.items.find((m) =>
      m.items.some((mi) => mi.itemId === itemB!.id),
    );
    expect(movWithB, 'ítem sin stockinicial NO genera Movement').toBeUndefined();

    // ─── 8. Stock final del Principal ───
    const stockRes = await apiGet<{
      data: Array<{ warehouseId: string; quantity: number | string }>;
    }>(`/stock?itemId=${itemA!.id}`, { token: adminToken });
    const principalStock = stockRes.data.data.find((s) => s.warehouseId === principalId);
    expect(Number(principalStock?.quantity ?? 0)).toBe(50);
  });
});
