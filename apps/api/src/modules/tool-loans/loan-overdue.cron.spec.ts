import { Test, TestingModule } from '@nestjs/testing';
import { AlertType, ToolLoanStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { LoanOverdueCron } from './loan-overdue.cron';

function makeOverdueLoan(overrides: any = {}) {
  return {
    id: 'loan-1',
    itemId: 'item-1',
    warehouseId: 'wh-1',
    expectedReturnAt: new Date(Date.now() - 3 * 86_400_000), // 3 días vencido
    status: ToolLoanStatus.ACTIVE,
    item: { id: 'item-1', code: 'ITM-001', name: 'Taladro Bosch' },
    warehouse: {
      id: 'wh-1',
      obra: { id: 'obra-1', name: 'Obra Test', responsibleUserId: 'resident-1' },
    },
    borrowerWorker: {
      firstName: 'JUAN',
      paternalLastName: 'PÉREZ',
      maternalLastName: 'GARCÍA',
    },
    ...overrides,
  };
}

describe('LoanOverdueCron', () => {
  let cron: LoanOverdueCron;
  let prismaMock: any;
  let realtimeMock: jest.Mocked<RealtimeService>;

  beforeEach(async () => {
    prismaMock = {
      toolLoan: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      alert: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation((args: any) =>
            Promise.resolve({ id: 'alert-1', ...args.data }),
          ),
      },
    };

    realtimeMock = {
      emitToRole: jest.fn(),
      emitToUser: jest.fn(),
      emitToWarehouse: jest.fn(),
      emitToAll: jest.fn(),
    } as unknown as jest.Mocked<RealtimeService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoanOverdueCron,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compile();

    cron = module.get(LoanOverdueCron);
  });

  it('crea Alert LOAN_VENCIDO para préstamo vencido sin alerta previa', async () => {
    prismaMock.toolLoan.findMany.mockResolvedValue([makeOverdueLoan()]);

    const result = await cron.checkOverdueLoans();

    expect(result).toEqual({ scanned: 1, alertsCreated: 1 });
    expect(prismaMock.alert.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.alert.create.mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      type: AlertType.LOAN_VENCIDO,
      itemId: 'item-1',
      warehouseId: 'wh-1',
      toolLoanId: 'loan-1',
    });
    expect(createArgs.data.message).toContain('Préstamo vencido');
    expect(createArgs.data.message).toContain('Taladro Bosch');
    expect(createArgs.data.message).toContain('3 días');
  });

  it('emite ALERT_CREATED a role:ADMIN y al residente responsable', async () => {
    prismaMock.toolLoan.findMany.mockResolvedValue([makeOverdueLoan()]);

    await cron.checkOverdueLoans();

    expect(realtimeMock.emitToRole).toHaveBeenCalledWith(
      'ADMIN',
      'alert.created',
      expect.any(Object),
    );
    expect(realtimeMock.emitToUser).toHaveBeenCalledWith(
      'resident-1',
      'alert.created',
      expect.any(Object),
    );
  });

  it('NO crea duplicado si ya existe alerta LOAN_VENCIDO unread', async () => {
    prismaMock.toolLoan.findMany.mockResolvedValue([makeOverdueLoan()]);
    prismaMock.alert.findFirst.mockResolvedValue({
      id: 'existing-alert',
      type: AlertType.LOAN_VENCIDO,
      read: false,
    });

    const result = await cron.checkOverdueLoans();

    expect(result).toEqual({ scanned: 1, alertsCreated: 0 });
    expect(prismaMock.alert.create).not.toHaveBeenCalled();
  });

  it('mensaje usa singular "1 día" cuando la diferencia es 1 día', async () => {
    prismaMock.toolLoan.findMany.mockResolvedValue([
      makeOverdueLoan({
        expectedReturnAt: new Date(Date.now() - 86_400_000 - 60_000),
      }),
    ]);

    await cron.checkOverdueLoans();

    const msg = prismaMock.alert.create.mock.calls[0][0].data.message;
    expect(msg).toMatch(/\(1 día\)/);
  });

  it('omite emisión a residente cuando responsibleUserId es null', async () => {
    prismaMock.toolLoan.findMany.mockResolvedValue([
      makeOverdueLoan({
        warehouse: {
          id: 'wh-1',
          obra: { id: 'obra-1', name: 'Sin Residente', responsibleUserId: null },
        },
      }),
    ]);

    await cron.checkOverdueLoans();

    expect(realtimeMock.emitToRole).toHaveBeenCalledWith(
      'ADMIN',
      'alert.created',
      expect.any(Object),
    );
    expect(realtimeMock.emitToUser).not.toHaveBeenCalled();
  });

  it('no escanea nada si no hay préstamos vencidos', async () => {
    prismaMock.toolLoan.findMany.mockResolvedValue([]);

    const result = await cron.checkOverdueLoans();

    expect(result).toEqual({ scanned: 0, alertsCreated: 0 });
    expect(prismaMock.alert.create).not.toHaveBeenCalled();
    expect(realtimeMock.emitToRole).not.toHaveBeenCalled();
  });

  it('el query filtra por status=ACTIVE y expectedReturnAt < ahora', async () => {
    await cron.checkOverdueLoans();

    const findArgs = prismaMock.toolLoan.findMany.mock.calls[0][0];
    expect(findArgs.where.status).toBe(ToolLoanStatus.ACTIVE);
    expect(findArgs.where.expectedReturnAt).toEqual({ lt: expect.any(Date) });
  });
});
