import { Module } from '@nestjs/common';

import { LoanOverdueCron } from './loan-overdue.cron';
import { ToolLoansController } from './tool-loans.controller';
import { ToolLoansService } from './tool-loans.service';

@Module({
  controllers: [ToolLoansController],
  providers: [ToolLoansService, LoanOverdueCron],
  exports: [ToolLoansService, LoanOverdueCron],
})
export class ToolLoansModule {}
