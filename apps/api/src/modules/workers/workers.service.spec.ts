import { Test, TestingModule } from '@nestjs/testing';
import { DocumentType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { WorkersService } from './workers.service';

describe('WorkersService', () => {
  let service: WorkersService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      worker: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'w-1', active: true, deletedAt: null, obraId: null }),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'w-new', ...data })),
        update: jest
          .fn()
          .mockImplementation(({ where, data }) =>
            Promise.resolve({ id: where.id, ...data }),
          ),
      },
      specialty: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 's-1', active: true, deletedAt: null }),
      },
      obra: {
        findFirst: jest.fn().mockResolvedValue({ id: 'o-1', deletedAt: null }),
      },
      toolLoan: { count: jest.fn().mockResolvedValue(0) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkersService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<WorkersService>(WorkersService);
  });

  const base = (overrides: any = {}) => ({
    documentType: DocumentType.DNI,
    documentNumber: '12345678',
    firstName: 'Juan',
    lastName: 'Pérez',
    phone: '987654321',
    specialtyId: 's-1',
    ...overrides,
  });

  describe('create', () => {
    it('crea worker con datos válidos', async () => {
      // mock findFirst para duplicate check (devuelve null) + default
      prismaMock.worker.findFirst.mockResolvedValueOnce(null); // first call: dup check
      const result = await service.create(base());
      expect(result).toMatchObject({ documentNumber: '12345678', phone: '987654321' });
    });

    it('rechaza si documento ya existe', async () => {
      prismaMock.worker.findFirst.mockResolvedValueOnce({ id: 'existing' });
      await expect(service.create(base())).rejects.toMatchObject({
        errorCode: 'DOCUMENT_ALREADY_REGISTERED',
      });
    });

    it('rechaza si especialidad no existe', async () => {
      prismaMock.worker.findFirst.mockResolvedValueOnce(null);
      prismaMock.specialty.findFirst.mockResolvedValueOnce(null);
      await expect(service.create(base())).rejects.toMatchObject({
        errorCode: 'NOT_FOUND',
      });
    });

    it('rechaza si obra no existe (cuando se proporciona)', async () => {
      prismaMock.worker.findFirst.mockResolvedValueOnce(null);
      prismaMock.obra.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.create(base({ obraId: 'missing-obra' })),
      ).rejects.toMatchObject({
        errorCode: 'NOT_FOUND',
      });
    });
  });

  describe('remove', () => {
    it('bloquea si hay préstamos activos a nombre del worker', async () => {
      prismaMock.toolLoan.count.mockResolvedValueOnce(1);
      await expect(service.remove('w-1')).rejects.toMatchObject({
        errorCode: 'RESOURCE_IN_USE',
      });
    });

    it('soft delete cuando no hay préstamos activos', async () => {
      await service.remove('w-1');
      expect(prismaMock.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('update', () => {
    it('permite desasignar obra (obraId = "")', async () => {
      await service.update('w-1', { obraId: '' });
      expect(prismaMock.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ obraId: null }) }),
      );
    });

    it('valida nueva especialidad al actualizar', async () => {
      prismaMock.specialty.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.update('w-1', { specialtyId: 'missing' }),
      ).rejects.toMatchObject({
        errorCode: 'NOT_FOUND',
      });
    });
  });

  describe('findOne', () => {
    it('throws WORKER_NOT_FOUND si no existe', async () => {
      prismaMock.worker.findFirst.mockResolvedValueOnce(null);
      await expect(service.findOne('missing')).rejects.toMatchObject({
        errorCode: 'WORKER_NOT_FOUND',
      });
    });
  });
});
