import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { StockService } from './stock.service';

class StockQueryDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

@ApiTags('stock')
@Controller('stock')
export class StockController {
  constructor(private readonly service: StockService) {}

  @Get()
  @RequirePermissions('stock:read')
  findAll(@Query() query: StockQueryDto) {
    return this.service.findAll(query);
  }

  @Get('warehouse/:warehouseId')
  @RequirePermissions('stock:read')
  byWarehouse(
    @Param('warehouseId') warehouseId: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({ warehouseId, search });
  }

  @Get('item/:itemId')
  @RequirePermissions('stock:read')
  byItem(@Param('itemId') itemId: string) {
    return this.service.findAll({ itemId });
  }

  @Get('summary')
  @RequirePermissions('stock:read')
  summary(@Query('warehouseId') warehouseId?: string) {
    return this.service.summary(warehouseId);
  }
}
