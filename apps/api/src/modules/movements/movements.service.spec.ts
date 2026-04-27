import { Test, TestingModule } from '@nestjs/testing';
import { MovementSource, MovementType, WarehouseType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { MovementsService } from './movements.service';
import type { CreateMovementDto } from './dto/movement.dto';

// ─── Prisma mock: solo los métodos que usa el servicio ─────────────────────────

interface MockStock {
  itemId: string;
  warehouseId: string;
  quantity: number;
  version: number;
}

function buildTxMock(state: {
  stocks: MockStock[];
  alerts: any[];
  updateCountOverride?: number;
}) {
  return {
    movementSequence: {
      upsert: jest
        .fn()
        .mockImplementation(({ create }) =>
          Promise.resolve({ lastValue: 1, type: create.type }),
        ),
    },
    stock: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = state.stocks.find(
          (s) =>
            s.itemId === where.itemId_warehouseId.itemId &&
            s.warehouseId === where.itemId_warehouseId.warehouseId,
        );
        return Promise.resolve(found ?? null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        state.stocks.push({
          itemId: data.itemId,
          warehouseId: data.warehouseId,
          quantity: 0,
          version: 0,
        });
        return Promise.resolve({ ...data, version: 0 });
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }) => {
        if (state.updateCountOverride !== undefined)
          return Promise.resolve({ count: state.updateCountOverride });
        const target = state.stocks.find(
          (s) =>
            s.itemId === where.itemId &&
            s.warehouseId === where.warehouseId &&
            s.version === where.version,
        );
        if (!target) return Promise.resolve({ count: 0 });
        target.quantity = data.quantity;
        target.version += 1;
        return Promise.resolve({ count: 1 });
      }),
    },
    item: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'item-1', code: 'COD-1', name: 'Item Test' }),
    },
    movement: {
      create: jest.fn().mockImplementation(({ data, include }) =>
        Promise.resolve({
          id: 'mov-1',
          code: data.code,
          type: data.type,
          source: data.source,
          warehouseId: data.warehouseId,
          items: data.items.create,
          include,
        }),
      ),
    },
  };
}

describe('MovementsService', () => {
  let service: MovementsService;
  let state: { stocks: MockStock[]; alerts: any[]; updateCountOverride?: number };
  let tx: ReturnType<typeof buildTxMock>;
  let prismaMock: any;
  let realtimeMock: {
    emitToWarehouse: jest.Mock;
    emitToRole: jest.Mock;
    emitToUser: jest.Mock;
    emitToAll: jest.Mock;
  };

  beforeEach(async () => {
    state = { stocks: [], alerts: [] };
    tx = buildTxMock(state);

    prismaMock = {
      // assertWarehouseScope llama user.findUnique — default: ADMIN (sin restricción)
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: { name: 'ADMIN' } }),
      },
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'wh-1',
          type: WarehouseType.CENTRAL,
          active: true,
          deletedAt: null,
        }),
      },
      item: {
        findFirst: jest.fn().mockResolvedValue({ id: 'item-1', deletedAt: null }),
      },
      stock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      alert: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => {
          const alert = {
            id: `alert-${state.alerts.length + 1}`,
            ...data,
            item: { code: 'C', name: 'N', unit: { abbreviation: 'u' } },
          };
          state.alerts.push(alert);
          return Promise.resolve(alert);
        }),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => Promise<unknown>) => cb(tx)),
    };

    realtimeMock = {
      emitToWarehouse: jest.fn(),
      emitToRole: jest.fn(),
      emitToUser: jest.fn(),
      emitToAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compile();

    service = module.get<MovementsService>(MovementsService);
  });

  const baseDto = (overrides: Partial<CreateMovementDto> = {}): CreateMovementDto => ({
    type: MovementType.ENTRADA,
    source: MovementSource.COMPRA,
    warehouseId: 'wh-1',
    items: [{ itemId: 'item-1', quantity: 10 }],
    ...overrides,
  });

  describe('create — ENTRADA', () => {
    it('increments stock when record already exists', async () => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 5,
        version: 0,
      });
      await service.create(
        baseDto({ items: [{ itemId: 'item-1', quantity: 10 }] }),
        'user-1',
      );
      expect(state.stocks[0]).toMatchObject({ quantity: 15, version: 1 });
    });

    it('auto-creates stock record when missing then sets quantity', async () => {
      await service.create(
        baseDto({ items: [{ itemId: 'item-1', quantity: 7 }] }),
        'user-1',
      );
      expect(tx.stock.create).toHaveBeenCalledWith({
        data: { itemId: 'item-1', warehouseId: 'wh-1', quantity: 0 },
      });
      expect(state.stocks[0]).toMatchObject({ quantity: 7, version: 1 });
    });

    it('generates sequential code with ENT- prefix and zero-pads to 5', async () => {
      const result = await service.create(baseDto(), 'user-1');
      expect((result as { code: string }).code).toBe('ENT-00001');
    });

    it('emits STOCK_CHANGED via Realtime to the warehouse', async () => {
      await service.create(baseDto(), 'user-1');
      expect(realtimeMock.emitToWarehouse).toHaveBeenCalledWith(
        'wh-1',
        'stock.changed',
        expect.objectContaining({ warehouseId: 'wh-1', type: MovementType.ENTRADA }),
      );
    });
  });

  describe('create — SALIDA', () => {
    it('decrements stock when sufficient', async () => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 50,
        version: 0,
      });
      await service.create(
        baseDto({
          type: MovementType.SALIDA,
          source: MovementSource.CONSUMO,
          items: [{ itemId: 'item-1', quantity: 30 }],
        }),
        'user-1',
      );
      expect(state.stocks[0]).toMatchObject({ quantity: 20, version: 1 });
    });

    it('throws STOCK_INSUFFICIENT when qty exceeds available', async () => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 5,
        version: 0,
      });
      await expect(
        service.create(
          baseDto({
            type: MovementType.SALIDA,
            source: MovementSource.CONSUMO,
            items: [{ itemId: 'item-1', quantity: 100 }],
          }),
          'user-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'STOCK_INSUFFICIENT' });
      // Stock no se modifica
      expect(state.stocks[0]).toMatchObject({ quantity: 5, version: 0 });
    });

    it('throws STOCK_INSUFFICIENT when no stock record exists', async () => {
      await expect(
        service.create(
          baseDto({
            type: MovementType.SALIDA,
            source: MovementSource.CONSUMO,
            items: [{ itemId: 'item-1', quantity: 1 }],
          }),
          'user-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'STOCK_INSUFFICIENT' });
    });
  });

  describe('create — AJUSTE', () => {
    it('sets absolute quantity (not delta)', async () => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 100,
        version: 3,
      });
      await service.create(
        baseDto({
          type: MovementType.AJUSTE,
          source: MovementSource.AJUSTE,
          items: [{ itemId: 'item-1', quantity: 42 }],
        }),
        'user-1',
      );
      expect(state.stocks[0]).toMatchObject({ quantity: 42, version: 4 });
    });

    it('rejects negative quantity with NEGATIVE_QUANTITY_NOT_ALLOWED', async () => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 10,
        version: 0,
      });
      await expect(
        service.create(
          baseDto({
            type: MovementType.AJUSTE,
            source: MovementSource.AJUSTE,
            items: [{ itemId: 'item-1', quantity: -5 }],
          }),
          'user-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'NEGATIVE_QUANTITY_NOT_ALLOWED' });
    });

    it('uses AJU- prefix in code', async () => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 10,
        version: 0,
      });
      const result = await service.create(
        baseDto({
          type: MovementType.AJUSTE,
          source: MovementSource.AJUSTE,
          items: [{ itemId: 'item-1', quantity: 5 }],
        }),
        'user-1',
      );
      expect((result as { code: string }).code).toBe('AJU-00001');
    });
  });

  describe('optimistic locking', () => {
    it('throws STOCK_CONFLICT when updateMany returns count=0 (version mismatch)', async () => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 10,
        version: 0,
      });
      state.updateCountOverride = 0; // Simula que otro update ganó la carrera
      await expect(service.create(baseDto(), 'user-1')).rejects.toMatchObject({
        errorCode: 'STOCK_CONFLICT',
      });
    });

    it('passes the correct version in updateMany WHERE clause', async () => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 10,
        version: 5,
      });
      await service.create(baseDto(), 'user-1');
      expect(tx.stock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ version: 5 }) }),
      );
    });

    it('increments version atomically in the update payload', async () => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 10,
        version: 0,
      });
      await service.create(baseDto(), 'user-1');
      expect(tx.stock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: { increment: 1 } }),
        }),
      );
    });
  });

  describe('pre-transaction validations', () => {
    it('rejects when warehouse does not exist', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce(null);
      await expect(service.create(baseDto(), 'user-1')).rejects.toMatchObject({
        errorCode: 'WAREHOUSE_NOT_FOUND',
      });
    });

    it('rejects when any item does not exist', async () => {
      prismaMock.item.findFirst.mockResolvedValueOnce(null);
      await expect(service.create(baseDto(), 'user-1')).rejects.toMatchObject({
        errorCode: 'ITEM_NOT_FOUND',
      });
    });

    it('rejects ENTRADA a un almacén tipo OBRA (solo Principal)', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce({
        id: 'wh-obra',
        type: WarehouseType.OBRA,
        obraId: 'obra-1',
        active: true,
        deletedAt: null,
      });
      await expect(
        service.create(
          baseDto({ type: MovementType.ENTRADA, source: MovementSource.COMPRA }),
          'user-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });

    it('permite SALIDA desde almacén OBRA (consumo en obra)', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce({
        id: 'wh-obra',
        type: WarehouseType.OBRA,
        obraId: 'obra-1',
        active: true,
        deletedAt: null,
      });
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-obra',
        quantity: 50,
        version: 0,
      });
      await expect(
        service.create(
          baseDto({
            type: MovementType.SALIDA,
            source: MovementSource.CONSUMO,
            warehouseId: 'wh-obra',
            items: [{ itemId: 'item-1', quantity: 5 }],
          }),
          'user-1',
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('alerts (checkAlerts)', () => {
    it('creates STOCK_CRITICO alert when quantity reaches 0 after SALIDA', async () => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 3,
        version: 0,
      });
      prismaMock.stock.findMany.mockResolvedValueOnce([
        {
          itemId: 'item-1',
          warehouseId: 'wh-1',
          quantity: 0,
          item: { id: 'item-1', code: 'C1', name: 'Item', minStock: 5 },
        },
      ]);
      await service.create(
        baseDto({
          type: MovementType.SALIDA,
          source: MovementSource.CONSUMO,
          items: [{ itemId: 'item-1', quantity: 3 }],
        }),
        'user-1',
      );
      // checkAlerts es fire-and-forget → esperamos un tick
      await new Promise((r) => setImmediate(r));
      expect(prismaMock.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'STOCK_CRITICO', itemId: 'item-1' }),
        }),
      );
    });

    it('skips alert when minStock is 0', async () => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 5,
        version: 0,
      });
      prismaMock.stock.findMany.mockResolvedValueOnce([
        {
          itemId: 'item-1',
          warehouseId: 'wh-1',
          quantity: 0,
          item: { id: 'item-1', code: 'C1', name: 'Item', minStock: 0 },
        },
      ]);
      await service.create(
        baseDto({
          type: MovementType.SALIDA,
          source: MovementSource.CONSUMO,
          items: [{ itemId: 'item-1', quantity: 5 }],
        }),
        'user-1',
      );
      await new Promise((r) => setImmediate(r));
      expect(prismaMock.alert.create).not.toHaveBeenCalled();
    });

    it('skips alert when an unread alert of same type already exists', async () => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 10,
        version: 0,
      });
      prismaMock.stock.findMany.mockResolvedValueOnce([
        {
          itemId: 'item-1',
          warehouseId: 'wh-1',
          quantity: 3,
          item: { id: 'item-1', code: 'C1', name: 'Item', minStock: 5 },
        },
      ]);
      prismaMock.alert.findFirst.mockResolvedValueOnce({ id: 'existing-alert' });
      await service.create(
        baseDto({
          type: MovementType.SALIDA,
          source: MovementSource.CONSUMO,
          items: [{ itemId: 'item-1', quantity: 7 }],
        }),
        'user-1',
      );
      await new Promise((r) => setImmediate(r));
      expect(prismaMock.alert.create).not.toHaveBeenCalled();
    });

    it('alert errors never break the main movement flow', async () => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 10,
        version: 0,
      });
      prismaMock.stock.findMany.mockRejectedValueOnce(new Error('DB exploded'));
      await expect(
        service.create(
          baseDto({
            type: MovementType.SALIDA,
            source: MovementSource.CONSUMO,
            items: [{ itemId: 'item-1', quantity: 3 }],
          }),
          'user-1',
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('multi-item movement', () => {
    it('processes all items atomically within the same movement', async () => {
      state.stocks.push(
        { itemId: 'item-1', warehouseId: 'wh-1', quantity: 0, version: 0 },
        { itemId: 'item-2', warehouseId: 'wh-1', quantity: 0, version: 0 },
      );
      prismaMock.item.findFirst
        .mockResolvedValueOnce({ id: 'item-1', deletedAt: null })
        .mockResolvedValueOnce({ id: 'item-2', deletedAt: null });

      await service.create(
        baseDto({
          items: [
            { itemId: 'item-1', quantity: 10 },
            { itemId: 'item-2', quantity: 20 },
          ],
        }),
        'user-1',
      );
      expect(state.stocks.find((s) => s.itemId === 'item-1')?.quantity).toBe(10);
      expect(state.stocks.find((s) => s.itemId === 'item-2')?.quantity).toBe(20);
      expect(tx.movement.create).toHaveBeenCalledTimes(1);
    });
  });
});
