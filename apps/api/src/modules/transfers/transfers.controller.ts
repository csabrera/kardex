import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TransferStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import {
  CreateTransferDto,
  ReceiveTransferDto,
  RejectTransferDto,
} from './dto/transfer.dto';
import { TransfersService } from './transfers.service';

class TransferQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TransferStatus)
  status?: TransferStatus;

  @IsOptional()
  @IsString()
  warehouseId?: string;
}

@ApiTags('transfers')
@Controller('transfers')
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  @Get()
  @RequirePermissions('transfers:read')
  findAll(@Query() query: TransferQueryDto) {
    return this.service.findAll(query);
  }

  /** Transferencias pendientes de confirmación para el usuario actual. */
  @Get('pending-for-me')
  @RequirePermissions('transfers:read')
  findPendingForMe(@Req() req: AuthenticatedRequest) {
    return this.service.findPendingForUser(req.user.sub);
  }

  @Get(':id')
  @RequirePermissions('transfers:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('transfers:create')
  create(@Body() dto: CreateTransferDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.user.sub);
  }

  @Patch(':id/receive')
  @RequirePermissions('transfers:receive')
  receive(
    @Param('id') id: string,
    @Body() dto: ReceiveTransferDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.receive(id, dto, req.user.sub);
  }

  @Patch(':id/reject')
  @RequirePermissions('transfers:reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectTransferDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.reject(id, dto, req.user.sub);
  }

  @Patch(':id/cancel')
  @RequirePermissions('transfers:cancel')
  cancel(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.cancel(id, req.user.sub);
  }
}
