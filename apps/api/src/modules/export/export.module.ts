import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { ExportController } from './export.controller';
import { ExportService, EXPORT_QUEUE } from './export.service';
import { PdfProcessor } from './pdf.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('redis.url') ?? 'redis://localhost:6379';
        return { url };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: EXPORT_QUEUE }),
  ],
  controllers: [ExportController],
  providers: [ExportService, PdfProcessor],
  exports: [ExportService],
})
export class ExportModule {}
