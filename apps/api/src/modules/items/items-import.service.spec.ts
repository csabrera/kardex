import { Test, TestingModule } from '@nestjs/testing';
import { ItemType } from '@prisma/client';
import * as ExcelJS from 'exceljs';

import { PrismaService } from '../../prisma/prisma.service';
import { ItemsImportService } from './items-import.service';
import type { ImportItemRowDto } from './dto/import-item.dto';

async function buildExcel(
  rows: (string | number | undefined)[][],
  includeHeaders = true,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Ítems');
  if (includeHeaders) {
    sheet.addRow([
      'codigo',
      'nombre',
      'tipo',
      'categoria',
      'unidad',
      'stockmin',
      'stockmax',
      'descripcion',
    ]);
  }
  for (const row of rows) sheet.addRow(row);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function buildExcelWithBadHeaders(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Ítems');
  sheet.addRow(['code', 'name', 'type']); // faltan columnas requeridas
  sheet.addRow(['C1', 'Item', 'MATERIAL']);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

describe('ItemsImportService', () => {
  let service: ItemsImportService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      category: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'cat-1', code: 'CONSTRUCCION' },
          { id: 'cat-2', code: 'SEGURIDAD' },
        ]),
      },
      unit: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'unit-1', code: 'BLS' },
          { id: 'unit-2', code: 'UND' },
        ]),
      },
      item: {
        findMany: jest.fn().mockResolvedValue([{ code: 'EXISTENTE-1' }]),
      },
      warehouse: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'wh-1', type: 'CENTRAL' },
          { id: 'wh-2', type: 'OBRA' },
        ]),
        findFirst: jest.fn().mockResolvedValue({ id: 'wh-1', name: 'Almacén Principal' }),
      },
      stock: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => Promise<unknown>) => {
          const txMock = {
            item: {
              create: jest
                .fn()
                .mockImplementation(({ data }) =>
                  Promise.resolve({ id: `item-${data.code}`, ...data }),
                ),
            },
            stock: {
              createMany: jest.fn().mockResolvedValue({ count: 2 }),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            movement: {
              create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
            },
            movementSequence: {
              upsert: jest.fn().mockResolvedValue({ lastValue: 1 }),
            },
          };
          return cb(txMock);
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ItemsImportService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<ItemsImportService>(ItemsImportService);
  });

  describe('preview — estructura del archivo', () => {
    it('rejects when required headers are missing', async () => {
      const buf = await buildExcelWithBadHeaders();
      await expect(service.preview(buf)).rejects.toMatchObject({
        errorCode: 'IMPORT_VALIDATION_FAILED',
      });
    });

    it('rejects when file has no data rows', async () => {
      const buf = await buildExcel([]);
      await expect(service.preview(buf)).rejects.toMatchObject({
        errorCode: 'IMPORT_VALIDATION_FAILED',
      });
    });

    it('skips completely empty rows between data rows', async () => {
      const buf = await buildExcel([
        ['CEMEN-01', 'Cemento', 'MATERIAL', 'CONSTRUCCION', 'BLS'],
        [undefined, undefined, undefined, undefined, undefined],
        ['CASCO-01', 'Casco', 'EPP', 'SEGURIDAD', 'UND'],
      ]);
      const result = await service.preview(buf);
      expect(result.rows).toHaveLength(2);
      expect(result.totalValid).toBe(2);
    });
  });

  describe('preview — validación por fila', () => {
    it('valid row passes all checks', async () => {
      const buf = await buildExcel([
        ['CEMEN-01', 'Cemento Portland', 'MATERIAL', 'CONSTRUCCION', 'BLS', 10, 100],
      ]);
      const result = await service.preview(buf);
      expect(result.totalValid).toBe(1);
      expect(result.rows[0]?.valid).toBe(true);
      expect(result.rows[0]?.errors).toEqual([]);
    });

    it('rejects missing required fields when at least one identifier is present', async () => {
      // El parser salta filas 100% vacías; para llegar a la validación basta con un identificador
      const buf = await buildExcel([['C1', '', '', '', '']]);
      const result = await service.preview(buf);
      expect(result.totalValid).toBe(0);
      const errors = result.rows[0]!.errors;
      expect(errors).toContain('Nombre requerido');
      expect(errors).toContain('Categoría requerida');
      expect(errors).toContain('Unidad requerida');
    });

    it('rejects invalid item type', async () => {
      const buf = await buildExcel([['C1', 'Item', 'INVENTADO', 'CONSTRUCCION', 'BLS']]);
      const result = await service.preview(buf);
      expect(result.rows[0]?.valid).toBe(false);
      expect(result.rows[0]?.errors.some((e) => e.includes('Tipo "INVENTADO"'))).toBe(
        true,
      );
    });

    it('rejects non-existent category', async () => {
      const buf = await buildExcel([['C1', 'Item', 'MATERIAL', 'INEXISTENTE', 'BLS']]);
      const result = await service.preview(buf);
      expect(
        result.rows[0]?.errors.some((e) =>
          e.includes('Categoría "INEXISTENTE" no existe'),
        ),
      ).toBe(true);
    });

    it('rejects non-existent unit', async () => {
      const buf = await buildExcel([
        ['C1', 'Item', 'MATERIAL', 'CONSTRUCCION', 'INEXISTENTE'],
      ]);
      const result = await service.preview(buf);
      expect(
        result.rows[0]?.errors.some((e) => e.includes('Unidad "INEXISTENTE" no existe')),
      ).toBe(true);
    });

    it('rejects code that already exists in DB', async () => {
      const buf = await buildExcel([
        ['EXISTENTE-1', 'Item', 'MATERIAL', 'CONSTRUCCION', 'BLS'],
      ]);
      const result = await service.preview(buf);
      expect(result.rows[0]?.errors.some((e) => e.includes('ya existe en la BD'))).toBe(
        true,
      );
    });

    it('rejects intra-file duplicate codes (case-insensitive)', async () => {
      const buf = await buildExcel([
        ['DUP-01', 'Item A', 'MATERIAL', 'CONSTRUCCION', 'BLS'],
        ['dup-01', 'Item B', 'MATERIAL', 'CONSTRUCCION', 'BLS'],
      ]);
      const result = await service.preview(buf);
      expect(result.totalValid).toBe(1);
      expect(
        result.rows[1]?.errors.some((e) => e.includes('duplicado en el archivo')),
      ).toBe(true);
    });

    it('rejects negative stockmin', async () => {
      const buf = await buildExcel([
        ['C1', 'Item', 'MATERIAL', 'CONSTRUCCION', 'BLS', -5],
      ]);
      const result = await service.preview(buf);
      expect(result.rows[0]?.errors).toContain('Stock mínimo debe ser >= 0');
    });

    it('rejects code longer than 30 characters', async () => {
      const longCode = 'A'.repeat(31);
      const buf = await buildExcel([
        [longCode, 'Item', 'MATERIAL', 'CONSTRUCCION', 'BLS'],
      ]);
      const result = await service.preview(buf);
      expect(result.rows[0]?.errors).toContain('Código máximo 30 caracteres');
    });

    it('is case-insensitive for category/unit codes', async () => {
      const buf = await buildExcel([['C1', 'Item', 'MATERIAL', 'construccion', 'bls']]);
      const result = await service.preview(buf);
      expect(result.rows[0]?.valid).toBe(true);
    });

    it('counts totalValid and totalErrors correctly on mixed batch', async () => {
      const buf = await buildExcel([
        ['OK-01', 'Item OK', 'MATERIAL', 'CONSTRUCCION', 'BLS'],
        ['', 'Código vacío — se auto-genera', 'MATERIAL', 'CONSTRUCCION', 'BLS'], // ahora VÁLIDO
        ['OK-02', 'Otro OK', 'EPP', 'SEGURIDAD', 'UND'],
        ['C3', 'Cat mala', 'MATERIAL', 'INEXISTENTE', 'BLS'],
      ]);
      const result = await service.preview(buf);
      // Código es opcional ahora → 3 válidos (OK-01, sin código, OK-02), 1 error (categoría inválida)
      expect(result.totalValid).toBe(3);
      expect(result.totalErrors).toBe(1);
    });
  });

  describe('confirmImport', () => {
    const validRow = (overrides: Partial<ImportItemRowDto> = {}): ImportItemRowDto => ({
      row: 2,
      code: 'NEW-01',
      name: 'Nuevo ítem',
      type: ItemType.MATERIAL,
      categoryCode: 'CONSTRUCCION',
      unitCode: 'BLS',
      minStock: 0,
      ...overrides,
    });

    it('rejects when no rows are provided', async () => {
      await expect(service.confirmImport([], 'user-1')).rejects.toMatchObject({
        errorCode: 'IMPORT_VALIDATION_FAILED',
      });
    });

    it('creates all items in a single transaction', async () => {
      const rows = [validRow({ code: 'A-1' }), validRow({ code: 'A-2' })];
      const result = await service.confirmImport(rows, 'user-1');
      expect(result.imported).toBe(2);
      expect(result.stockInitialized).toBe(0);
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('fails if category/unit no longer exists at commit time', async () => {
      const rows = [validRow({ categoryCode: 'VANISHED' })];
      await expect(service.confirmImport(rows, 'user-1')).rejects.toMatchObject({
        errorCode: 'IMPORT_VALIDATION_FAILED',
      });
    });

    it('creates stock records in every active warehouse for each imported item', async () => {
      let capturedStockCalls = 0;
      prismaMock.$transaction.mockImplementationOnce(
        async (cb: (tx: any) => Promise<unknown>) => {
          const txMock = {
            item: { create: jest.fn().mockResolvedValue({ id: 'item-1', code: 'A-1' }) },
            stock: {
              createMany: jest.fn().mockImplementation(({ data }) => {
                capturedStockCalls += data.length;
                return Promise.resolve({ count: data.length });
              }),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            movement: { create: jest.fn().mockResolvedValue({ id: 'm' }) },
            movementSequence: { upsert: jest.fn().mockResolvedValue({ lastValue: 1 }) },
          };
          return cb(txMock);
        },
      );

      await service.confirmImport([validRow()], 'user-1');
      expect(capturedStockCalls).toBe(2);
    });

    it('crea ENTRADA automática al Principal cuando hay stockInicial > 0', async () => {
      let movementCreated: any = null;
      prismaMock.$transaction.mockImplementationOnce(
        async (cb: (tx: any) => Promise<unknown>) => {
          const txMock = {
            item: {
              create: jest.fn().mockResolvedValue({ id: 'item-new', code: 'NEW-01' }),
            },
            stock: {
              createMany: jest.fn().mockResolvedValue({ count: 2 }),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            movement: {
              create: jest.fn().mockImplementation(({ data }) => {
                movementCreated = data;
                return Promise.resolve({ id: 'mov-1', ...data });
              }),
            },
            movementSequence: { upsert: jest.fn().mockResolvedValue({ lastValue: 1 }) },
          };
          return cb(txMock);
        },
      );

      const result = await service.confirmImport(
        [validRow({ code: 'NEW-01', stockInicial: 50 })],
        'user-1',
      );

      expect(result.imported).toBe(1);
      expect(result.stockInitialized).toBe(1);
      expect(movementCreated).toBeTruthy();
      expect(movementCreated.type).toBe('ENTRADA');
      expect(movementCreated.warehouseId).toBe('wh-1');
    });

    it('NO crea movement si todos los stockInicial son 0', async () => {
      let movementCreated = false;
      prismaMock.$transaction.mockImplementationOnce(
        async (cb: (tx: any) => Promise<unknown>) => {
          const txMock = {
            item: { create: jest.fn().mockResolvedValue({ id: 'i', code: 'x' }) },
            stock: {
              createMany: jest.fn().mockResolvedValue({ count: 2 }),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            movement: {
              create: jest.fn().mockImplementation(() => {
                movementCreated = true;
                return Promise.resolve({});
              }),
            },
            movementSequence: { upsert: jest.fn().mockResolvedValue({ lastValue: 1 }) },
          };
          return cb(txMock);
        },
      );

      await service.confirmImport([validRow()], 'user-1');
      expect(movementCreated).toBe(false);
    });
  });

  describe('generateTemplate', () => {
    it('produces a valid .xlsx buffer with headers and example rows', async () => {
      const buf = await service.generateTemplate();
      expect(buf.length).toBeGreaterThan(0);

      // Validar que se puede reabrir y contiene las columnas esperadas
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
      const sheet = wb.worksheets[0]!;
      const headers = sheet.getRow(1).values as (string | undefined)[];
      expect(headers).toContain('codigo');
      expect(headers).toContain('nombre');
      expect(headers).toContain('tipo');
      expect(headers).toContain('categoria');
      expect(headers).toContain('unidad');

      // Tiene al menos las 2 filas de ejemplo
      expect(sheet.rowCount).toBeGreaterThanOrEqual(3);
    });
  });
});
