import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AlertType } from '@prisma/client';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get()
  @RequirePermissions('alerts:read')
  findAll(
    @Query('read') read?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('type') type?: AlertType,
  ) {
    return this.service.findAll({
      read: read === 'true' ? true : read === 'false' ? false : undefined,
      warehouseId,
      type,
    });
  }

  @Get('unread-count')
  @RequirePermissions('alerts:read')
  unreadCount() {
    return this.service.unreadCount();
  }

  @Patch(':id/read')
  @RequirePermissions('alerts:read')
  markRead(@Param('id') id: string) {
    return this.service.markRead(id);
  }

  @Patch('read-all')
  @RequirePermissions('alerts:read')
  markAllRead() {
    return this.service.markAllRead();
  }
}
