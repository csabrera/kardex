import { Test, TestingModule } from '@nestjs/testing';
import { ObraStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ObrasService } from './obras.service';

const baseObra = {
  id: 'obra-1',
  code: 'OBR-01',
  name: 'Plaza San Isidro',
  status: ObraStatus.PLANIFICACION,
  responsibleUserId: 'u-1',
  deletedAt: null,
};

describe('ObrasService', () => {
  let service: ObrasService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      obra: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(baseObra),
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest
          .fn()
          .mockImplementation(({ where }) =>
            Promise.resolve({ id: where.id, ...baseObra }),
          ),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'obra-new', ...data })),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ ...baseObra, ...data })),
      },
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'u-1', active: true, deletedAt: null }),
      },
      warehouse: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'wh-new', ...data })),
      },
      worker: { count: jest.fn().mockResolvedValue(0) },
      toolLoan: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ObrasService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<ObrasService>(ObrasService);
  });

  describe('create', () => {
    it('normaliza code a mayúsculas', async () => {
      await service.create({ code: 'obr-01', name: 'Test', responsibleUserId: 'u-1' });
      expect(prismaMock.obra.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: 'OBR-01' }) }),
      );
    });

    it('rechaza code duplicado', async () => {
      prismaMock.obra.findUnique.mockResolvedValueOnce({
        id: 'existing',
        code: 'OBR-01',
      });
      await expect(
        service.create({ code: 'OBR-01', name: 'X', responsibleUserId: 'u-1' }),
      ).rejects.toMatchObject({ errorCode: 'DUPLICATE_RESOURCE' });
    });

    it('valida responsibleUserId existe', async () => {
      prismaMock.user.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.create({ code: 'OBR-02', name: 'X', responsibleUserId: 'missing-user' }),
      ).rejects.toMatchObject({ errorCode: 'USER_NOT_FOUND' });
    });

    it('default status = PLANIFICACION si no se especifica', async () => {
      await service.create({ code: 'OBR-02', name: 'X', responsibleUserId: 'u-1' });
      expect(prismaMock.obra.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ObraStatus.PLANIFICACION }),
        }),
      );
    });

    it('crea automáticamente un almacén OBRA con código ALM-{OBRA_CODE}', async () => {
      await service.create({
        code: 'OBR-99',
        name: 'Edif Lima',
        responsibleUserId: 'u-1',
      });
      expect(prismaMock.warehouse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'ALM-OBR-99',
            type: 'OBRA',
            obraId: 'obra-new',
          }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('bloquea eliminación si hay préstamos activos en la obra', async () => {
      prismaMock.toolLoan.count.mockResolvedValueOnce(2);
      await expect(service.remove('obra-1')).rejects.toMatchObject({
        errorCode: 'RESOURCE_IN_USE',
      });
    });

    it('bloquea eliminación si hay almacenes activos', async () => {
      prismaMock.warehouse.count.mockResolvedValueOnce(1);
      await expect(service.remove('obra-1')).rejects.toMatchObject({
        errorCode: 'RESOURCE_IN_USE',
      });
    });

    it('bloquea eliminación si hay empleados asignados', async () => {
      prismaMock.worker.count.mockResolvedValueOnce(5);
      await expect(service.remove('obra-1')).rejects.toMatchObject({
        errorCode: 'RESOURCE_IN_USE',
      });
    });

    it('soft delete cuando no hay dependencias', async () => {
      await service.remove('obra-1');
      expect(prismaMock.obra.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NOT_FOUND cuando obra no existe', async () => {
      prismaMock.obra.findFirst.mockResolvedValueOnce(null);
      await expect(service.findOne('missing')).rejects.toMatchObject({
        errorCode: 'NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    it('permite reasignar responsibleUserId a otro usuario válido', async () => {
      await service.update('obra-1', { responsibleUserId: 'u-2' });
      expect(prismaMock.obra.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ responsibleUserId: 'u-2' }),
        }),
      );
    });

    it('rechaza responsibleUserId inexistente', async () => {
      prismaMock.user.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.update('obra-1', { responsibleUserId: 'missing-user' }),
      ).rejects.toMatchObject({ errorCode: 'USER_NOT_FOUND' });
    });
  });
});
