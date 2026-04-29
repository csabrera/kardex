import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { UsersService } from './users.service';

class UserQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => String)
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  })
  active?: boolean;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @RequirePermissions('users:read')
  findAll(@Query() query: UserQueryDto) {
    return this.service.findAll(query);
  }

  @Get('roles')
  @RequirePermissions('users:read')
  getRoles() {
    return this.service.getRoles();
  }

  @Get(':id')
  @RequirePermissions('users:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('users:create')
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('users:update')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/activate')
  @RequirePermissions('users:activate')
  activate(@Param('id') id: string) {
    return this.service.setActive(id, true);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('users:activate')
  deactivate(@Param('id') id: string) {
    return this.service.setActive(id, false);
  }
}
