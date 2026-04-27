import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { SpecialtiesService } from './specialties.service';

describe('SpecialtiesService', () => {
  let service: SpecialtiesService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      specialty: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: 's-1',
          code: 'ALBANIL',
          name: 'Albañil',
          active: true,
          deletedAt: null,
        }),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 's-new', ...data })),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 's-1', ...data })),
      },
      worker: { count: jest.fn().mockResolvedValue(0) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SpecialtiesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<SpecialtiesService>(SpecialtiesService);
  });

  it('create — normaliza code a mayúsculas y rechaza duplicados', async () => {
    prismaMock.specialty.findUnique.mockResolvedValueOnce({
      id: 'existing',
      code: 'ALBANIL',
    });
    await expect(
      service.create({ code: 'albanil', name: 'Albañil' }),
    ).rejects.toMatchObject({
      errorCode: 'DUPLICATE_RESOURCE',
    });
  });

  it('create — guarda name trimeado', async () => {
    await service.create({ code: 'NUEVO', name: '  Soldador  ' });
    expect(prismaMock.specialty.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Soldador', code: 'NUEVO' }),
    });
  });

  it('remove — bloquea si hay workers usando la especialidad', async () => {
    prismaMock.worker.count.mockResolvedValueOnce(3);
    await expect(service.remove('s-1')).rejects.toMatchObject({
      errorCode: 'RESOURCE_IN_USE',
    });
  });

  it('remove — soft delete cuando no hay workers', async () => {
    prismaMock.worker.count.mockResolvedValueOnce(0);
    await service.remove('s-1');
    expect(prismaMock.specialty.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('findOne — throws NOT_FOUND si no existe', async () => {
    prismaMock.specialty.findFirst.mockResolvedValueOnce(null);
    await expect(service.findOne('missing')).rejects.toMatchObject({
      errorCode: 'NOT_FOUND',
    });
  });
});
