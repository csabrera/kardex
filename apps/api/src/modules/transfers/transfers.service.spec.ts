import { Test, TestingModule } from '@nestjs/testing';
import { TransferItemStatus, TransferStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { TransfersService } from './transfers.service';

interface MockStock {
  itemId: string;
  warehouseId: string;
  quantity: number;
  version: number;
}

function buildTransfer(overrides: Partial<any> = {}) {
  return {
    id: 't-1',
    code: 'TRF-00001',
    status: TransferStatus.EN_TRANSITO,
    fromWarehouseId: 'wh-from',
    toWarehouseId: 'wh-to',
    fromWarehouse: { id: 'wh-from', name: 'Origen' },
    toWarehouse: { id: 'wh-to', name: 'Destino' },
    items: [
      {
        id: 'ti-1',
        itemId: 'item-1',
        requestedQty: 10,
        sentQty: 10,
        receivedQty: null,
        status: TransferItemStatus.PENDIENTE,
        item: { id: 'item-1', name: 'Item Test' },
      },
    ],
    ...overrides,
  };
}

describe('TransfersService', () => {
  let service: TransfersService;
  let state: { stocks: MockStock[]; transfer: any };
  let prismaMock: any;
  let realtimeMock: {
    emitToWarehouse: jest.Mock;
    emitToRole: jest.Mock;
    emitToUser: jest.Mock;
    emitToAll: jest.Mock;
  };

  beforeEach(async () => {
    state = { stocks: [], transfer: buildTransfer() };

    const txMock = {
      transfer: {
        create: jest.fn().mockImplementation(({ data }) => {
          state.transfer = buildTransfer({
            ...data,
            items: data.items.create.map((i: any, idx: number) => ({
              id: `ti-new-${idx}`,
              itemId: i.itemId,
              requestedQty: i.requestedQty,
              sentQty: i.sentQty ?? null,
              receivedQty: null,
            })),
          });
          return Promise.resolve(state.transfer);
        }),
        update: jest.fn().mockImplementation(({ data }) => {
          state.transfer = { ...state.transfer, ...data };
          return Promise.resolve(state.transfer);
        }),
      },
      transferSequence: {
        upsert: jest.fn().mockResolvedValue({ lastValue: 1 }),
      },
      transferItem: {
        update: jest.fn().mockImplementation(({ where, data }) => {
          const item = state.transfer.items.find((i: any) => i.id === where.id);
          if (item) Object.assign(item, data);
          return Promise.resolve(item);
        }),
        findMany: jest.fn().mockImplementation(() =>
          Promise.resolve(
            state.transfer.items.map((i: any) => ({
              status: i.status ?? TransferItemStatus.PENDIENTE,
            })),
          ),
        ),
      },
      movementSequence: {
        upsert: jest.fn().mockResolvedValue({ lastValue: 1 }),
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
          return Promise.resolve(data);
        }),
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
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
        findUnique: jest.fn().mockResolvedValue({ name: 'Item Test' }),
      },
      movement: {
        create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
      },
      alert: {
        create: jest.fn().mockResolvedValue({ id: 'alert-1' }),
      },
    };

    prismaMock = {
      transfer: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(state.transfer)),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => {
          state.transfer = buildTransfer({
            ...data,
            items: data.items.create.map((i: any, idx: number) => ({
              id: `ti-new-${idx}`,
              itemId: i.itemId,
              requestedQty: i.requestedQty,
              sentQty: null,
              receivedQty: null,
            })),
          });
          return Promise.resolve(state.transfer);
        }),
        update: jest.fn().mockImplementation(({ data }) => {
          state.transfer = { ...state.transfer, ...data };
          return Promise.resolve(state.transfer);
        }),
      },
      transferSequence: {
        upsert: jest.fn().mockResolvedValue({ lastValue: 1 }),
      },
      warehouse: {
        findFirst: jest
          .fn()
          .mockImplementation(({ where }) =>
            Promise.resolve({ id: where.id, name: `WH-${where.id}`, deletedAt: null }),
          ),
        findUnique: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve({
            id: where.id,
            name: `WH-${where.id}`,
            obra: { id: 'obra-1', responsibleUserId: 'resident-1' },
          }),
        ),
      },
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve({
            id: where.id,
            role: { name: where.id === 'resident-1' ? 'RESIDENTE' : 'ALMACENERO' },
          }),
        ),
      },
      // assertOverrideReasonIfNeeded query obra cuando user es RESIDENTE.
      // Por default 'resident-1' es responsable de obra-1.
      obra: {
        findUnique: jest.fn().mockResolvedValue({ responsibleUserId: 'resident-1' }),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => Promise<unknown>) => cb(txMock)),
    };

    realtimeMock = {
      emitToWarehouse: jest.fn(),
      emitToRole: jest.fn(),
      emitToUser: jest.fn(),
      emitToAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compile();

    service = module.get<TransfersService>(TransfersService);
  });

  describe('create (flujo 2-pasos — envía directo a EN_TRANSITO)', () => {
    beforeEach(() => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-from',
        quantity: 50,
        version: 0,
      });
    });

    it('rejects when from === to warehouse', async () => {
      await expect(
        service.create(
          { fromWarehouseId: 'wh-1', toWarehouseId: 'wh-1', items: [] },
          'user-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'DUPLICATE_RESOURCE' });
    });

    it('rejects when source warehouse not found', async () => {
      prismaMock.warehouse.findFirst.mockImplementationOnce(() => Promise.resolve(null));
      await expect(
        service.create(
          {
            fromWarehouseId: 'wh-1',
            toWarehouseId: 'wh-2',
            items: [{ itemId: 'i-1', requestedQty: 5 }],
          },
          'user-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'WAREHOUSE_NOT_FOUND' });
    });

    it('genera TRF- code y descuenta stock del origen (directo a EN_TRANSITO)', async () => {
      const result = await service.create(
        {
          fromWarehouseId: 'wh-from',
          toWarehouseId: 'wh-to',
          items: [{ itemId: 'item-1', requestedQty: 10 }],
        },
        'user-1',
      );
      expect((result as any).code).toBe('TRF-00001');
      // Stock del origen descontado inmediatamente
      expect(state.stocks.find((s) => s.warehouseId === 'wh-from')?.quantity).toBe(40);
      // Emite TRANSFER_IN_TRANSIT (no PENDING)
      expect(realtimeMock.emitToWarehouse).toHaveBeenCalledWith(
        'wh-from',
        'transfer.in_transit',
        expect.anything(),
      );
      expect(realtimeMock.emitToWarehouse).toHaveBeenCalledWith(
        'wh-to',
        'transfer.in_transit',
        expect.anything(),
      );
    });

    it('rechaza cuando no hay stock suficiente en el origen', async () => {
      await expect(
        service.create(
          {
            fromWarehouseId: 'wh-from',
            toWarehouseId: 'wh-to',
            items: [{ itemId: 'item-1', requestedQty: 999 }],
          },
          'user-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'STOCK_INSUFFICIENT' });
    });
  });

  describe('receive (EN_TRANSITO → RECIBIDA)', () => {
    beforeEach(() => {
      state.transfer.status = TransferStatus.EN_TRANSITO;
      state.transfer.items[0].sentQty = 10;
    });

    it('increments destination stock with received quantity', async () => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-to',
        quantity: 0,
        version: 0,
      });
      await service.receive(
        't-1',
        { items: [{ transferItemId: 'ti-1', receivedQty: 10 }] },
        'user-1',
      );
      expect(state.stocks.find((s) => s.warehouseId === 'wh-to')?.quantity).toBe(10);
      expect(state.transfer.status).toBe(TransferStatus.RECIBIDA);
    });

    it('auto-creates stock record at destination if missing', async () => {
      await service.receive(
        't-1',
        { items: [{ transferItemId: 'ti-1', receivedQty: 10 }] },
        'user-1',
      );
      expect(state.stocks.find((s) => s.warehouseId === 'wh-to')?.quantity).toBe(10);
    });

    it('handles partial reception (received < sent) → PARCIALMENTE_RECIBIDA', async () => {
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-to',
        quantity: 0,
        version: 0,
      });
      await service.receive(
        't-1',
        { items: [{ transferItemId: 'ti-1', receivedQty: 7 }] },
        'user-1',
      );
      expect(state.stocks.find((s) => s.warehouseId === 'wh-to')?.quantity).toBe(7);
      expect(state.transfer.items[0].receivedQty).toBe(7);
      expect(state.transfer.items[0].status).toBe(TransferItemStatus.RECIBIDO_PARCIAL);
      expect(state.transfer.status).toBe(TransferStatus.PARCIALMENTE_RECIBIDA);
    });

    it('rechaza receivedQty > sentQty', async () => {
      await expect(
        service.receive(
          't-1',
          { items: [{ transferItemId: 'ti-1', receivedQty: 99 }] },
          'user-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });

    it('rejects if not in EN_TRANSITO state', async () => {
      state.transfer.status = TransferStatus.RECIBIDA;
      await expect(
        service.receive(
          't-1',
          { items: [{ transferItemId: 'ti-1', receivedQty: 10 }] },
          'user-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'TRANSFER_INVALID_STATE' });
    });
  });

  describe('reject (desde EN_TRANSITO)', () => {
    it('returns stock to source and marks RECHAZADA', async () => {
      state.transfer.status = TransferStatus.EN_TRANSITO;
      state.transfer.items[0].sentQty = 10;
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-from',
        quantity: 40,
        version: 0,
      });
      await service.reject('t-1', { reason: 'Item dañado' }, 'user-1');
      expect(state.stocks[0].quantity).toBe(50); // 40 + 10 devueltos
      expect(state.transfer.status).toBe(TransferStatus.RECHAZADA);
    });

    it('rejects final states (RECIBIDA, RECHAZADA, CANCELADA)', async () => {
      for (const finalState of [
        TransferStatus.RECIBIDA,
        TransferStatus.RECHAZADA,
        TransferStatus.CANCELADA,
      ]) {
        state.transfer.status = finalState;
        await expect(
          service.reject('t-1', { reason: 'x' }, 'user-1'),
        ).rejects.toMatchObject({
          errorCode: 'TRANSFER_INVALID_STATE',
        });
      }
    });
  });

  describe('cancel (Fase 7A: solo desde EN_TRANSITO, devuelve stock al origen)', () => {
    it('allows cancel from EN_TRANSITO and returns stock to origin', async () => {
      state.transfer.status = TransferStatus.EN_TRANSITO;
      state.transfer.items[0].sentQty = 10;
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-from',
        quantity: 40,
        version: 0,
      });
      await service.cancel('t-1', {}, 'user-1');
      expect(state.transfer.status).toBe(TransferStatus.CANCELADA);
      expect(state.stocks[0].quantity).toBe(50); // devolvió 10 al origen
    });

    it('rejects cancel from RECIBIDA/RECHAZADA/CANCELADA', async () => {
      for (const terminal of [
        TransferStatus.RECIBIDA,
        TransferStatus.RECHAZADA,
        TransferStatus.CANCELADA,
      ]) {
        state.transfer.status = terminal;
        await expect(service.cancel('t-1', {}, 'user-1')).rejects.toMatchObject({
          errorCode: 'TRANSFER_INVALID_STATE',
        });
      }
    });

    it('emits TRANSFER_CANCELLED event', async () => {
      state.transfer.status = TransferStatus.EN_TRANSITO;
      state.transfer.items[0].sentQty = 10;
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-from',
        quantity: 40,
        version: 0,
      });
      await service.cancel('t-1', {}, 'user-1');
      expect(realtimeMock.emitToWarehouse).toHaveBeenCalledWith(
        expect.any(String),
        'transfer.cancelled',
        expect.anything(),
      );
    });
  });

  describe('receive (Fase 7A: solo responsable de la obra + alerta discrepancia)', () => {
    beforeEach(() => {
      state.transfer.status = TransferStatus.EN_TRANSITO;
      state.transfer.items[0].sentQty = 10;
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-to',
        quantity: 0,
        version: 0,
      });
    });

    it('RESIDENTE responsable de la obra puede recibir', async () => {
      await service.receive(
        't-1',
        { items: [{ transferItemId: 'ti-1', receivedQty: 10 }] },
        'resident-1', // el responsable de la obra del warehouse destino
      );
      expect(state.transfer.status).toBe(TransferStatus.RECIBIDA);
      expect(state.stocks[0].quantity).toBe(10);
    });

    it('RESIDENTE NO responsable es rechazado con PERMISSION_DENIED', async () => {
      // Mock para que otroResidente no sea el responsable
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'other-resident',
        role: { name: 'RESIDENTE' },
      });
      await expect(
        service.receive(
          't-1',
          { items: [{ transferItemId: 'ti-1', receivedQty: 10 }] },
          'other-resident',
        ),
      ).rejects.toMatchObject({ errorCode: 'PERMISSION_DENIED' });
    });

    it('ADMIN puede recibir como override SI proporciona overrideReason', async () => {
      // ADMIN aparece dos veces porque el helper hace su propia query del user.
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ id: 'admin-1', role: { name: 'ADMIN' } })
        .mockResolvedValueOnce({ id: 'admin-1', role: { name: 'ADMIN' } });
      await service.receive(
        't-1',
        {
          items: [{ transferItemId: 'ti-1', receivedQty: 10 }],
          overrideReason: 'Residente ausente — recepción urgente',
        },
        'admin-1',
      );
      expect(state.transfer.status).toBe(TransferStatus.RECIBIDA);
    });

    it('ADMIN sin overrideReason es rechazado con INVALID_INPUT', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ id: 'admin-1', role: { name: 'ADMIN' } })
        .mockResolvedValueOnce({ id: 'admin-1', role: { name: 'ADMIN' } });
      await expect(
        service.receive(
          't-1',
          { items: [{ transferItemId: 'ti-1', receivedQty: 10 }] },
          'admin-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });

    it('ALMACENERO puede recibir sin justificación (flujo normal)', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ id: 'alm-1', role: { name: 'ALMACENERO' } })
        .mockResolvedValueOnce({ id: 'alm-1', role: { name: 'ALMACENERO' } });
      await service.receive(
        't-1',
        { items: [{ transferItemId: 'ti-1', receivedQty: 10 }] },
        'alm-1',
      );
      expect(state.transfer.status).toBe(TransferStatus.RECIBIDA);
    });

    it('recepción parcial → TRF en PARCIALMENTE_RECIBIDA, línea en RECIBIDO_PARCIAL, las no recibidas vuelven al origen', async () => {
      await service.receive(
        't-1',
        { items: [{ transferItemId: 'ti-1', receivedQty: 8 }] }, // se enviaron 10, recibieron 8
        'resident-1',
      );
      expect(state.transfer.status).toBe(TransferStatus.PARCIALMENTE_RECIBIDA);
      expect(state.transfer.items[0].status).toBe(TransferItemStatus.RECIBIDO_PARCIAL);
      const toStock = state.stocks.find((s) => s.warehouseId === 'wh-to');
      const fromStock = state.stocks.find((s) => s.warehouseId === 'wh-from');
      expect(toStock?.quantity).toBe(8); // destino: lo recibido
      expect(fromStock?.quantity).toBe(2); // origen: las 2 no recibidas vuelven contablemente
      // NO se emite alerta (la alerta TRANSFER_DISCREPANCIA fue eliminada — el estado es la señal)
      const alertCalls = realtimeMock.emitToRole.mock.calls.filter(
        (c) => c[1] === 'alert.created',
      );
      expect(alertCalls).toHaveLength(0);
    });

    it('recepción completa → TRF a RECIBIDA, línea RECIBIDO_COMPLETO', async () => {
      await service.receive(
        't-1',
        { items: [{ transferItemId: 'ti-1', receivedQty: 10 }] },
        'resident-1',
      );
      expect(state.transfer.status).toBe(TransferStatus.RECIBIDA);
      expect(state.transfer.items[0].status).toBe(TransferItemStatus.RECIBIDO_COMPLETO);
    });
  });

  describe('receiveAdditional (PARCIALMENTE_RECIBIDA → completar)', () => {
    beforeEach(() => {
      // Partimos de TRF parcial: enviaron 10, recibieron 6, faltan 4.
      // En Modelo C las 4 pendientes ya están como saldo del origen (devueltas
      // contablemente en receive). El destino tiene los 6 recibidos.
      state.transfer.status = TransferStatus.PARCIALMENTE_RECIBIDA;
      state.transfer.items[0].sentQty = 10;
      state.transfer.items[0].receivedQty = 6;
      state.transfer.items[0].status = TransferItemStatus.RECIBIDO_PARCIAL;
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-from',
        quantity: 4,
        version: 0,
      });
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-to',
        quantity: 6,
        version: 0,
      });
    });

    const fromStock = () =>
      state.stocks.find((s) => s.warehouseId === 'wh-from')?.quantity;
    const toStock = () => state.stocks.find((s) => s.warehouseId === 'wh-to')?.quantity;

    it('completa la línea: saca del origen y suma al destino', async () => {
      await service.receiveAdditional(
        't-1',
        { items: [{ transferItemId: 'ti-1', additionalQty: 4 }] },
        'resident-1',
      );
      expect(state.transfer.items[0].receivedQty).toBe(10);
      expect(state.transfer.items[0].status).toBe(TransferItemStatus.RECIBIDO_COMPLETO);
      expect(state.transfer.status).toBe(TransferStatus.RECIBIDA);
      expect(fromStock()).toBe(0); // origen: 4 → 0
      expect(toStock()).toBe(10); // destino: 6 → 10
    });

    it('recepción adicional parcial mantiene PARCIALMENTE_RECIBIDA', async () => {
      await service.receiveAdditional(
        't-1',
        { items: [{ transferItemId: 'ti-1', additionalQty: 2 }] },
        'resident-1',
      );
      expect(state.transfer.items[0].receivedQty).toBe(8);
      expect(state.transfer.items[0].status).toBe(TransferItemStatus.RECIBIDO_PARCIAL);
      expect(state.transfer.status).toBe(TransferStatus.PARCIALMENTE_RECIBIDA);
      expect(fromStock()).toBe(2); // origen: 4 → 2
      expect(toStock()).toBe(8); // destino: 6 → 8
    });

    it('rechaza additionalQty que excede lo pendiente', async () => {
      await expect(
        service.receiveAdditional(
          't-1',
          { items: [{ transferItemId: 'ti-1', additionalQty: 10 }] }, // solo faltan 4
          'resident-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });

    it('rechaza si TRF no está en PARCIALMENTE_RECIBIDA', async () => {
      state.transfer.status = TransferStatus.EN_TRANSITO;
      await expect(
        service.receiveAdditional(
          't-1',
          { items: [{ transferItemId: 'ti-1', additionalQty: 4 }] },
          'resident-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'TRANSFER_INVALID_STATE' });
    });
  });

  describe('closeAsShortage (admin cierra como faltante definitivo)', () => {
    beforeEach(() => {
      state.transfer.status = TransferStatus.PARCIALMENTE_RECIBIDA;
      state.transfer.items[0].sentQty = 10;
      state.transfer.items[0].receivedQty = 6;
      state.transfer.items[0].status = TransferItemStatus.RECIBIDO_PARCIAL;
      // Modelo C: el origen tiene las 4 pendientes (devueltas en receive parcial).
      // Compra fue 90, salieron 10 a TRF, volvieron 4 → saldo 84.
      state.stocks.push({
        itemId: 'item-1',
        warehouseId: 'wh-from',
        quantity: 84,
        version: 0,
      });
    });

    it('SALIDA directa del origen con motivo, baja el saldo visible', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'admin-1',
        role: { name: 'ADMIN' },
      });
      await service.closeAsShortage(
        't-1',
        {
          transferItemIds: ['ti-1'],
          reason: 'INCUMPLIMIENTO_PROVEEDOR',
          notes: 'Proveedor PRV-CEMENTOS-LIMA dio de baja el pedido',
        },
        'admin-1',
      );
      expect(state.transfer.items[0].status).toBe(TransferItemStatus.FALTANTE_DEFINITIVO);
      expect(state.transfer.items[0].shortageReason).toBe('INCUMPLIMIENTO_PROVEEDOR');
      // El origen: 84 - 4 = 80 (las 4 pendientes salen con motivo COMPRA_INCUMPLIDA)
      expect(state.stocks[0].quantity).toBe(80);
      // TRF cierra como RECIBIDA (toda línea pendiente queda terminal)
      expect(state.transfer.status).toBe(TransferStatus.RECIBIDA);
    });

    it('rechaza si el usuario no es ADMIN', async () => {
      // resident-1 ya está en el mock por default
      await expect(
        service.closeAsShortage(
          't-1',
          { transferItemIds: ['ti-1'], reason: 'INCUMPLIMIENTO_PROVEEDOR' },
          'resident-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'PERMISSION_DENIED' });
    });

    it('rechaza si TRF no está en PARCIALMENTE_RECIBIDA', async () => {
      state.transfer.status = TransferStatus.RECIBIDA;
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'admin-1',
        role: { name: 'ADMIN' },
      });
      await expect(
        service.closeAsShortage(
          't-1',
          { transferItemIds: ['ti-1'], reason: 'INCUMPLIMIENTO_PROVEEDOR' },
          'admin-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'TRANSFER_INVALID_STATE' });
    });

    it('rechaza si la línea no está en RECIBIDO_PARCIAL', async () => {
      state.transfer.items[0].status = TransferItemStatus.RECIBIDO_COMPLETO;
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'admin-1',
        role: { name: 'ADMIN' },
      });
      await expect(
        service.closeAsShortage(
          't-1',
          { transferItemIds: ['ti-1'], reason: 'INCUMPLIMIENTO_PROVEEDOR' },
          'admin-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });
  });

  describe('findOne', () => {
    it('throws TRANSFER_NOT_FOUND when id does not exist', async () => {
      prismaMock.transfer.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne('missing')).rejects.toMatchObject({
        errorCode: 'TRANSFER_NOT_FOUND',
      });
    });
  });
});
