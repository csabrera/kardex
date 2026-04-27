import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import {
  CancelInventoryCountDto,
  CloseInventoryCountDto,
  CreateInventoryCountDto,
  QueryInventoryCountsDto,
  UpdateCountItemDto,
} from './dto/inventory-count.dto';
import { InventoryCountsService } from './inventory-counts.service';

@ApiTags('inventory-counts')
@Controller('inventory-counts')
export class InventoryCountsController {
  constructor(private readonly service: InventoryCountsService) {}

  @Get()
  @RequirePermissions('inventory:read')
  findAll(@Query() query: QueryInventoryCountsDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('inventory:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('inventory:create')
  create(@Body() dto: CreateInventoryCountDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.user.sub);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('inventory:count')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCountItemDto,
  ) {
    return this.service.updateItem(id, itemId, dto);
  }

  @Patch(':id/close')
  @RequirePermissions('inventory:close')
  close(
    @Param('id') id: string,
    @Body() dto: CloseInventoryCountDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.close(id, dto, req.user.sub);
  }

  @Patch(':id/cancel')
  @RequirePermissions('inventory:cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelInventoryCountDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cancel(id, dto, req.user.sub);
  }
}
