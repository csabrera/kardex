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
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { CreateWorkStationDto, UpdateWorkStationDto } from './dto/work-station.dto';
import { WorkStationsService } from './work-stations.service';

class WorkStationQueryDto {
  @IsOptional()
  @IsString()
  obraId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => String)
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  })
  includeInactive?: boolean;
}

@ApiTags('work-stations')
@Controller('work-stations')
export class WorkStationsController {
  constructor(private readonly service: WorkStationsService) {}

  @Get()
  @RequirePermissions('work-stations:read')
  findAll(@Query() query: WorkStationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('work-stations:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('work-stations:create')
  create(@Body() dto: CreateWorkStationDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.user.sub);
  }

  @Patch(':id')
  @RequirePermissions('work-stations:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkStationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  @RequirePermissions('work-stations:delete')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.remove(id, req.user.sub);
  }
}
