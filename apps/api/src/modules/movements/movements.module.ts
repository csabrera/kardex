import { Module } from '@nestjs/common';

import { AttachmentsModule } from '../attachments/attachments.module';
import { MovementsController } from './movements.controller';
import { MovementsService } from './movements.service';

@Module({
  imports: [AttachmentsModule],
  controllers: [MovementsController],
  providers: [MovementsService],
  exports: [MovementsService],
})
export class MovementsModule {}
