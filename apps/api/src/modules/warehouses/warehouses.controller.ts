import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WarehouseType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';
import { WarehousesService } from './warehouses.service';

class WarehouseQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(WarehouseType)
  type?: WarehouseType;

  @IsOptional()
  @IsString()
  obraId?: string;
}

@ApiTags('warehouses')
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly service: WarehousesService) {}

  @Get()
  @RequirePermissions('warehouses:read')
  findAll(@Query() query: WarehouseQueryDto) {
    return this.service.findAll(query);
  }

  @Get('main')
  @RequirePermissions('warehouses:read')
  findMain() {
    return this.service.findMain();
  }

  @Get(':id')
  @RequirePermissions('warehouses:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('warehouses:create')
  create(@Body() dto: CreateWarehouseDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('warehouses:update')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('warehouses:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
