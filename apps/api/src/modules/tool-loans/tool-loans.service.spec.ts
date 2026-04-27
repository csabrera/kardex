import { Test, TestingModule } from '@nestjs/testing';
import {
  ItemType,
  ToolLoanCondition,
  ToolLoanStatus,
  WarehouseType,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ToolLoansService } from './tool-loans.service';

function makeLoan(overrides: any = {}) {
  return {
    id: 'loan-1',
    code: 'PRT-00001',
    status: ToolLoanStatus.ACTIVE,
    quantity: 1,
    itemId: 'item-1',
    warehouseId: 'wh-1',
    workStationId: 'ws-1',
    borrowerWorkerId: 'w-1',
    loanedById: 'u-1',
    loanedAt: new Date(),
    expectedReturnAt: new Date(Date.now() + 86400000),
    returnedAt: null,
    returnedById: null,
    returnCondition: null,
    returnNotes: null,
    borrowerNotes: null,
    ...overrides,
  };
}

describe('ToolLoansService', () => {
  let service: ToolLoansService;
  let prismaMock: any;
  let loanState: any;

  beforeEach(async () => {
    loanState = makeLoan();

    prismaMock = {
      // assertWarehouseScope llama user.findUnique — default: ADMIN (sin restricción)
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: { name: 'ADMIN' } }),
      },
      item: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'item-1',
          type: ItemType.HERRAMIENTA,
          active: true,
          deletedAt: null,
        }),
      },
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'wh-1',
          type: WarehouseType.OBRA,
          obraId: 'obra-1',
          active: true,
          deletedAt: null,
        }),
      },
      workStation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ws-1',
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
        findUnique: jest.fn().mockResolvedValue({ quantity: 10 }),
      },
      toolLoan: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(loanState)),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...loanState, ...data, id: 'loan-new' }),
          ),
        update: jest.fn().mockImplementation(({ data }) => {
          Object.assign(loanState, data);
          return Promise.resolve(loanState);
        }),
      },
      toolLoanSequence: {
        upsert: jest.fn().mockResolvedValue({ lastValue: 1 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ToolLoansService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<ToolLoansService>(ToolLoansService);
  });

  const baseDto = (overrides: any = {}) => ({
    itemId: 'item-1',
    warehouseId: 'wh-1',
    workStationId: 'ws-1',
    borrowerWorkerId: 'w-1',
    quantity: 1,
    expectedReturnAt: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  });

  describe('create — validaciones de tipo', () => {
    it('crea préstamo con datos válidos', async () => {
      const result = await service.create(baseDto(), 'loaner-1');
      expect((result as any).code).toBe('PRT-00001');
    });

    it('rechaza items que no son HERRAMIENTA o EQUIPO', async () => {
      prismaMock.item.findFirst.mockResolvedValueOnce({
        id: 'item-1',
        type: ItemType.MATERIAL,
        active: true,
      });
      await expect(service.create(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });

    it('acepta EQUIPO', async () => {
      prismaMock.item.findFirst.mockResolvedValueOnce({
        id: 'item-1',
        type: ItemType.EQUIPO,
        active: true,
      });
      await expect(service.create(baseDto(), 'u-1')).resolves.toBeDefined();
    });
  });

  describe('create — validaciones de almacén', () => {
    it('rechaza almacén tipo CENTRAL', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce({
        id: 'wh-central',
        type: WarehouseType.CENTRAL,
        obraId: null,
        active: true,
      });
      await expect(service.create(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });

    it('rechaza si warehouse no existe', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce(null);
      await expect(service.create(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'WAREHOUSE_NOT_FOUND',
      });
    });

    it('rechaza si almacén OBRA no tiene obra asignada (inconsistencia)', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce({
        id: 'wh-1',
        type: WarehouseType.OBRA,
        obraId: null,
        active: true,
      });
      await expect(service.create(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });
  });

  describe('create — validaciones de estación de trabajo', () => {
    it('rechaza si estación no existe', async () => {
      prismaMock.workStation.findFirst.mockResolvedValueOnce(null);
      await expect(service.create(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'NOT_FOUND',
      });
    });

    it('rechaza si estación pertenece a otra obra', async () => {
      prismaMock.workStation.findFirst.mockResolvedValueOnce({
        id: 'ws-other',
        obraId: 'obra-OTRA',
        active: true,
        deletedAt: null,
      });
      await expect(service.create(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });
  });

  describe('create — validaciones de empleado', () => {
    it('rechaza si worker no existe', async () => {
      prismaMock.worker.findFirst.mockResolvedValueOnce(null);
      await expect(service.create(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'WORKER_NOT_FOUND',
      });
    });

    it('rechaza si worker pertenece a otra obra', async () => {
      prismaMock.worker.findFirst.mockResolvedValueOnce({
        id: 'w-other',
        obraId: 'obra-OTRA',
        active: true,
        deletedAt: null,
      });
      await expect(service.create(baseDto(), 'u-1')).rejects.toMatchObject({
        errorCode: 'INVALID_INPUT',
      });
    });

    it('permite worker sin obra asignada (null)', async () => {
      prismaMock.worker.findFirst.mockResolvedValueOnce({
        id: 'w-1',
        obraId: null,
        active: true,
        deletedAt: null,
      });
      await expect(service.create(baseDto(), 'u-1')).resolves.toBeDefined();
    });
  });

  describe('create — disponibilidad y fecha', () => {
    it('rechaza fecha pasada', async () => {
      await expect(
        service.create(
          baseDto({ expectedReturnAt: new Date(Date.now() - 3600000).toISOString() }),
          'u-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });

    it('rechaza cantidad que excede disponible (stock − prestados)', async () => {
      prismaMock.stock.findUnique.mockResolvedValueOnce({ quantity: 5 });
      prismaMock.toolLoan.aggregate.mockResolvedValueOnce({ _sum: { quantity: 3 } });
      await expect(service.create(baseDto({ quantity: 3 }), 'u-1')).rejects.toMatchObject(
        {
          errorCode: 'TOOL_ALREADY_LOANED',
        },
      );
    });

    it('permite cantidad exactamente igual al disponible', async () => {
      prismaMock.stock.findUnique.mockResolvedValueOnce({ quantity: 5 });
      prismaMock.toolLoan.aggregate.mockResolvedValueOnce({ _sum: { quantity: 3 } });
      await expect(
        service.create(baseDto({ quantity: 2 }), 'u-1'),
      ).resolves.toBeDefined();
    });
  });

  describe('returnLoan', () => {
    it('transiciona ACTIVE → RETURNED con condition', async () => {
      await service.returnLoan(
        'loan-1',
        { condition: ToolLoanCondition.BUENO, notes: 'Sin novedad' },
        'u-ret',
      );
      expect(loanState.status).toBe(ToolLoanStatus.RETURNED);
      expect(loanState.returnCondition).toBe(ToolLoanCondition.BUENO);
    });

    it('rechaza return si ya está RETURNED', async () => {
      loanState.status = ToolLoanStatus.RETURNED;
      await expect(
        service.returnLoan('loan-1', { condition: ToolLoanCondition.BUENO }, 'u-1'),
      ).rejects.toMatchObject({ errorCode: 'TOOL_LOAN_NOT_FOUND' });
    });

    it('throws si loan no existe', async () => {
      prismaMock.toolLoan.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.returnLoan('missing', { condition: ToolLoanCondition.BUENO }, 'u-1'),
      ).rejects.toMatchObject({ errorCode: 'TOOL_LOAN_NOT_FOUND' });
    });
  });

  describe('markLost', () => {
    it('transiciona ACTIVE → LOST', async () => {
      await service.markLost('loan-1', 'u-1');
      expect(loanState.status).toBe(ToolLoanStatus.LOST);
    });
  });

  describe('summary + findOverdue', () => {
    it('summary devuelve contadores separados', async () => {
      prismaMock.toolLoan.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(1);
      const result = await service.summary();
      expect(result).toEqual({ active: 5, overdue: 2, returned: 20, lost: 1 });
    });

    it('findOverdue filtra por ACTIVE y fecha pasada', async () => {
      await service.findOverdue();
      expect(prismaMock.toolLoan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ToolLoanStatus.ACTIVE,
            expectedReturnAt: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        }),
      );
    });
  });
});
