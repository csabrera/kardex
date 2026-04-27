import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreateWorkerDto, UpdateWorkerDto } from './dto/worker.dto';
import { WorkersService } from './workers.service';

class WorkerQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsOptional()
  @IsString()
  obraId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  })
  active?: boolean;
}

@ApiTags('workers')
@Controller('workers')
export class WorkersController {
  constructor(private readonly service: WorkersService) {}

  @Get()
  @RequirePermissions('workers:read')
  findAll(@Query() query: WorkerQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('workers:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('workers:create')
  create(@Body() dto: CreateWorkerDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('workers:update')
  update(@Param('id') id: string, @Body() dto: UpdateWorkerDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('workers:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
