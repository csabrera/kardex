import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ToolLoanStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { CreateToolLoanDto, ReturnToolLoanDto } from './dto/tool-loan.dto';
import { ToolLoansService } from './tool-loans.service';

class ToolLoanQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ToolLoanStatus)
  status?: ToolLoanStatus;

  @IsOptional()
  @IsString()
  obraId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  borrowerWorkerId?: string;

  @IsOptional()
  @Type(() => String)
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  })
  overdueOnly?: boolean;
}

@ApiTags('tool-loans')
@Controller('tool-loans')
export class ToolLoansController {
  constructor(private readonly service: ToolLoansService) {}

  @Get()
  @RequirePermissions('tools:read')
  findAll(@Query() query: ToolLoanQueryDto) {
    return this.service.findAll(query);
  }

  @Get('summary')
  @RequirePermissions('tools:read')
  summary(@Query('warehouseId') warehouseId?: string) {
    return this.service.summary(warehouseId);
  }

  @Get('overdue')
  @RequirePermissions('tools:read')
  overdue() {
    return this.service.findOverdue();
  }

  @Get(':id')
  @RequirePermissions('tools:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('tools:loan')
  create(@Body() dto: CreateToolLoanDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.user.sub);
  }

  @Patch(':id/return')
  @RequirePermissions('tools:return')
  returnLoan(
    @Param('id') id: string,
    @Body() dto: ReturnToolLoanDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.returnLoan(id, dto, req.user.sub);
  }

  @Patch(':id/mark-lost')
  @RequirePermissions('tools:return')
  markLost(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.markLost(id, req.user.sub);
  }
}
