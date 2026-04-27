import { Module } from '@nestjs/common';

import { RealtimeModule } from '../realtime/realtime.module';
import { FuelController } from './fuel.controller';
import { FuelService } from './fuel.service';

@Module({
  imports: [RealtimeModule],
  controllers: [FuelController],
  providers: [FuelService],
  exports: [FuelService],
})
export class FuelModule {}
