import { Module } from '@nestjs/common';

import { WorkStationsController } from './work-stations.controller';
import { WorkStationsService } from './work-stations.service';

@Module({
  controllers: [WorkStationsController],
  providers: [WorkStationsService],
  exports: [WorkStationsService],
})
export class WorkStationsModule {}
