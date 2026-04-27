import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { ItemsImportService } from './items-import.service';

@Module({
  imports: [MulterModule.register({ storage: memoryStorage() })],
  controllers: [ItemsController],
  providers: [ItemsService, ItemsImportService],
  exports: [ItemsService],
})
export class ItemsModule {}
