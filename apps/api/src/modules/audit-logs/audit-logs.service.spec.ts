import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsService', () => {
  let service: AuditLogsService;
  let prismaMock: any;

  const sampleLogs = [
    {
      id: 'log-1',
      userId: 'u-1',
      userDoc: 'DNI:12345678',
      action: 'POST',
      resource: 'items',
      resourceId: 'item-1',
      changes: null,
      ip: '127.0.0.1',
      userAgent: 'jest',
      createdAt: new Date('2026-04-23T10:00:00Z'),
    },
    {
      id: 'log-2',
      userId: 'u-2',
      userDoc: 'DNI:87654321',
      action: 'DELETE',
      resource: 'obras',
      resourceId: 'obra-1',
      changes: null,
      ip: '127.0.0.1',
      userAgent: 'jest',
      createdAt: new Date('2026-04-23T11:00:00Z'),
    },
  ];

  beforeEach(async () => {
    prismaMock = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue(sampleLogs),
        count: jest.fn().mockResolvedValue(sampleLogs.length),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u-1',
            firstName: 'Admin',
            lastName: 'Principal',
            documentType: 'DNI',
            documentNumber: '12345678',
          },
          {
            id: 'u-2',
            firstName: 'Carlos',
            lastName: 'Almacenero',
            documentType: 'DNI',
            documentNumber: '87654321',
          },
        ]),
      },
      $transaction: jest
        .fn()
        .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditLogsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  describe('findAll', () => {
    it('retorna paginado con usuario resuelto', async () => {
      const result = await service.findAll({ page: 1, pageSize: 50 });

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].user).toMatchObject({ firstName: 'Admin' });
      expect(result.items[1].user).toMatchObject({ firstName: 'Carlos' });
    });

    it('filtra por resource', async () => {
      await service.findAll({ resource: 'items', page: 1, pageSize: 50 });
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ resource: 'items' }),
        }),
      );
    });

    it('filtra por action (case-insensitive, se convierte a upper)', async () => {
      await service.findAll({ action: 'delete', page: 1, pageSize: 50 });
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ action: 'DELETE' }) }),
      );
    });

    it('filtra por userId', async () => {
      await service.findAll({ userId: 'u-1', page: 1, pageSize: 50 });
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'u-1' }) }),
      );
    });

    it('filtra por rango de fechas from/to', async () => {
      await service.findAll({
        from: '2026-04-23T00:00:00Z',
        to: '2026-04-23T23:59:59Z',
        page: 1,
        pageSize: 50,
      });
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: expect.any(Date), lte: expect.any(Date) },
          }),
        }),
      );
    });

    it('no invoca user.findMany cuando no hay userIds', async () => {
      prismaMock.auditLog.findMany.mockResolvedValueOnce([
        { ...sampleLogs[0], userId: null },
      ]);
      const result = await service.findAll({ page: 1, pageSize: 50 });
      expect(prismaMock.user.findMany).not.toHaveBeenCalled();
      expect(result.items[0].user).toBeNull();
    });

    it('calcula totalPages correctamente', async () => {
      prismaMock.auditLog.count.mockResolvedValueOnce(125);
      const result = await service.findAll({ page: 1, pageSize: 50 });
      expect(result.totalPages).toBe(3);
    });
  });

  describe('distinctResources', () => {
    it('retorna lista de recursos únicos', async () => {
      prismaMock.auditLog.findMany.mockResolvedValueOnce([
        { resource: 'items' },
        { resource: 'obras' },
        { resource: 'transfers' },
      ]);
      const result = await service.distinctResources();
      expect(result).toEqual(['items', 'obras', 'transfers']);
    });
  });
});
