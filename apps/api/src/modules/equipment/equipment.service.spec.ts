import { Test, TestingModule } from '@nestjs/testing';
import { CountType, EquipmentStatus, EquipmentType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { EquipmentService } from './equipment.service';

describe('EquipmentService', () => {
  let service: EquipmentService;
  let prismaMock: any;
  let equipmentState: any;

  beforeEach(async () => {
    equipmentState = {
      id: 'eq-1',
      code: 'EQP-ABC123',
      name: 'Retroexcavadora CAT',
      type: EquipmentType.MAQUINARIA_PESADA,
      status: EquipmentStatus.OPERATIVO,
      currentCount: 1000,
      initialCount: 0,
      countType: CountType.HOROMETRO,
      obraId: null,
      active: true,
      deletedAt: null,
    };

    prismaMock = {
      equipment: {
        // findFirst se usa tanto para findOne(id) como para duplicado por código.
        // Si la query busca por `code` devolvemos null (no duplicado); si busca por id, devolvemos la fixture.
        findFirst: jest.fn((args?: any) => {
          if (args?.where?.code) return Promise.resolve(null);
          return Promise.resolve(equipmentState);
        }),
        findUnique: jest.fn(() => Promise.resolve(null)),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(({ data }: any) =>
          Promise.resolve({ ...equipmentState, ...data, id: 'eq-new' }),
        ),
        update: jest.fn(({ data }: any) => {
          Object.assign(equipmentState, data);
          return Promise.resolve(equipmentState);
        }),
      },
      obra: {
        findFirst: jest.fn().mockResolvedValue({ id: 'obra-1', deletedAt: null }),
      },
      equipmentCountReading: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(({ data }: any) => Promise.resolve({ id: 'r-1', ...data })),
      },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          equipment: {
            update: jest.fn(({ data }: any) => {
              Object.assign(equipmentState, data);
              return Promise.resolve(equipmentState);
            }),
          },
          equipmentCountReading: {
            create: jest.fn(({ data }: any) => Promise.resolve({ id: 'r-1', ...data })),
          },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EquipmentService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<EquipmentService>(EquipmentService);
  });

  describe('create', () => {
    it('crea equipo con código auto-generado y currentCount = initialCount', async () => {
      const result = await service.create({
        name: 'Compactadora',
        type: EquipmentType.MAQUINARIA_PESADA,
        initialCount: 250,
      });
      expect(result.name).toBe('Compactadora');
      expect(Number(result.initialCount)).toBe(250);
      expect(Number(result.currentCount)).toBe(250);
    });

    it('rechaza código duplicado', async () => {
      prismaMock.equipment.findFirst.mockResolvedValueOnce({ id: 'existing' });
      await expect(service.create({ name: 'X', code: 'EQP-DUP' })).rejects.toMatchObject({
        errorCode: 'DUPLICATE_RESOURCE',
      });
    });

    it('rechaza obra inexistente', async () => {
      prismaMock.obra.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.create({ name: 'X', obraId: 'obra-fantasma' }),
      ).rejects.toMatchObject({ errorCode: 'NOT_FOUND' });
    });
  });

  describe('update', () => {
    it('actualiza campos válidos', async () => {
      const result = await service.update('eq-1', { name: 'Nuevo nombre' });
      expect(result.name).toBe('Nuevo nombre');
    });

    it('rechaza actualizar equipo en BAJA', async () => {
      equipmentState.status = EquipmentStatus.BAJA;
      await expect(service.update('eq-1', { name: 'X' })).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });

    it('permite cambiar estado entre OPERATIVO/AVERIADO', async () => {
      const result = await service.update('eq-1', {
        status: EquipmentStatus.AVERIADO,
      });
      expect(result.status).toBe(EquipmentStatus.AVERIADO);
    });
  });

  describe('recordReading', () => {
    it('registra lectura si es mayor o igual al valor actual', async () => {
      const result = await service.recordReading('eq-1', { countValue: 1100 }, 'u-1');
      expect(Number(result.countValue)).toBe(1100);
      expect(result.source).toBe('MANUAL');
      expect(Number(equipmentState.currentCount)).toBe(1100);
    });

    it('rechaza lectura menor al valor actual (no retroceso)', async () => {
      await expect(
        service.recordReading('eq-1', { countValue: 500 }, 'u-1'),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });

    it('permite lectura igual al valor actual', async () => {
      const result = await service.recordReading('eq-1', { countValue: 1000 }, 'u-1');
      expect(Number(result.countValue)).toBe(1000);
    });
  });

  describe('remove', () => {
    it('marca BAJA + deletedAt', async () => {
      const result = await service.remove('eq-1');
      expect(result.status).toBe(EquipmentStatus.BAJA);
      expect(equipmentState.deletedAt).toBeInstanceOf(Date);
    });

    it('rechaza remover equipo ya en BAJA', async () => {
      equipmentState.status = EquipmentStatus.BAJA;
      await expect(service.remove('eq-1')).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });
  });

  describe('findOne', () => {
    it('lanza NOT_FOUND si no existe', async () => {
      prismaMock.equipment.findFirst.mockResolvedValueOnce(null);
      await expect(service.findOne('nope')).rejects.toMatchObject({
        errorCode: 'NOT_FOUND',
      });
    });
  });
});
