import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsOptional } from 'class-validator';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { SuppliersService } from './suppliers.service';

class SupplierQueryDto extends PaginationQueryDto {
  // `search` se hereda de PaginationQueryDto
  @IsOptional()
  @Type(() => String)
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  })
  includeInactive?: boolean;
}

@ApiTags('suppliers')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Get()
  @RequirePermissions('suppliers:read')
  findAll(@Query() query: SupplierQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('suppliers:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('suppliers:create')
  create(@Body() dto: CreateSupplierDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('suppliers:update')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('suppliers:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
