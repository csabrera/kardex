import { Test, TestingModule } from '@nestjs/testing';
import {
  EquipmentStatus,
  ItemType,
  MaintenanceStatus,
  MaintenanceType,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let prismaMock: any;
  let realtimeMock: any;
  let maintenanceState: any;
  let equipmentState: any;
  let stockState: { quantity: number; version: number };
  let movementSeq: number;
  let maintenanceSeq: number;

  beforeEach(async () => {
    movementSeq = 0;
    maintenanceSeq = 0;
    stockState = { quantity: 50, version: 0 };

    equipmentState = {
      id: 'eq-1',
      code: 'EQP-CAT',
      status: EquipmentStatus.OPERATIVO,
      currentCount: 1000,
      deletedAt: null,
    };

    maintenanceState = {
      id: 'm-1',
      code: 'MAN-00001',
      equipmentId: 'eq-1',
      equipment: equipmentState,
      type: MaintenanceType.PREVENTIVO,
      description: 'Cambio de aceite',
      status: MaintenanceStatus.PROGRAMADO,
      scheduledDate: null,
      scheduledCount: null,
      startedAt: null,
      countAtStart: null,
      completedAt: null,
      countAtEnd: null,
      cancelledAt: null,
      cancelReason: null,
      totalCost: null,
      technicianId: null,
      notes: null,
      items: [],
    };

    const makeTx = () => ({
      maintenance: {
        update: jest.fn(({ data }: any) => {
          Object.assign(maintenanceState, data);
          return Promise.resolve(maintenanceState);
        }),
      },
      equipment: {
        update: jest.fn(({ data }: any) => {
          Object.assign(equipmentState, data);
          return Promise.resolve(equipmentState);
        }),
      },
      equipmentCountReading: {
        create: jest.fn().mockResolvedValue({}),
      },
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
      movement: {
        create: jest.fn(({ data }: any) =>
          Promise.resolve({ id: `mov-${movementSeq}`, code: data.code }),
        ),
      },
      maintenanceItem: {
        create: jest.fn(({ data }: any) =>
          Promise.resolve({ id: `mi-1`, ...data, movementId: `mov-${movementSeq}` }),
        ),
      },
    });

    prismaMock = {
      equipment: {
        findFirst: jest.fn(() => Promise.resolve(equipmentState)),
      },
      item: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'item-filter',
          name: 'Filtro aceite',
          type: ItemType.REPUESTO,
          active: true,
          deletedAt: null,
        }),
      },
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'wh-1',
          active: true,
          deletedAt: null,
        }),
      },
      maintenance: {
        findUnique: jest.fn(() => Promise.resolve(maintenanceState)),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(({ data }: any) =>
          Promise.resolve({
            id: `m-${++maintenanceSeq}`,
            code: data.code,
            ...data,
            equipment: equipmentState,
            items: [],
          }),
        ),
      },
      maintenanceSequence: {
        upsert: jest.fn(() => Promise.resolve({ lastValue: maintenanceSeq + 1 })),
      },
      $transaction: jest.fn(async (cb: any) => cb(makeTx())),
    };

    realtimeMock = { emitToWarehouse: jest.fn(), emitToRole: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
  });

  describe('create', () => {
    it('crea mantenimiento PROGRAMADO con código correlativo', async () => {
      const result = await service.create({
        equipmentId: 'eq-1',
        type: MaintenanceType.PREVENTIVO,
        description: 'Cambio de aceite',
      });
      expect(result.status).toBe(MaintenanceStatus.PROGRAMADO);
      expect(result.code).toBe('MAN-00001');
    });

    it('rechaza equipo en BAJA', async () => {
      equipmentState.status = EquipmentStatus.BAJA;
      await expect(
        service.create({
          equipmentId: 'eq-1',
          type: MaintenanceType.CORRECTIVO,
          description: 'X',
        }),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });

    it('rechaza equipo inexistente', async () => {
      prismaMock.equipment.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.create({
          equipmentId: 'fantasma',
          type: MaintenanceType.PREVENTIVO,
          description: 'X',
        }),
      ).rejects.toMatchObject({ errorCode: 'NOT_FOUND' });
    });
  });

  describe('start', () => {
    it('cambia estado a EN_CURSO + equipment a EN_MANTENIMIENTO', async () => {
      const result = await service.start('m-1', { countAtStart: 1000 });
      expect(result.status).toBe(MaintenanceStatus.EN_CURSO);
      expect(equipmentState.status).toBe(EquipmentStatus.EN_MANTENIMIENTO);
      expect(Number(equipmentState.currentCount)).toBe(1000);
    });

    it('rechaza iniciar si no está PROGRAMADO', async () => {
      maintenanceState.status = MaintenanceStatus.EN_CURSO;
      await expect(service.start('m-1', { countAtStart: 1000 })).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });

    it('rechaza lectura inicial menor a currentCount', async () => {
      await expect(service.start('m-1', { countAtStart: 500 })).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });
  });

  describe('addItem', () => {
    beforeEach(() => {
      maintenanceState.status = MaintenanceStatus.EN_CURSO;
    });

    it('añade repuesto + genera Movement SALIDA + descuenta stock', async () => {
      const result = await service.addItem(
        'm-1',
        { itemId: 'item-filter', warehouseId: 'wh-1', quantity: 2 },
        'u-1',
      );
      expect(result.itemId).toBe('item-filter');
      expect(stockState.quantity).toBe(48);
      expect(realtimeMock.emitToWarehouse).toHaveBeenCalled();
    });

    it('rechaza ítem tipo HERRAMIENTA (solo REPUESTO/MATERIAL)', async () => {
      prismaMock.item.findFirst.mockResolvedValueOnce({
        id: 'item-martillo',
        type: ItemType.HERRAMIENTA,
        active: true,
        deletedAt: null,
      });
      await expect(
        service.addItem(
          'm-1',
          { itemId: 'item-martillo', warehouseId: 'wh-1', quantity: 1 },
          'u-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });

    it('rechaza si el mantenimiento no está EN_CURSO', async () => {
      maintenanceState.status = MaintenanceStatus.PROGRAMADO;
      await expect(
        service.addItem(
          'm-1',
          { itemId: 'item-filter', warehouseId: 'wh-1', quantity: 1 },
          'u-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });

    it('rechaza stock insuficiente', async () => {
      stockState = { quantity: 1, version: 0 };
      await expect(
        service.addItem(
          'm-1',
          { itemId: 'item-filter', warehouseId: 'wh-1', quantity: 50 },
          'u-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'STOCK_INSUFFICIENT' });
    });

    it('acepta ítems tipo MATERIAL (no solo REPUESTO)', async () => {
      prismaMock.item.findFirst.mockResolvedValueOnce({
        id: 'item-grasa',
        type: ItemType.MATERIAL,
        active: true,
        deletedAt: null,
      });
      const result = await service.addItem(
        'm-1',
        { itemId: 'item-grasa', warehouseId: 'wh-1', quantity: 1 },
        'u-1',
      );
      expect(result.itemId).toBe('item-grasa');
    });
  });

  describe('complete', () => {
    beforeEach(() => {
      maintenanceState.status = MaintenanceStatus.EN_CURSO;
      maintenanceState.countAtStart = 1000;
      equipmentState.status = EquipmentStatus.EN_MANTENIMIENTO;
    });

    it('completa + equipment vuelve a OPERATIVO + actualiza currentCount', async () => {
      const result = await service.complete('m-1', { countAtEnd: 1050, totalCost: 250 });
      expect(result.status).toBe(MaintenanceStatus.COMPLETADO);
      expect(equipmentState.status).toBe(EquipmentStatus.OPERATIVO);
      expect(Number(equipmentState.currentCount)).toBe(1050);
    });

    it('rechaza completar si no está EN_CURSO', async () => {
      maintenanceState.status = MaintenanceStatus.PROGRAMADO;
      await expect(service.complete('m-1', { countAtEnd: 1050 })).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });

    it('rechaza lectura final menor a la inicial', async () => {
      await expect(service.complete('m-1', { countAtEnd: 900 })).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });
  });

  describe('cancel', () => {
    it('cancela PROGRAMADO sin tocar equipment', async () => {
      const result = await service.cancel('m-1', { reason: 'cambio de planes' });
      expect(result.status).toBe(MaintenanceStatus.CANCELADO);
      expect(equipmentState.status).toBe(EquipmentStatus.OPERATIVO); // sin cambio
    });

    it('cancela EN_CURSO + equipment vuelve a OPERATIVO', async () => {
      maintenanceState.status = MaintenanceStatus.EN_CURSO;
      equipmentState.status = EquipmentStatus.EN_MANTENIMIENTO;
      const result = await service.cancel('m-1', { reason: 'ya no es necesario' });
      expect(result.status).toBe(MaintenanceStatus.CANCELADO);
      expect(equipmentState.status).toBe(EquipmentStatus.OPERATIVO);
    });

    it('rechaza cancelar un mantenimiento COMPLETADO', async () => {
      maintenanceState.status = MaintenanceStatus.COMPLETADO;
      await expect(service.cancel('m-1', { reason: 'x' })).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });
  });
});
