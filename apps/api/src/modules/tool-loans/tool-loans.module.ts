import { Module } from '@nestjs/common';

import { ToolLoansController } from './tool-loans.controller';
import { ToolLoansService } from './tool-loans.service';

@Module({
  controllers: [ToolLoansController],
  providers: [ToolLoansService],
  exports: [ToolLoansService],
})
export class ToolLoansModule {}
