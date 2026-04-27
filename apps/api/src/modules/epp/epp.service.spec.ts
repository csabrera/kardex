import { Test, TestingModule } from '@nestjs/testing';
import { ItemType, WarehouseType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { EPPService } from './epp.service';

describe('EPPService', () => {
  let service: EPPService;
  let prismaMock: any;
  let realtimeMock: any;
  let stockState: { quantity: number; version: number };
  let movementSeq: number;
  let eppSeq: number;

  beforeEach(async () => {
    stockState = { quantity: 100, version: 0 };
    movementSeq = 0;
    eppSeq = 0;

    const eppItem = {
      id: 'item-epp-1',
      code: 'EPP-CASCO',
      name: 'Casco de seguridad',
      type: ItemType.EPP,
      active: true,
      deletedAt: null,
    };

    const tx = {
      stock: {
        findUnique: jest.fn(() => Promise.resolve(stockState)),
        updateMany: jest.fn(({ where, data }: any) => {
          if (where.version !== stockState.version) {
            return Promise.resolve({ count: 0 });
          }
          stockState = {
            quantity: data.quantity,
            version: stockState.version + 1,
          };
          return Promise.resolve({ count: 1 });
        }),
      },
      movementSequence: {
        upsert: jest.fn(() => Promise.resolve({ lastValue: ++movementSeq })),
      },
      ePPSequence: {
        upsert: jest.fn(() => Promise.resolve({ lastValue: ++eppSeq })),
      },
      movement: {
        create: jest.fn(({ data }: any) =>
          Promise.resolve({
            id: `mov-${movementSeq}`,
            code: data.code,
            type: data.type,
          }),
        ),
      },
      ePPAssignment: {
        create: jest.fn(({ data }: any) =>
          Promise.resolve({
            id: `epp-${eppSeq}`,
            code: data.code,
            workerId: data.workerId,
            itemId: data.itemId,
            warehouseId: data.warehouseId,
            quantity: data.quantity,
            assignedById: data.assignedById,
            replacesId: data.replacesId ?? null,
            replacementReason: data.replacementReason ?? null,
            movementId: data.movementId,
            notes: data.notes,
            assignedAt: new Date(),
          }),
        ),
      },
    };

    prismaMock = {
      // assertWarehouseScope llama user.findUnique — default: ADMIN (sin restricción)
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: { name: 'ADMIN' } }),
      },
      item: {
        findFirst: jest.fn().mockResolvedValue(eppItem),
      },
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'wh-obra-1',
          type: WarehouseType.OBRA,
          obraId: 'obra-1',
          active: true,
          deletedAt: null,
        }),
      },
      worker: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'w-1',
          obraId: 'obra-1',
          active: true,
          deletedAt: null,
        }),
      },
      stock: {
        findUnique: jest.fn(() => Promise.resolve(stockState)),
        findMany: jest.fn().mockResolvedValue([]),
      },
      alert: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      ePPAssignment: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };

    realtimeMock = {
      emitToWarehouse: jest.fn(),
      emitToRole: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EPPService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compile();

    service = module.get<EPPService>(EPPService);
  });

  const baseDto = (overrides: any = {}) => ({
    workerId: 'w-1',
    itemId: 'item-epp-1',
    warehouseId: 'wh-obra-1',
    quantity: 1,
    ...overrides,
  });

  describe('assign - validaciones', () => {
    it('rechaza ítem que no existe', async () => {
      prismaMock.item.findFirst.mockResolvedValueOnce(null);
      await expect(service.assign(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'ITEM_NOT_FOUND',
      });
    });

    it('rechaza ítem que no es tipo EPP', async () => {
      prismaMock.item.findFirst.mockResolvedValueOnce({
        id: 'item-1',
        type: ItemType.HERRAMIENTA,
        active: true,
        deletedAt: null,
      });
      await expect(service.assign(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });

    it('rechaza almacén de tipo CENTRAL (Principal)', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce({
        id: 'wh-central',
        type: WarehouseType.CENTRAL,
        obraId: null,
        active: true,
        deletedAt: null,
      });
      await expect(service.assign(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });

    it('rechaza empleado asignado a otra obra', async () => {
      prismaMock.worker.findFirst.mockResolvedValueOnce({
        id: 'w-1',
        obraId: 'obra-distinta',
        active: true,
        deletedAt: null,
      });
      await expect(service.assign(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });

    it('rechaza empleado no existente o inactivo', async () => {
      prismaMock.worker.findFirst.mockResolvedValueOnce(null);
      await expect(service.assign(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'WORKER_NOT_FOUND',
      });
    });

    it('rechaza stock insuficiente', async () => {
      prismaMock.stock.findUnique.mockResolvedValueOnce({ quantity: 0, version: 0 });
      await expect(service.assign(baseDto({ quantity: 5 }), 'u-1')).rejects.toMatchObject(
        { errorCode: 'STOCK_INSUFFICIENT' },
      );
    });

    it('acepta empleado sin obra asignada (flexibilidad)', async () => {
      prismaMock.worker.findFirst.mockResolvedValueOnce({
        id: 'w-free',
        obraId: null,
        active: true,
        deletedAt: null,
      });
      const result = await service.assign(baseDto(), 'u-1');
      expect(result.code).toBe('EPP-00001');
    });
  });

  describe('assign - transacción exitosa', () => {
    it('crea asignación con código correlativo EPP-00001 + movimiento SALIDA', async () => {
      const result = await service.assign(baseDto({ quantity: 3 }), 'u-1');

      expect(result.code).toBe('EPP-00001');
      expect(result.workerId).toBe('w-1');
      expect(result.itemId).toBe('item-epp-1');
      expect(Number(result.quantity)).toBe(3);
      expect(result.assignedById).toBe('u-1');

      // Stock descontado
      expect(stockState.quantity).toBe(97);
      expect(stockState.version).toBe(1);

      // Emitió WS STOCK_CHANGED
      expect(realtimeMock.emitToWarehouse).toHaveBeenCalledWith(
        'wh-obra-1',
        expect.any(String),
        expect.objectContaining({
          warehouseId: 'wh-obra-1',
          itemIds: ['item-epp-1'],
        }),
      );
    });

    it('genera códigos correlativos en asignaciones sucesivas', async () => {
      const first = await service.assign(baseDto({ quantity: 1 }), 'u-1');
      const second = await service.assign(baseDto({ quantity: 2 }), 'u-1');

      expect(first.code).toBe('EPP-00001');
      expect(second.code).toBe('EPP-00002');
      expect(stockState.quantity).toBe(97);
    });
  });

  describe('replace', () => {
    it('marca replacesId + replacementReason en la nueva asignación', async () => {
      // Mock original
      prismaMock.ePPAssignment.findUnique.mockResolvedValueOnce({
        id: 'epp-orig',
        code: 'EPP-00001',
        workerId: 'w-1',
        itemId: 'item-epp-1',
        warehouseId: 'wh-obra-1',
        quantity: 1,
        assignedAt: new Date(),
        replacementReason: null,
      });

      const result = await service.replace(
        'epp-orig',
        {
          quantity: 1,
          reason: 'DESGASTE',
          warehouseId: 'wh-obra-1',
          notes: 'Casco roto por golpe',
        },
        'u-1',
      );

      expect(result.replacesId).toBe('epp-orig');
      expect(result.replacementReason).toBe('DESGASTE');
      expect(result.notes).toBe('Casco roto por golpe');
      // La nota del Movement debería mencionar reposición
      // (no podemos leer la nota exacta sin exponer el mock, pero sí el flujo general)
      expect(stockState.quantity).toBe(99);
    });

    it('valida EPP y obra en la reposición igual que en assign', async () => {
      prismaMock.ePPAssignment.findUnique.mockResolvedValueOnce({
        id: 'epp-orig',
        code: 'EPP-00001',
        workerId: 'w-1',
        itemId: 'item-epp-1',
        warehouseId: 'wh-obra-1',
        quantity: 1,
        assignedAt: new Date(),
        replacementReason: null,
      });
      // Fuerza warehouse CENTRAL en la validación del replace
      prismaMock.warehouse.findFirst.mockResolvedValueOnce({
        id: 'wh-central',
        type: WarehouseType.CENTRAL,
        obraId: null,
        active: true,
        deletedAt: null,
      });

      await expect(
        service.replace(
          'epp-orig',
          {
            quantity: 1,
            reason: 'PERDIDA',
            warehouseId: 'wh-central',
          },
          'u-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });

    it('rechaza reposición de asignación inexistente', async () => {
      prismaMock.ePPAssignment.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.replace(
          'no-existe',
          {
            quantity: 1,
            reason: 'OTRO',
            warehouseId: 'wh-obra-1',
          },
          'u-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'NOT_FOUND' });
    });
  });

  describe('concurrencia', () => {
    it('lanza STOCK_CONFLICT cuando el version del stock cambió mid-transaction', async () => {
      // Simular que otro proceso actualizó version entre findUnique y updateMany
      // Hacemos que stockState.version sea distinto al leído por el primer findUnique
      // El mock guarda stockState y el updateMany compara con el que pasó, así que
      // forzamos una mutación después del findUnique inicial mediante el mock de $transaction.
      prismaMock.$transaction.mockImplementationOnce(async (cb: any) => {
        const localTx = {
          stock: {
            findUnique: jest.fn().mockResolvedValue({ quantity: 100, version: 0 }),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }), // conflicto
          },
          movementSequence: { upsert: jest.fn() },
          ePPSequence: { upsert: jest.fn() },
          movement: { create: jest.fn() },
          ePPAssignment: { create: jest.fn() },
        };
        return cb(localTx);
      });

      await expect(service.assign(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'STOCK_CONFLICT',
      });
    });
  });
});
