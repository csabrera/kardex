import { Test, TestingModule } from '@nestjs/testing';

import { LoanOverdueCron } from './loan-overdue.cron';
import { ToolLoansController } from './tool-loans.controller';
import { ToolLoansService } from './tool-loans.service';

describe('ToolLoansController', () => {
  let controller: ToolLoansController;
  let cronMock: jest.Mocked<LoanOverdueCron>;

  beforeEach(async () => {
    cronMock = {
      checkOverdueLoans: jest.fn(),
    } as unknown as jest.Mocked<LoanOverdueCron>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ToolLoansController],
      providers: [
        { provide: ToolLoansService, useValue: {} },
        { provide: LoanOverdueCron, useValue: cronMock },
      ],
    }).compile();

    controller = module.get(ToolLoansController);
  });

  describe('POST /tool-loans/admin/check-overdue', () => {
    it('delega a LoanOverdueCron.checkOverdueLoans y devuelve su resultado', async () => {
      cronMock.checkOverdueLoans.mockResolvedValue({ scanned: 3, alertsCreated: 1 });

      await expect(controller.checkOverdueManually()).resolves.toEqual({
        scanned: 3,
        alertsCreated: 1,
      });
      expect(cronMock.checkOverdueLoans).toHaveBeenCalledTimes(1);
    });

    it('requiere permiso system:configure', () => {
      const required = Reflect.getMetadata(
        'permissions',
        ToolLoansController.prototype.checkOverdueManually,
      );
      expect(required).toEqual(['system:configure']);
    });
  });
});
