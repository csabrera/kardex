import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AuditLogsService } from './audit-logs.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@ApiTags('audit-logs')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Get()
  @RequirePermissions('audit:read')
  findAll(@Query() query: QueryAuditLogsDto) {
    return this.service.findAll(query);
  }

  @Get('resources')
  @RequirePermissions('audit:read')
  distinctResources() {
    return this.service.distinctResources();
  }
}
