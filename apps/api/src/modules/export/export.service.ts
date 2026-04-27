import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { MovementType } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';

export type ReportType = 'kardex' | 'stock' | 'movements';

export interface ExportJobData {
  reportType: ReportType;
  filters: Record<string, string | undefined>;
  userId: string;
}

export const EXPORT_QUEUE = 'export-pdf';
export const EXPORT_JOB = 'generate-pdf';
export const TMP_DIR = path.join(os.tmpdir(), 'kardex-exports');

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EXPORT_QUEUE) private readonly pdfQueue: Queue<ExportJobData>,
  ) {}

  private parseMovementType(value?: string): MovementType | undefined {
    if (!value) return undefined;
    return (Object.values(MovementType) as string[]).includes(value)
      ? (value as MovementType)
      : undefined;
  }

  // ─── Excel (síncrono) ────────────────────────────────────────────────────

  async generateExcel(
    reportType: ReportType,
    filters: Record<string, string | undefined>,
  ): Promise<Buffer> {
    switch (reportType) {
      case 'kardex':
        return this.excelKardex(filters.itemId, filters.warehouseId);
      case 'stock':
        return this.excelStock(filters.warehouseId);
      case 'movements':
        return this.excelMovements(filters.type, filters.warehouseId);
      default:
        throw new BusinessException(
          BusinessErrorCode.IMPORT_VALIDATION_FAILED,
          `Tipo de reporte desconocido: ${reportType}`,
          HttpStatus.BAD_REQUEST,
        );
    }
  }

  // ─── PDF (asíncrono vía BullMQ) ──────────────────────────────────────────

  async queuePdf(
    reportType: ReportType,
    filters: Record<string, string | undefined>,
    userId: string,
  ): Promise<{ jobId: string }> {
    await fs.mkdir(TMP_DIR, { recursive: true });
    const job = await this.pdfQueue.add(
      EXPORT_JOB,
      { reportType, filters, userId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: false,
        removeOnFail: false,
      },
    );
    return { jobId: String(job.id) };
  }

  async getPdfJobStatus(jobId: string) {
    const job = await this.pdfQueue.getJob(jobId);
    if (!job) {
      throw new BusinessException(
        BusinessErrorCode.EXPORT_JOB_NOT_FOUND,
        `Job ${jobId} no encontrado`,
        HttpStatus.NOT_FOUND,
      );
    }

    const state = await job.getState();
    const result = job.returnvalue as { filePath?: string } | null;

    return {
      jobId,
      status: state.toUpperCase(),
      progress: job.progress(),
      failedReason: job.failedReason,
      downloadUrl:
        state === 'completed' && result?.filePath
          ? `/export/pdf/${jobId}/download`
          : undefined,
    };
  }

  async getPdfFile(jobId: string): Promise<string> {
    const job = await this.pdfQueue.getJob(jobId);
    if (!job) {
      throw new BusinessException(
        BusinessErrorCode.EXPORT_JOB_NOT_FOUND,
        'Job no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    const state = await job.getState();
    if (state !== 'completed') {
      throw new BusinessException(
        BusinessErrorCode.EXPORT_JOB_NOT_FOUND,
        `El PDF todavía no está listo (estado: ${state})`,
        HttpStatus.NOT_FOUND,
      );
    }
    const result = job.returnvalue as { filePath: string };
    return result.filePath;
  }

  // ─── Generadores Excel ────────────────────────────────────────────────────

  async excelKardex(itemId?: string, warehouseId?: string): Promise<Buffer> {
    if (!itemId) {
      throw new BusinessException(
        BusinessErrorCode.IMPORT_VALIDATION_FAILED,
        'Se requiere itemId para el reporte de kardex',
        HttpStatus.BAD_REQUEST,
      );
    }

    const item = await this.prisma.item.findFirst({
      where: { id: itemId, deletedAt: null },
      include: { unit: true, category: true },
    });
    if (!item) {
      throw new BusinessException(
        BusinessErrorCode.ITEM_NOT_FOUND,
        'Ítem no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    const entries = await this.prisma.movementItem.findMany({
      where: { itemId, movement: warehouseId ? { warehouseId } : undefined },
      include: {
        movement: {
          include: {
            warehouse: { select: { code: true, name: true } },
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { movement: { createdAt: 'asc' } },
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Kardex');

    // Título
    ws.mergeCells('A1:H1');
    ws.getCell('A1').value = `KARDEX — ${item.code}: ${item.name}`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.mergeCells('A2:H2');
    ws.getCell('A2').value =
      `Categoría: ${item.category.name} | Unidad: ${item.unit.abbreviation} | Generado: ${new Date().toLocaleString('es-PE')}`;
    ws.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
    ws.getCell('A2').alignment = { horizontal: 'center' };

    ws.addRow([]);

    const headers = [
      'Fecha',
      'Código',
      'Tipo',
      'Motivo',
      'Almacén',
      'Cantidad',
      'Saldo',
      'Observaciones',
    ];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell, col) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.alignment = { horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFBFDBFE' } } };
      ws.getColumn(col).width = [20, 14, 10, 14, 20, 12, 12, 35][col - 1];
    });

    for (const e of entries) {
      const sign =
        e.movement.type === 'ENTRADA' ? '+' : e.movement.type === 'SALIDA' ? '-' : '±';
      const row = ws.addRow([
        new Date(e.movement.createdAt).toLocaleString('es-PE'),
        e.movement.code,
        e.movement.type,
        e.movement.source,
        e.movement.warehouse.name,
        `${sign}${Number(e.quantity).toFixed(3)}`,
        Number(e.stockAfter).toFixed(3),
        e.movement.notes ?? '',
      ]);

      const typeColor =
        e.movement.type === 'ENTRADA'
          ? 'FF16A34A'
          : e.movement.type === 'SALIDA'
            ? 'FFDC2626'
            : 'FFD97706';
      row.getCell(3).font = { color: { argb: typeColor }, bold: true };
      row.getCell(6).font = { bold: true, color: { argb: typeColor } };
    }

    ws.views = [{ state: 'frozen', ySplit: 4 }];

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async excelStock(warehouseId?: string): Promise<Buffer> {
    const stocks = await this.prisma.stock.findMany({
      where: {
        ...(warehouseId && { warehouseId }),
        item: { deletedAt: null },
        warehouse: { deletedAt: null },
      },
      include: {
        item: { include: { unit: true, category: true } },
        warehouse: { select: { code: true, name: true, type: true } },
      },
      orderBy: [{ warehouse: { code: 'asc' } }, { item: { code: 'asc' } }],
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Stock');

    ws.mergeCells('A1:G1');
    ws.getCell('A1').value =
      `REPORTE DE STOCK ACTUAL — ${new Date().toLocaleDateString('es-PE')}`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };
    ws.addRow([]);

    const headers = [
      'Almacén',
      'Código Ítem',
      'Nombre',
      'Categoría',
      'Unidad',
      'Stock Actual',
      'Stock Mínimo',
    ];
    const headerRow = ws.addRow(headers);
    const colWidths = [25, 14, 40, 20, 10, 14, 14];
    headerRow.eachCell((cell, col) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.alignment = { horizontal: 'center' };
      ws.getColumn(col).width = colWidths[col - 1];
    });

    for (const s of stocks) {
      const qty = Number(s.quantity);
      const min = Number(s.item.minStock);
      const isLow = min > 0 && qty < min;
      const isOut = qty === 0;

      const row = ws.addRow([
        s.warehouse.name,
        s.item.code,
        s.item.name,
        s.item.category.name,
        s.item.unit.abbreviation,
        qty,
        min,
      ]);

      if (isOut) {
        row.getCell(6).font = { bold: true, color: { argb: 'FFDC2626' } };
        row.getCell(6).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEF2F2' },
        };
      } else if (isLow) {
        row.getCell(6).font = { bold: true, color: { argb: 'FFD97706' } };
        row.getCell(6).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFBEB' },
        };
      }
    }

    ws.views = [{ state: 'frozen', ySplit: 3 }];

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async excelMovements(type?: string, warehouseId?: string): Promise<Buffer> {
    const movementType = this.parseMovementType(type);
    const movements = await this.prisma.movement.findMany({
      where: {
        ...(movementType && { type: movementType }),
        ...(warehouseId && { warehouseId }),
      },
      include: {
        warehouse: { select: { code: true, name: true } },
        user: { select: { firstName: true, lastName: true } },
        items: {
          include: {
            item: {
              select: {
                code: true,
                name: true,
                unit: { select: { abbreviation: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Movimientos');

    ws.mergeCells('A1:H1');
    ws.getCell('A1').value =
      `REPORTE DE MOVIMIENTOS — ${new Date().toLocaleDateString('es-PE')}`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };
    ws.addRow([]);

    const headers = [
      'Código',
      'Fecha',
      'Tipo',
      'Motivo',
      'Almacén',
      'Ítems',
      'Usuario',
      'Observaciones',
    ];
    const headerRow = ws.addRow(headers);
    const colWidths = [14, 20, 10, 16, 25, 40, 25, 40];
    headerRow.eachCell((cell, col) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.alignment = { horizontal: 'center' };
      ws.getColumn(col).width = colWidths[col - 1];
    });

    for (const m of movements) {
      const itemsSummary = m.items
        .map(
          (i) =>
            `${i.item.code}: ${Number(i.quantity).toFixed(3)} ${i.item.unit.abbreviation}`,
        )
        .join(' | ');

      ws.addRow([
        m.code,
        new Date(m.createdAt).toLocaleString('es-PE'),
        m.type,
        m.source,
        m.warehouse.name,
        itemsSummary,
        `${m.user.firstName} ${m.user.lastName}`,
        m.notes ?? '',
      ]);
    }

    ws.views = [{ state: 'frozen', ySplit: 3 }];

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // ─── Generador HTML para PDF ──────────────────────────────────────────────

  async buildHtml(
    reportType: ReportType,
    filters: Record<string, string | undefined>,
  ): Promise<string> {
    switch (reportType) {
      case 'kardex':
        return this.htmlKardex(filters.itemId, filters.warehouseId);
      case 'stock':
        return this.htmlStock(filters.warehouseId);
      case 'movements':
        return this.htmlMovements(filters.type, filters.warehouseId);
      default:
        throw new BusinessException(
          BusinessErrorCode.IMPORT_VALIDATION_FAILED,
          `Tipo de reporte desconocido: ${reportType}`,
          HttpStatus.BAD_REQUEST,
        );
    }
  }

  private async htmlKardex(itemId?: string, warehouseId?: string): Promise<string> {
    if (!itemId) throw new Error('Se requiere itemId');

    const item = await this.prisma.item.findFirst({
      where: { id: itemId, deletedAt: null },
      include: { unit: true, category: true },
    });
    if (!item) throw new Error('Ítem no encontrado');

    const entries = await this.prisma.movementItem.findMany({
      where: { itemId, movement: warehouseId ? { warehouseId } : undefined },
      include: {
        movement: {
          include: {
            warehouse: { select: { name: true } },
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { movement: { createdAt: 'asc' } },
    });

    const rows = entries
      .map((e) => {
        const sign =
          e.movement.type === 'ENTRADA' ? '+' : e.movement.type === 'SALIDA' ? '-' : '±';
        const color =
          e.movement.type === 'ENTRADA'
            ? '#16a34a'
            : e.movement.type === 'SALIDA'
              ? '#dc2626'
              : '#d97706';
        return `
        <tr>
          <td>${new Date(e.movement.createdAt).toLocaleString('es-PE')}</td>
          <td style="font-family:monospace">${e.movement.code}</td>
          <td style="color:${color};font-weight:bold">${e.movement.type}</td>
          <td>${e.movement.source}</td>
          <td>${e.movement.warehouse.name}</td>
          <td style="color:${color};font-weight:bold;text-align:right">${sign}${Number(e.quantity).toFixed(3)} ${item.unit.abbreviation}</td>
          <td style="font-weight:bold;text-align:right">${Number(e.stockAfter).toFixed(3)} ${item.unit.abbreviation}</td>
          <td>${e.movement.notes ?? ''}</td>
        </tr>`;
      })
      .join('');

    return this.wrapHtml(
      `KARDEX — ${item.code}: ${item.name}`,
      `Categoría: ${item.category.name} | Unidad: ${item.unit.name} (${item.unit.abbreviation}) | ${entries.length} movimientos`,
      `<table>
        <thead>
          <tr>
            <th>Fecha</th><th>Código</th><th>Tipo</th><th>Motivo</th>
            <th>Almacén</th><th>Cantidad</th><th>Saldo</th><th>Observaciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`,
    );
  }

  private async htmlStock(warehouseId?: string): Promise<string> {
    const stocks = await this.prisma.stock.findMany({
      where: {
        ...(warehouseId && { warehouseId }),
        item: { deletedAt: null },
        warehouse: { deletedAt: null },
      },
      include: {
        item: { include: { unit: true, category: true } },
        warehouse: { select: { name: true } },
      },
      orderBy: [{ warehouse: { code: 'asc' } }, { item: { code: 'asc' } }],
    });

    const belowMin = stocks.filter(
      (s) => Number(s.quantity) < Number(s.item.minStock) && Number(s.item.minStock) > 0,
    );

    const rows = stocks
      .map((s) => {
        const qty = Number(s.quantity);
        const min = Number(s.item.minStock);
        const isOut = qty === 0;
        const isLow = min > 0 && qty < min;
        const color = isOut ? '#dc2626' : isLow ? '#d97706' : 'inherit';
        return `<tr>
          <td>${s.warehouse.name}</td>
          <td style="font-family:monospace">${s.item.code}</td>
          <td>${s.item.name}</td>
          <td>${s.item.category.name}</td>
          <td>${s.item.unit.abbreviation}</td>
          <td style="color:${color};font-weight:${isLow || isOut ? 'bold' : 'normal'};text-align:right">${qty.toFixed(3)}</td>
          <td style="text-align:right">${min.toFixed(3)}</td>
        </tr>`;
      })
      .join('');

    return this.wrapHtml(
      'REPORTE DE STOCK ACTUAL',
      `${stocks.length} registros | ${belowMin.length} con stock bajo | Generado: ${new Date().toLocaleString('es-PE')}`,
      `<table>
        <thead>
          <tr>
            <th>Almacén</th><th>Código</th><th>Ítem</th><th>Categoría</th>
            <th>Unidad</th><th>Stock Actual</th><th>Mínimo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`,
    );
  }

  private async htmlMovements(type?: string, warehouseId?: string): Promise<string> {
    const movementType = this.parseMovementType(type);
    const movements = await this.prisma.movement.findMany({
      where: {
        ...(movementType && { type: movementType }),
        ...(warehouseId && { warehouseId }),
      },
      include: {
        warehouse: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
        items: {
          include: {
            item: {
              select: {
                code: true,
                name: true,
                unit: { select: { abbreviation: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const rows = movements
      .map((m) => {
        const color =
          m.type === 'ENTRADA' ? '#16a34a' : m.type === 'SALIDA' ? '#dc2626' : '#d97706';
        const items = m.items
          .map(
            (i) =>
              `${i.item.code}: ${Number(i.quantity).toFixed(3)} ${i.item.unit.abbreviation}`,
          )
          .join('<br>');
        return `<tr>
          <td style="font-family:monospace">${m.code}</td>
          <td>${new Date(m.createdAt).toLocaleString('es-PE')}</td>
          <td style="color:${color};font-weight:bold">${m.type}</td>
          <td>${m.source}</td>
          <td>${m.warehouse.name}</td>
          <td style="font-size:11px">${items}</td>
          <td>${m.user.firstName} ${m.user.lastName}</td>
        </tr>`;
      })
      .join('');

    return this.wrapHtml(
      `REPORTE DE MOVIMIENTOS${type ? ` — ${type}` : ''}`,
      `${movements.length} registros | Generado: ${new Date().toLocaleString('es-PE')}`,
      `<table>
        <thead>
          <tr>
            <th>Código</th><th>Fecha</th><th>Tipo</th><th>Motivo</th>
            <th>Almacén</th><th>Ítems</th><th>Usuario</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`,
    );
  }

  private wrapHtml(title: string, subtitle: string, content: string): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; padding: 20mm 15mm; }
  .header { border-bottom: 3px solid #1e40af; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header-left { }
  .header-logo { font-size: 22px; font-weight: bold; color: #1e40af; letter-spacing: -0.5px; }
  .header-subtitle { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .header-right { text-align: right; font-size: 10px; color: #6b7280; }
  h1 { font-size: 16px; font-weight: bold; color: #111827; margin-bottom: 4px; }
  .subtitle { font-size: 11px; color: #6b7280; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e40af; color: white; padding: 7px 8px; text-align: left; font-size: 11px; font-weight: 600; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
  tr:nth-child(even) td { background: #f9fafb; }
  .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="header-logo">📦 Kardex</div>
      <div class="header-subtitle">Sistema de Control de Inventario</div>
    </div>
    <div class="header-right">
      Generado el ${new Date().toLocaleString('es-PE')}<br>
      Sistema Kardex v1.0
    </div>
  </div>
  <h1>${title}</h1>
  <p class="subtitle">${subtitle}</p>
  ${content}
  <div class="footer">Documento generado automáticamente por el Sistema Kardex — Confidencial</div>
</body>
</html>`;
  }
}
