import { Test, TestingModule } from '@nestjs/testing';
import { EquipmentStatus, ItemType, WarehouseType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { FuelService } from './fuel.service';

describe('FuelService', () => {
  let service: FuelService;
  let prismaMock: any;
  let realtimeMock: any;
  let stockState: { quantity: number; version: number };
  let equipmentState: any;
  let movementSeq: number;
  let fuelSeq: number;

  beforeEach(async () => {
    stockState = { quantity: 100, version: 0 };
    equipmentState = {
      id: 'eq-1',
      code: 'EQP-CAT',
      status: EquipmentStatus.OPERATIVO,
      currentCount: 500,
      deletedAt: null,
    };
    movementSeq = 0;
    fuelSeq = 0;

    const tx = {
      stock: {
        findUnique: jest.fn(() => Promise.resolve(stockState)),
        updateMany: jest.fn(({ where, data }: any) => {
          if (where.version !== stockState.version) {
            return Promise.resolve({ count: 0 });
          }
          stockState = { quantity: data.quantity, version: stockState.version + 1 };
          return Promise.resolve({ count: 1 });
        }),
      },
      movementSequence: {
        upsert: jest.fn(() => Promise.resolve({ lastValue: ++movementSeq })),
      },
      fuelDispatchSequence: {
        upsert: jest.fn(() => Promise.resolve({ lastValue: ++fuelSeq })),
      },
      movement: {
        create: jest.fn(({ data }: any) =>
          Promise.resolve({ id: `mov-${movementSeq}`, code: data.code }),
        ),
      },
      equipment: {
        update: jest.fn(({ data }: any) => {
          Object.assign(equipmentState, data);
          return Promise.resolve(equipmentState);
        }),
      },
      equipmentCountReading: {
        create: jest.fn(({ data }: any) => Promise.resolve({ id: 'cr-1', ...data })),
      },
      fuelDispatch: {
        create: jest.fn(({ data }: any) =>
          Promise.resolve({
            id: `fuel-${fuelSeq}`,
            code: data.code,
            equipmentId: data.equipmentId,
            itemId: data.itemId,
            warehouseId: data.warehouseId,
            quantity: data.quantity,
            countReading: data.countReading,
            movementId: data.movementId,
          }),
        ),
      },
    };

    prismaMock = {
      equipment: {
        findFirst: jest.fn(() => Promise.resolve(equipmentState)),
      },
      item: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'item-diesel',
          name: 'Diésel B5',
          type: ItemType.COMBUSTIBLE,
          active: true,
          deletedAt: null,
        }),
      },
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'wh-1',
          type: WarehouseType.OBRA,
          active: true,
          deletedAt: null,
        }),
      },
      worker: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'w-1',
          active: true,
          deletedAt: null,
        }),
      },
      stock: {
        findUnique: jest.fn(() => Promise.resolve(stockState)),
      },
      fuelDispatch: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };

    realtimeMock = { emitToWarehouse: jest.fn(), emitToRole: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FuelService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compile();

    service = module.get<FuelService>(FuelService);
  });

  const baseDto = (overrides: any = {}) => ({
    equipmentId: 'eq-1',
    itemId: 'item-diesel',
    warehouseId: 'wh-1',
    quantity: 10,
    countReading: 520,
    ...overrides,
  });

  describe('dispatch - validaciones', () => {
    it('rechaza equipo inexistente', async () => {
      prismaMock.equipment.findFirst.mockResolvedValueOnce(null);
      await expect(service.dispatch(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'NOT_FOUND',
      });
    });

    it('rechaza despacho a equipo en BAJA', async () => {
      equipmentState.status = EquipmentStatus.BAJA;
      await expect(service.dispatch(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });

    it('rechaza ítem que no es COMBUSTIBLE', async () => {
      prismaMock.item.findFirst.mockResolvedValueOnce({
        id: 'item-x',
        type: ItemType.MATERIAL,
        active: true,
        deletedAt: null,
      });
      await expect(service.dispatch(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });

    it('rechaza lectura menor al valor actual del equipo', async () => {
      await expect(
        service.dispatch(baseDto({ countReading: 400 }), 'u-1'),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });

    it('rechaza stock insuficiente', async () => {
      prismaMock.stock.findUnique.mockResolvedValueOnce({ quantity: 5, version: 0 });
      await expect(
        service.dispatch(baseDto({ quantity: 100 }), 'u-1'),
      ).rejects.toMatchObject({ errorCode: 'STOCK_INSUFFICIENT' });
    });

    it('rechaza operador inexistente si se provee', async () => {
      prismaMock.worker.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.dispatch(baseDto({ operatorWorkerId: 'w-fantasma' }), 'u-1'),
      ).rejects.toMatchObject({ errorCode: 'WORKER_NOT_FOUND' });
    });
  });

  describe('dispatch - transacción exitosa', () => {
    it('despacha + crea movement + actualiza equipment.currentCount + emite WS', async () => {
      const result = await service.dispatch(
        baseDto({ quantity: 30, countReading: 550 }),
        'u-1',
      );

      expect(result.code).toBe('COMB-00001');
      expect(Number(result.quantity)).toBe(30);
      expect(Number(result.countReading)).toBe(550);

      // Stock descontado
      expect(stockState.quantity).toBe(70);

      // Equipment actualizado
      expect(Number(equipmentState.currentCount)).toBe(550);

      // WS emitido
      expect(realtimeMock.emitToWarehouse).toHaveBeenCalledWith(
        'wh-1',
        expect.any(String),
        expect.objectContaining({
          warehouseId: 'wh-1',
          itemIds: ['item-diesel'],
        }),
      );
    });

    it('acepta lectura igual al valor actual del equipo', async () => {
      const result = await service.dispatch(
        baseDto({ countReading: 500, quantity: 5 }),
        'u-1',
      );
      expect(Number(result.countReading)).toBe(500);
    });

    it('genera códigos correlativos COMB-00001, COMB-00002', async () => {
      const first = await service.dispatch(baseDto({ quantity: 5 }), 'u-1');
      const second = await service.dispatch(
        baseDto({ quantity: 5, countReading: 540 }),
        'u-1',
      );
      expect(first.code).toBe('COMB-00001');
      expect(second.code).toBe('COMB-00002');
    });
  });
});
