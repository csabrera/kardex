import { Test, TestingModule } from '@nestjs/testing';
import { MovementType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      movement: { findMany: jest.fn().mockResolvedValue([]) },
      movementItem: { findMany: jest.fn().mockResolvedValue([]) },
      stock: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('consumptionByObra', () => {
    it('agrupa salidas por obra sumando cantidades y valor', async () => {
      prismaMock.movement.findMany.mockResolvedValueOnce([
        {
          warehouse: {
            obraId: 'o-1',
            obra: { id: 'o-1', code: 'OBR-001', name: 'Edificio A', status: 'ACTIVA' },
          },
          items: [
            { quantity: 10, unitCost: 5 },
            { quantity: 5, unitCost: 10 },
          ],
        },
        {
          warehouse: {
            obraId: 'o-1',
            obra: { id: 'o-1', code: 'OBR-001', name: 'Edificio A', status: 'ACTIVA' },
          },
          items: [{ quantity: 3, unitCost: null }],
        },
        {
          warehouse: {
            obraId: 'o-2',
            obra: { id: 'o-2', code: 'OBR-002', name: 'Puente B', status: 'ACTIVA' },
          },
          items: [{ quantity: 20, unitCost: 2 }],
        },
      ]);

      const result = await service.consumptionByObra({});

      expect(result.items).toHaveLength(2);
      // Obra 1: 10 + 5 + 3 = 18, valor 10*5 + 5*10 = 100
      expect(result.items[0]).toMatchObject({
        obraId: 'o-2',
        totalQuantity: 20,
        totalValue: 40,
      });
      expect(result.items[1]).toMatchObject({
        obraId: 'o-1',
        totalQuantity: 18,
        totalValue: 100,
        movementsCount: 2,
      });
    });

    it('omite movimientos sin obra', async () => {
      prismaMock.movement.findMany.mockResolvedValueOnce([
        {
          warehouse: { obraId: null, obra: null },
          items: [{ quantity: 10, unitCost: 5 }],
        },
      ]);
      const result = await service.consumptionByObra({});
      expect(result.items).toHaveLength(0);
    });
  });

  describe('topItems', () => {
    it('rankea por cantidad movida total y respeta el limit', async () => {
      prismaMock.movement.findMany.mockResolvedValueOnce([
        {
          items: [
            {
              itemId: 'i-1',
              quantity: 50,
              item: {
                id: 'i-1',
                code: 'A',
                name: 'Clavos',
                type: 'MATERIAL',
                unit: { abbreviation: 'kg' },
              },
            },
            {
              itemId: 'i-2',
              quantity: 10,
              item: {
                id: 'i-2',
                code: 'B',
                name: 'Cemento',
                type: 'MATERIAL',
                unit: { abbreviation: 'bolsa' },
              },
            },
          ],
        },
        {
          items: [
            {
              itemId: 'i-1',
              quantity: 25,
              item: {
                id: 'i-1',
                code: 'A',
                name: 'Clavos',
                type: 'MATERIAL',
                unit: { abbreviation: 'kg' },
              },
            },
            {
              itemId: 'i-3',
              quantity: 100,
              item: {
                id: 'i-3',
                code: 'C',
                name: 'Arena',
                type: 'MATERIAL',
                unit: { abbreviation: 'm3' },
              },
            },
          ],
        },
      ]);

      const result = await service.topItems({ limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({ itemId: 'i-3', totalQuantity: 100 });
      expect(result.items[1]).toMatchObject({
        itemId: 'i-1',
        totalQuantity: 75,
        movementsCount: 2,
      });
    });

    it('filtra por type cuando se especifica', async () => {
      await service.topItems({ type: MovementType.SALIDA });
      expect(prismaMock.movement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: MovementType.SALIDA }),
        }),
      );
    });
  });

  describe('stockValuation', () => {
    it('valoriza con el último unitCost conocido por ítem', async () => {
      prismaMock.stock.findMany.mockResolvedValueOnce([
        {
          itemId: 'i-1',
          warehouseId: 'w-1',
          quantity: 100,
          item: {
            id: 'i-1',
            code: 'A',
            name: 'Clavos',
            type: 'MATERIAL',
            unit: { abbreviation: 'kg' },
          },
          warehouse: { id: 'w-1', code: 'W1', name: 'Principal' },
        },
        {
          itemId: 'i-2',
          warehouseId: 'w-1',
          quantity: 20,
          item: {
            id: 'i-2',
            code: 'B',
            name: 'Cemento',
            type: 'MATERIAL',
            unit: { abbreviation: 'bolsa' },
          },
          warehouse: { id: 'w-1', code: 'W1', name: 'Principal' },
        },
      ]);
      prismaMock.movementItem.findMany.mockResolvedValueOnce([
        { itemId: 'i-1', unitCost: 3 },
        { itemId: 'i-1', unitCost: 2 }, // más viejo, debe ignorarse
        // i-2 no tiene movimientos con costo
      ]);

      const result = await service.stockValuation({});

      expect(result.totalValue).toBe(300); // 100 * 3
      expect(result.itemsWithCost).toBe(1);
      expect(result.itemsWithoutCost).toBe(1);
      expect(result.items[0]).toMatchObject({ itemId: 'i-1', value: 300 });
      expect(result.items[1]).toMatchObject({ itemId: 'i-2', value: null });
    });

    it('retorna vacío cuando no hay stock', async () => {
      prismaMock.stock.findMany.mockResolvedValueOnce([]);
      const result = await service.stockValuation({});
      expect(result.items).toHaveLength(0);
      expect(result.totalValue).toBe(0);
    });
  });

  describe('movementsSummary', () => {
    it('agrupa por día con conteo y cantidad por tipo', async () => {
      prismaMock.movement.findMany.mockResolvedValueOnce([
        {
          type: MovementType.ENTRADA,
          source: 'COMPRA',
          createdAt: new Date('2026-04-20T10:00:00Z'),
          items: [{ quantity: 100 }],
        },
        {
          type: MovementType.SALIDA,
          source: 'CONSUMO',
          createdAt: new Date('2026-04-20T14:00:00Z'),
          items: [{ quantity: 30 }, { quantity: 20 }],
        },
        {
          type: MovementType.AJUSTE,
          source: 'INVENTARIO',
          createdAt: new Date('2026-04-21T09:00:00Z'),
          items: [{ quantity: 5 }],
        },
      ]);

      const result = await service.movementsSummary({ groupBy: 'day' });

      expect(result.totals).toEqual({ entradas: 1, salidas: 1, ajustes: 1 });
      expect(result.series).toHaveLength(2);
      expect(result.series[0]).toMatchObject({
        bucket: '2026-04-20',
        entradas: 1,
        salidas: 1,
        qtyEntradas: 100,
        qtySalidas: 50,
      });
      expect(result.series[1]).toMatchObject({
        bucket: '2026-04-21',
        ajustes: 1,
        qtyAjustes: 5,
      });
    });

    it('agrupa por mes', async () => {
      prismaMock.movement.findMany.mockResolvedValueOnce([
        {
          type: MovementType.ENTRADA,
          source: 'COMPRA',
          createdAt: new Date('2026-03-15T10:00:00Z'),
          items: [{ quantity: 10 }],
        },
        {
          type: MovementType.SALIDA,
          source: 'CONSUMO',
          createdAt: new Date('2026-04-20T14:00:00Z'),
          items: [{ quantity: 5 }],
        },
      ]);

      const result = await service.movementsSummary({ groupBy: 'month' });

      expect(result.series).toHaveLength(2);
      expect(result.series[0].bucket).toBe('2026-03');
      expect(result.series[1].bucket).toBe('2026-04');
    });
  });
});
