import { Injectable, HttpStatus } from '@nestjs/common';
import { ItemType, MovementSource, MovementType, WarehouseType } from '@prisma/client';
import * as ExcelJS from 'exceljs';

import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import { generateCode } from '../../common/utils/code-generator';
import type { ImportItemRowDto, ImportPreviewRowDto } from './dto/import-item.dto';

interface ParsedRow {
  row: number;
  code: string;
  name: string;
  type: string;
  categoryCode: string;
  unitCode: string;
  minStock?: number;
  maxStock?: number;
  stockInicial?: number;
  description?: string;
}

// Mapping flexible: acepta los 3 nombres canónicos + sinónimos del modelo legacy
// (MATERIAL/REPUESTO → CONSUMO, HERRAMIENTA/EQUIPO → PRESTAMO, EPP → ASIGNACION)
// para que las plantillas Excel viejas sigan funcionando.
const ITEM_TYPE_MAP: Record<string, ItemType> = {
  CONSUMO: ItemType.CONSUMO,
  PRESTAMO: ItemType.PRESTAMO,
  ASIGNACION: ItemType.ASIGNACION,
  // Sinónimos legacy (compatibilidad con plantillas Excel del modelo de 5 tipos)
  MATERIAL: ItemType.CONSUMO,
  REPUESTO: ItemType.CONSUMO,
  HERRAMIENTA: ItemType.PRESTAMO,
  EQUIPO: ItemType.PRESTAMO,
  EPP: ItemType.ASIGNACION,
};

const REQUIRED_HEADERS = ['codigo', 'nombre', 'tipo', 'categoria', 'unidad'];

@Injectable()
export class ItemsImportService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(
    buffer: Buffer,
  ): Promise<{ rows: ImportPreviewRowDto[]; totalValid: number; totalErrors: number }> {
    const rawRows = await this.parseExcel(buffer);

    const [categories, units, existingItems] = await Promise.all([
      this.prisma.category.findMany({
        where: { deletedAt: null },
        select: { id: true, code: true },
      }),
      this.prisma.unit.findMany({ select: { id: true, code: true } }),
      this.prisma.item.findMany({ where: { deletedAt: null }, select: { code: true } }),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.code.toUpperCase(), c.id]));
    const unitMap = new Map(units.map((u) => [u.code.toUpperCase(), u.id]));
    const existingCodeSet = new Set(existingItems.map((i) => i.code.toUpperCase()));
    const seenInBatch = new Set<string>();

    const rows: ImportPreviewRowDto[] = rawRows.map((raw) => {
      const errors: string[] = [];

      const code = raw.code.trim();
      const name = raw.name.trim();
      const typeRaw = raw.type.trim().toUpperCase();
      const categoryCode = raw.categoryCode.trim().toUpperCase();
      const unitCode = raw.unitCode.trim().toUpperCase();
      const minStock = raw.minStock ?? 0;
      const maxStock = raw.maxStock;
      const stockInicial = raw.stockInicial ?? 0;

      // Código es OPCIONAL; si viene vacío se auto-genera en confirmImport
      if (code) {
        if (code.length > 30) errors.push('Código máximo 30 caracteres');
        else if (existingCodeSet.has(code.toUpperCase()))
          errors.push(`Código "${code}" ya existe en la BD`);
        else if (seenInBatch.has(code.toUpperCase()))
          errors.push(`Código "${code}" duplicado en el archivo`);
      }

      if (!name) errors.push('Nombre requerido');
      else if (name.length > 200) errors.push('Nombre máximo 200 caracteres');

      const type = ITEM_TYPE_MAP[typeRaw];
      if (!type)
        errors.push(
          `Tipo "${typeRaw}" inválido. Válidos: ${Object.keys(ITEM_TYPE_MAP).join(', ')}`,
        );

      if (!categoryCode) errors.push('Categoría requerida');
      else if (!categoryMap.has(categoryCode))
        errors.push(`Categoría "${categoryCode}" no existe`);

      if (!unitCode) errors.push('Unidad requerida');
      else if (!unitMap.has(unitCode)) errors.push(`Unidad "${unitCode}" no existe`);

      if (minStock < 0) errors.push('Stock mínimo debe ser >= 0');
      if (maxStock !== undefined && maxStock < 0)
        errors.push('Stock máximo debe ser >= 0');
      if (stockInicial < 0) errors.push('Stock inicial debe ser >= 0');

      if (errors.length === 0 && code) seenInBatch.add(code.toUpperCase());

      return {
        row: raw.row,
        code,
        name,
        type: type ?? typeRaw,
        categoryCode: raw.categoryCode,
        unitCode: raw.unitCode,
        minStock,
        maxStock,
        stockInicial,
        description: raw.description,
        valid: errors.length === 0,
        errors,
      };
    });

    return {
      rows,
      totalValid: rows.filter((r) => r.valid).length,
      totalErrors: rows.filter((r) => !r.valid).length,
    };
  }

  async confirmImport(
    rows: ImportItemRowDto[],
    userId: string,
  ): Promise<{ imported: number; stockInitialized: number }> {
    if (rows.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.IMPORT_VALIDATION_FAILED,
        'No hay filas para importar',
        HttpStatus.BAD_REQUEST,
      );
    }

    const [categories, units, warehouses, mainWarehouse] = await Promise.all([
      this.prisma.category.findMany({
        where: { deletedAt: null },
        select: { id: true, code: true },
      }),
      this.prisma.unit.findMany({ select: { id: true, code: true } }),
      this.prisma.warehouse.findMany({
        where: { deletedAt: null, active: true },
        select: { id: true, type: true },
      }),
      this.prisma.warehouse.findFirst({
        where: { type: WarehouseType.CENTRAL, deletedAt: null, active: true },
        select: { id: true, name: true },
      }),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.code.toUpperCase(), c.id]));
    const unitMap = new Map(units.map((u) => [u.code.toUpperCase(), u.id]));

    let imported = 0;
    let stockInitialized = 0;

    await this.prisma.$transaction(async (tx) => {
      const itemsWithInitial: { itemId: string; quantity: number }[] = [];

      for (const row of rows) {
        const categoryId = categoryMap.get(row.categoryCode.toUpperCase());
        const unitId = unitMap.get(row.unitCode.toUpperCase());

        if (!categoryId || !unitId) {
          throw new BusinessException(
            BusinessErrorCode.IMPORT_VALIDATION_FAILED,
            `Fila ${row.row}: categoría o unidad no encontrada`,
            HttpStatus.BAD_REQUEST,
          );
        }

        const itemCode = row.code?.trim() || generateCode('ITM');

        const item = await tx.item.create({
          data: {
            code: itemCode,
            name: row.name,
            description: row.description,
            type: row.type,
            categoryId,
            unitId,
            minStock: row.minStock ?? 0,
            maxStock: row.maxStock,
          },
        });

        if (warehouses.length > 0) {
          await tx.stock.createMany({
            data: warehouses.map((w) => ({
              itemId: item.id,
              warehouseId: w.id,
              quantity: 0,
            })),
            skipDuplicates: true,
          });
        }

        imported++;

        // Si viene stockInicial > 0, lo preparamos para una ENTRADA masiva
        if (row.stockInicial && row.stockInicial > 0 && mainWarehouse) {
          itemsWithInitial.push({ itemId: item.id, quantity: row.stockInicial });
        }
      }

      // Crear UNA sola ENTRADA al Principal con todos los items que tienen stockInicial
      if (itemsWithInitial.length > 0 && mainWarehouse) {
        // Generar código de movimiento
        const seq = await tx.movementSequence.upsert({
          where: { type: MovementType.ENTRADA },
          update: { lastValue: { increment: 1 } },
          create: { type: MovementType.ENTRADA, lastValue: 1 },
        });
        const code = `ENT-${String(seq.lastValue).padStart(5, '0')}`;

        // Actualizar stocks y preparar items del movimiento
        const processedItems: {
          itemId: string;
          quantity: number;
          stockBefore: number;
          stockAfter: number;
        }[] = [];

        for (const line of itemsWithInitial) {
          // El stock se acaba de crear en 0 arriba, hacemos updateMany version=0
          const updated = await tx.stock.updateMany({
            where: { itemId: line.itemId, warehouseId: mainWarehouse.id, version: 0 },
            data: { quantity: line.quantity, version: { increment: 1 } },
          });
          if (updated.count === 0) {
            throw new BusinessException(
              BusinessErrorCode.STOCK_CONFLICT,
              'Conflicto al inicializar stock del Principal',
              HttpStatus.CONFLICT,
            );
          }
          processedItems.push({
            itemId: line.itemId,
            quantity: line.quantity,
            stockBefore: 0,
            stockAfter: line.quantity,
          });
          stockInitialized++;
        }

        // Crear el Movement único
        await tx.movement.create({
          data: {
            code,
            type: MovementType.ENTRADA,
            source: MovementSource.COMPRA,
            warehouseId: mainWarehouse.id,
            userId,
            notes: `Carga inicial desde importación Excel (${processedItems.length} ítems)`,
            items: { create: processedItems },
          },
        });
      }
    });

    return { imported, stockInitialized };
  }

  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ítems');

    sheet.columns = [
      { header: 'codigo', key: 'codigo', width: 15 },
      { header: 'nombre', key: 'nombre', width: 35 },
      { header: 'tipo', key: 'tipo', width: 15 },
      { header: 'categoria', key: 'categoria', width: 20 },
      { header: 'unidad', key: 'unidad', width: 12 },
      { header: 'stockmin', key: 'stockmin', width: 12 },
      { header: 'stockmax', key: 'stockmax', width: 12 },
      { header: 'stockinicial', key: 'stockinicial', width: 14 },
      { header: 'descripcion', key: 'descripcion', width: 40 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.alignment = { horizontal: 'center' };
    });

    sheet.addRow({
      codigo: 'CEMEN-42',
      nombre: 'Cemento Portland 42.5kg',
      tipo: 'CONSUMO',
      categoria: 'CONSTRUCCION',
      unidad: 'BLS',
      stockmin: 10,
      stockmax: 100,
      stockinicial: 50,
      descripcion: 'Bolsa 42.5kg',
    });
    sheet.addRow({
      codigo: 'CASCO-01',
      nombre: 'Casco de seguridad',
      tipo: 'ASIGNACION',
      categoria: 'SEGURIDAD',
      unidad: 'UND',
      stockmin: 5,
      stockinicial: 20,
      descripcion: '',
    });

    const notes = workbook.addWorksheet('Notas');
    notes.getCell('A1').value = 'TIPOS VÁLIDOS';
    notes.getCell('A1').font = { bold: true };
    Object.keys(ITEM_TYPE_MAP).forEach((t, i) => {
      notes.getCell(`A${i + 2}`).value = t;
    });
    notes.getCell('C1').value = 'INSTRUCCIONES';
    notes.getCell('C1').font = { bold: true };
    notes.getCell('C2').value =
      'codigo, nombre, tipo, categoria y unidad son obligatorios.';
    notes.getCell('C3').value = 'categoria y unidad: usar el CÓDIGO exacto (mayúsculas).';
    notes.getCell('C4').value = 'stockmin y stockmax son opcionales (default 0).';
    notes.getCell('C5').value =
      'stockinicial: cantidad inicial al Almacén Principal (default 0).';
    notes.getCell('C6').value =
      'Si stockinicial > 0, se crea una entrada automática al Principal al confirmar.';

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async parseExcel(buffer: Buffer): Promise<ParsedRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BusinessException(
        BusinessErrorCode.IMPORT_VALIDATION_FAILED,
        'Archivo Excel inválido o vacío',
        HttpStatus.BAD_REQUEST,
      );
    }

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell) => {
      headers.push(
        String(cell.value ?? '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ''),
      );
    });

    const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
    if (missing.length > 0) {
      throw new BusinessException(
        BusinessErrorCode.IMPORT_VALIDATION_FAILED,
        `Columnas faltantes: ${missing.join(', ')}. Descargue la plantilla para ver el formato correcto.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const colIdx = (name: string) => headers.indexOf(name);

    const getCell = (row: ExcelJS.Row, col: string): string | undefined => {
      const idx = colIdx(col);
      if (idx < 0) return undefined;
      const cell = row.getCell(idx + 1);
      const val = cell.value;
      if (val === null || val === undefined || String(val).trim() === '')
        return undefined;
      return String(val).trim();
    };

    const getNum = (row: ExcelJS.Row, col: string): number | undefined => {
      const v = getCell(row, col);
      if (v === undefined) return undefined;
      const n = parseFloat(v);
      return isNaN(n) ? undefined : n;
    };

    const results: ParsedRow[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const code = getCell(row, 'codigo');
      const name = getCell(row, 'nombre');
      if (!code && !name) return; // skip empty rows

      results.push({
        row: rowNumber,
        code: code ?? '',
        name: name ?? '',
        type: getCell(row, 'tipo') ?? '',
        categoryCode: getCell(row, 'categoria') ?? '',
        unitCode: getCell(row, 'unidad') ?? '',
        minStock: getNum(row, 'stockmin'),
        maxStock: getNum(row, 'stockmax'),
        stockInicial: getNum(row, 'stockinicial'),
        description: getCell(row, 'descripcion'),
      });
    });

    if (results.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.IMPORT_VALIDATION_FAILED,
        'El archivo no contiene filas de datos',
        HttpStatus.BAD_REQUEST,
      );
    }

    return results;
  }
}
