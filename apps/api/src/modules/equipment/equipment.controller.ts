import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EquipmentStatus, EquipmentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import {
  CreateEquipmentDto,
  RecordReadingDto,
  UpdateEquipmentDto,
} from './dto/equipment.dto';
import { EquipmentService } from './equipment.service';

class EquipmentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(EquipmentType)
  type?: EquipmentType;

  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @IsOptional()
  @IsString()
  obraId?: string;
}

@ApiTags('equipment')
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly service: EquipmentService) {}

  @Get()
  @RequirePermissions('equipment:read')
  findAll(@Query() query: EquipmentQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('equipment:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/readings')
  @RequirePermissions('equipment:read')
  readings(@Param('id') id: string) {
    return this.service.getCountReadings(id);
  }

  @Post()
  @RequirePermissions('equipment:create')
  create(@Body() dto: CreateEquipmentDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('equipment:update')
  update(@Param('id') id: string, @Body() dto: UpdateEquipmentDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/reading')
  @RequirePermissions('equipment:update')
  recordReading(
    @Param('id') id: string,
    @Body() dto: RecordReadingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.recordReading(id, dto, req.user.sub);
  }

  @Delete(':id')
  @RequirePermissions('equipment:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
