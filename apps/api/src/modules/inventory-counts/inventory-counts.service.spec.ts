import { Test, TestingModule } from '@nestjs/testing';
import { InventoryCountStatus, MovementSource, MovementType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { InventoryCountsService } from './inventory-counts.service';

describe('InventoryCountsService', () => {
  let service: InventoryCountsService;
  let prismaMock: any;
  let realtimeMock: any;
  let txMock: any;

  const warehouseId = 'wh-1';
  const userId = 'u-1';

  beforeEach(async () => {
    txMock = {
      inventoryCountSequence: {
        upsert: jest.fn().mockResolvedValue({ lastValue: 1 }),
      },
      movementSequence: {
        upsert: jest.fn().mockResolvedValue({ lastValue: 42 }),
      },
      inventoryCount: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'count-new', code: 'INV-00001', ...data }),
          ),
        update: jest
          .fn()
          .mockImplementation(({ data, where }) =>
            Promise.resolve({ id: where.id, ...data }),
          ),
      },
      stock: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      movement: {
        create: jest.fn().mockResolvedValue({ id: 'mov-new', code: 'AJU-00042' }),
      },
    };

    prismaMock = {
      inventoryCount: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest
          .fn()
          .mockImplementation(({ data, where }) =>
            Promise.resolve({ id: where.id, ...data }),
          ),
      },
      inventoryCountItem: {
        findUnique: jest.fn(),
        update: jest
          .fn()
          .mockImplementation(({ data, where }) =>
            Promise.resolve({ id: where.id, ...data }),
          ),
      },
      warehouse: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: warehouseId, deletedAt: null, active: true }),
      },
      stock: {
        findMany: jest.fn().mockResolvedValue([
          {
            itemId: 'item-1',
            warehouseId,
            quantity: 100,
            version: 0,
            item: { id: 'item-1' },
          },
          {
            itemId: 'item-2',
            warehouseId,
            quantity: 50,
            version: 0,
            item: { id: 'item-2' },
          },
        ]),
      },
      $transaction: jest.fn().mockImplementation(async (arg: unknown) => {
        if (typeof arg === 'function')
          return (arg as (tx: typeof txMock) => unknown)(txMock);
        return Promise.all(arg as Promise<unknown>[]);
      }),
    };

    realtimeMock = {
      emitToWarehouse: jest.fn(),
      emitToRole: jest.fn(),
      emitToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryCountsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compile();

    service = module.get<InventoryCountsService>(InventoryCountsService);
  });

  describe('create', () => {
    it('snapshotea los stocks del almacén como líneas del conteo', async () => {
      await service.create({ warehouseId, notes: 'conteo mensual' }, userId);

      expect(prismaMock.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ warehouseId }) }),
      );
      const createCall = txMock.inventoryCount.create.mock.calls[0][0];
      expect(createCall.data.code).toBe('INV-00001');
      expect(createCall.data.warehouseId).toBe(warehouseId);
      expect(createCall.data.startedById).toBe(userId);
      expect(createCall.data.items.create).toHaveLength(2);
      expect(createCall.data.items.create[0]).toMatchObject({
        itemId: 'item-1',
        expectedQty: 100,
      });
    });

    it('rechaza si ya hay conteo IN_PROGRESS para el almacén', async () => {
      prismaMock.inventoryCount.findFirst.mockResolvedValueOnce({
        id: 'existing',
        code: 'INV-00005',
      });
      await expect(service.create({ warehouseId }, userId)).rejects.toMatchObject({
        errorCode: 'DUPLICATE_RESOURCE',
      });
    });

    it('rechaza si el almacén no existe', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.create({ warehouseId: 'missing' }, userId),
      ).rejects.toMatchObject({
        errorCode: 'WAREHOUSE_NOT_FOUND',
      });
    });
  });

  describe('updateItem', () => {
    it('calcula variance = counted - expected y guarda', async () => {
      prismaMock.inventoryCount.findUnique.mockResolvedValueOnce({
        id: 'count-1',
        status: InventoryCountStatus.IN_PROGRESS,
      });
      prismaMock.inventoryCountItem.findUnique.mockResolvedValueOnce({
        id: 'line-1',
        expectedQty: 100,
      });

      await service.updateItem('count-1', 'item-1', { countedQty: 95 });

      expect(prismaMock.inventoryCountItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ countedQty: 95, variance: -5 }),
        }),
      );
    });

    it('rechaza si el conteo no está IN_PROGRESS', async () => {
      prismaMock.inventoryCount.findUnique.mockResolvedValueOnce({
        id: 'count-1',
        status: InventoryCountStatus.CLOSED,
      });

      await expect(
        service.updateItem('count-1', 'item-1', { countedQty: 10 }),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });
  });

  describe('close', () => {
    it('genera un Movement AJUSTE source=INVENTARIO con solo las líneas con variance', async () => {
      prismaMock.inventoryCount.findUnique.mockResolvedValueOnce({
        id: 'count-1',
        code: 'INV-00001',
        status: InventoryCountStatus.IN_PROGRESS,
        warehouseId,
        items: [
          { id: 'l-1', itemId: 'item-1', expectedQty: 100, countedQty: 95 },
          { id: 'l-2', itemId: 'item-2', expectedQty: 50, countedQty: 50 }, // igual → no genera ajuste
          { id: 'l-3', itemId: 'item-3', expectedQty: 30, countedQty: null }, // no contado → skip
        ],
        notes: null,
      });

      txMock.stock.findUnique.mockResolvedValueOnce({ quantity: 100, version: 0 });

      const result = await service.close('count-1', {}, userId);

      expect(txMock.movement.create).toHaveBeenCalledTimes(1);
      const movCall = txMock.movement.create.mock.calls[0][0];
      expect(movCall.data.type).toBe(MovementType.AJUSTE);
      expect(movCall.data.source).toBe(MovementSource.INVENTARIO);
      expect(movCall.data.items.create).toHaveLength(1);
      expect(movCall.data.items.create[0]).toMatchObject({
        itemId: 'item-1',
        quantity: 95,
        stockBefore: 100,
        stockAfter: 95,
      });
      expect(txMock.stock.updateMany).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(InventoryCountStatus.CLOSED);

      // Emite WS events cuando hay ajuste
      expect(realtimeMock.emitToWarehouse).toHaveBeenCalledWith(
        warehouseId,
        'inventory_count.closed',
        expect.objectContaining({ linesAdjusted: 1 }),
      );
      expect(realtimeMock.emitToWarehouse).toHaveBeenCalledWith(
        warehouseId,
        'stock.changed',
        expect.objectContaining({ itemIds: ['item-1'] }),
      );
    });

    it('no crea Movement si todas las líneas cuadran', async () => {
      prismaMock.inventoryCount.findUnique.mockResolvedValueOnce({
        id: 'count-1',
        status: InventoryCountStatus.IN_PROGRESS,
        warehouseId,
        items: [{ id: 'l-1', itemId: 'item-1', expectedQty: 100, countedQty: 100 }],
        notes: null,
      });

      await service.close('count-1', {}, userId);

      expect(txMock.movement.create).not.toHaveBeenCalled();
      expect(txMock.stock.updateMany).not.toHaveBeenCalled();
      expect(txMock.inventoryCount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: InventoryCountStatus.CLOSED,
            adjustmentMovementId: null,
          }),
        }),
      );
    });

    it('detecta conflicto si el stock cambió desde el snapshot (STOCK_CONFLICT)', async () => {
      prismaMock.inventoryCount.findUnique.mockResolvedValueOnce({
        id: 'count-1',
        status: InventoryCountStatus.IN_PROGRESS,
        warehouseId,
        items: [{ id: 'l-1', itemId: 'item-1', expectedQty: 100, countedQty: 95 }],
        notes: null,
      });
      // El stock ahora es 110 en vez de los 100 que esperábamos
      txMock.stock.findUnique.mockResolvedValueOnce({ quantity: 110, version: 1 });

      await expect(service.close('count-1', {}, userId)).rejects.toMatchObject({
        errorCode: 'STOCK_CONFLICT',
      });
    });

    it('rechaza si el conteo no está IN_PROGRESS', async () => {
      prismaMock.inventoryCount.findUnique.mockResolvedValueOnce({
        id: 'count-1',
        status: InventoryCountStatus.CLOSED,
        items: [],
      });

      await expect(service.close('count-1', {}, userId)).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });
  });

  describe('cancel', () => {
    it('marca CANCELLED sin tocar stock y emite WS', async () => {
      prismaMock.inventoryCount.findUnique.mockResolvedValueOnce({
        id: 'count-1',
        code: 'INV-00001',
        warehouseId,
        status: InventoryCountStatus.IN_PROGRESS,
        notes: null,
      });

      const result = await service.cancel('count-1', { reason: 'duplicado' }, userId);

      expect(result.status).toBe(InventoryCountStatus.CANCELLED);
      expect(txMock.stock.updateMany).not.toHaveBeenCalled();
      expect(txMock.movement.create).not.toHaveBeenCalled();
      expect(realtimeMock.emitToWarehouse).toHaveBeenCalledWith(
        warehouseId,
        'inventory_count.cancelled',
        expect.objectContaining({ code: 'INV-00001' }),
      );
    });

    it('rechaza cancelar si no está IN_PROGRESS', async () => {
      prismaMock.inventoryCount.findUnique.mockResolvedValueOnce({
        id: 'count-1',
        status: InventoryCountStatus.CLOSED,
      });

      await expect(service.cancel('count-1', {}, userId)).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });
  });
});
