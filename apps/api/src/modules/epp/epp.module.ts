import { Module } from '@nestjs/common';

import { RealtimeModule } from '../realtime/realtime.module';
import { EPPController } from './epp.controller';
import { EPPService } from './epp.service';

@Module({
  imports: [RealtimeModule],
  controllers: [EPPController],
  providers: [EPPService],
  exports: [EPPService],
})
export class EPPModule {}
