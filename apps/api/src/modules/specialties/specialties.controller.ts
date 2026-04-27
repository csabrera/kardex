import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CreateSpecialtyDto, UpdateSpecialtyDto } from './dto/specialty.dto';
import { SpecialtiesService } from './specialties.service';

class SpecialtyQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  })
  includeInactive?: boolean;
}

@ApiTags('specialties')
@Controller('specialties')
export class SpecialtiesController {
  constructor(private readonly service: SpecialtiesService) {}

  @Get()
  @RequirePermissions('specialties:read')
  findAll(@Query() query: SpecialtyQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('specialties:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('specialties:create')
  create(@Body() dto: CreateSpecialtyDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('specialties:update')
  update(@Param('id') id: string, @Body() dto: UpdateSpecialtyDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('specialties:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
