import { Test, TestingModule } from '@nestjs/testing';
import { TransferStatus } from '@prisma/client';

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

    it('handles partial reception (received < sent)', async () => {
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
      // Diferencia registrada en el item
      expect(state.transfer.items[0].receivedQty).toBe(7);
    });

    it('rejects if not in EN_TRANSITO state', async () => {
      state.transfer.status = TransferStatus.APROBADA;
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
      await service.cancel('t-1', 'user-1');
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
        await expect(service.cancel('t-1', 'user-1')).rejects.toMatchObject({
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
      await service.cancel('t-1', 'user-1');
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

    it('ADMIN puede recibir como override (no requiere ser responsable)', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'admin-1',
        role: { name: 'ADMIN' },
      });
      await service.receive(
        't-1',
        { items: [{ transferItemId: 'ti-1', receivedQty: 10 }] },
        'admin-1',
      );
      expect(state.transfer.status).toBe(TransferStatus.RECIBIDA);
    });

    it('ALMACENERO puede recibir como override', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'alm-1',
        role: { name: 'ALMACENERO' },
      });
      await service.receive(
        't-1',
        { items: [{ transferItemId: 'ti-1', receivedQty: 10 }] },
        'alm-1',
      );
      expect(state.transfer.status).toBe(TransferStatus.RECIBIDA);
    });

    it('genera alerta TRANSFER_DISCREPANCIA cuando receivedQty ≠ sentQty', async () => {
      await service.receive(
        't-1',
        { items: [{ transferItemId: 'ti-1', receivedQty: 8 }] }, // se enviaron 10, recibieron 8
        'resident-1',
      );
      // verificamos que se llamó alert.create dentro del tx (vía el mock del txMock)
      // no podemos acceder directo al mock del tx, pero confirmamos el estado final:
      expect(state.transfer.status).toBe(TransferStatus.RECIBIDA);
      expect(state.stocks[0].quantity).toBe(8);
      // Y el WS event de ADMIN debe haberse emitido con ALERT_CREATED
      expect(realtimeMock.emitToRole).toHaveBeenCalledWith(
        'ADMIN',
        'alert.created',
        expect.objectContaining({ transferCode: 'TRF-00001' }),
      );
    });

    it('NO emite alerta si receivedQty == sentQty', async () => {
      await service.receive(
        't-1',
        { items: [{ transferItemId: 'ti-1', receivedQty: 10 }] },
        'resident-1',
      );
      // Buscar llamadas a emitToRole con ALERT_CREATED
      const alertCalls = realtimeMock.emitToRole.mock.calls.filter(
        (c) => c[1] === 'alert.created',
      );
      expect(alertCalls).toHaveLength(0);
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
