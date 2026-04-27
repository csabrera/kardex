import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ObraStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreateObraDto, UpdateObraDto } from './dto/obra.dto';
import { ObrasService } from './obras.service';

class ObraQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ObraStatus)
  status?: ObraStatus;

  @IsOptional()
  @IsString()
  responsibleUserId?: string;
}

@ApiTags('obras')
@Controller('obras')
export class ObrasController {
  constructor(private readonly service: ObrasService) {}

  @Get()
  @RequirePermissions('obras:read')
  findAll(@Query() query: ObraQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('obras:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('obras:create')
  create(@Body() dto: CreateObraDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('obras:update')
  update(@Param('id') id: string, @Body() dto: UpdateObraDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('obras:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
