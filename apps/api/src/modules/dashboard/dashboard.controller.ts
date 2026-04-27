import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('stats')
  @RequirePermissions('items:read')
  getStats() {
    return this.service.getStats();
  }
}
