import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MovementType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { CreateMovementDto } from './dto/movement.dto';
import { MovementsService } from './movements.service';

class MovementQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  itemId?: string;
}

@ApiTags('movements')
@Controller('movements')
export class MovementsController {
  constructor(private readonly service: MovementsService) {}

  @Get()
  @RequirePermissions('movements:read')
  findAll(@Query() query: MovementQueryDto) {
    return this.service.findAll(query);
  }

  @Get('kardex/:itemId')
  @RequirePermissions('movements:read')
  kardex(@Param('itemId') itemId: string, @Query('warehouseId') warehouseId?: string) {
    return this.service.kardex(itemId, warehouseId);
  }

  @Get(':id')
  @RequirePermissions('movements:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('movements:create')
  create(@Body() dto: CreateMovementDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.user.sub);
  }
}
