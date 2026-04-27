import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';
import { UnitsService } from './units.service';

@ApiTags('units')
@Controller('units')
export class UnitsController {
  constructor(private readonly service: UnitsService) {}

  @Get()
  @RequirePermissions('units:read')
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('units:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('units:create')
  create(@Body() dto: CreateUnitDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('units:update')
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('units:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
