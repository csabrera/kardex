import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MaintenanceStatus, MaintenanceType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import {
  AddMaintenanceItemDto,
  CancelMaintenanceDto,
  CompleteMaintenanceDto,
  CreateMaintenanceDto,
  StartMaintenanceDto,
} from './dto/maintenance.dto';
import { MaintenanceService } from './maintenance.service';

class MaintenanceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  equipmentId?: string;

  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @IsOptional()
  @IsEnum(MaintenanceType)
  type?: MaintenanceType;
}

@ApiTags('maintenance')
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get()
  @RequirePermissions('maintenance:read')
  findAll(@Query() query: MaintenanceQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('maintenance:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('maintenance:create')
  create(@Body() dto: CreateMaintenanceDto) {
    return this.service.create(dto);
  }

  @Patch(':id/start')
  @RequirePermissions('maintenance:update')
  start(@Param('id') id: string, @Body() dto: StartMaintenanceDto) {
    return this.service.start(id, dto);
  }

  @Post(':id/items')
  @RequirePermissions('maintenance:update')
  addItem(
    @Param('id') id: string,
    @Body() dto: AddMaintenanceItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.addItem(id, dto, req.user.sub);
  }

  @Patch(':id/complete')
  @RequirePermissions('maintenance:update')
  complete(@Param('id') id: string, @Body() dto: CompleteMaintenanceDto) {
    return this.service.complete(id, dto);
  }

  @Patch(':id/cancel')
  @RequirePermissions('maintenance:update')
  cancel(@Param('id') id: string, @Body() dto: CancelMaintenanceDto) {
    return this.service.cancel(id, dto);
  }
}
