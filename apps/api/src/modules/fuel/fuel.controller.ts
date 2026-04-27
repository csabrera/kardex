import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { DispatchFuelDto } from './dto/fuel.dto';
import { FuelService } from './fuel.service';

class FuelQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  equipmentId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

class SummaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  days?: number;
}

@ApiTags('fuel')
@Controller('fuel')
export class FuelController {
  constructor(private readonly service: FuelService) {}

  @Get()
  @RequirePermissions('fuel:read')
  findAll(@Query() query: FuelQueryDto) {
    return this.service.findAll(query);
  }

  @Get('summary')
  @RequirePermissions('fuel:read')
  summary(@Query() query: SummaryQueryDto) {
    return this.service.consumptionSummary(query.days ?? 30);
  }

  @Get(':id')
  @RequirePermissions('fuel:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('dispatch')
  @RequirePermissions('fuel:create')
  dispatch(@Body() dto: DispatchFuelDto, @Req() req: AuthenticatedRequest) {
    return this.service.dispatch(dto, req.user.sub);
  }
}
