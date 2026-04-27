import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { AssignEPPDto, ReplaceEPPDto } from './dto/epp.dto';
import { EPPService } from './epp.service';

class EPPQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  workerId?: string;

  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  obraId?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

@ApiTags('epp')
@Controller('epp')
export class EPPController {
  constructor(private readonly service: EPPService) {}

  @Get()
  @RequirePermissions('epp:read')
  findAll(@Query() query: EPPQueryDto) {
    return this.service.findAll(query);
  }

  @Get('worker/:workerId')
  @RequirePermissions('epp:read')
  findByWorker(@Param('workerId') workerId: string) {
    return this.service.findByWorker(workerId);
  }

  @Get(':id')
  @RequirePermissions('epp:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('assign')
  @RequirePermissions('epp:assign')
  assign(@Body() dto: AssignEPPDto, @Req() req: AuthenticatedRequest) {
    return this.service.assign(dto, req.user.sub);
  }

  @Post(':id/replace')
  @RequirePermissions('epp:assign')
  replace(
    @Param('id') id: string,
    @Body() dto: ReplaceEPPDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.replace(id, dto, req.user.sub);
  }
}
