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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ItemType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';
import { ConfirmImportDto } from './dto/import-item.dto';
import { ItemsService } from './items.service';
import { ItemsImportService } from './items-import.service';

class ItemQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ItemType)
  type?: ItemType;

  @IsOptional()
  @IsString()
  categoryId?: string;
}

@ApiTags('items')
@Controller('items')
export class ItemsController {
  constructor(
    private readonly service: ItemsService,
    private readonly importService: ItemsImportService,
  ) {}

  @Get()
  @RequirePermissions('items:read')
  findAll(@Query() query: ItemQueryDto) {
    return this.service.findAll(query);
  }

  @Get('import/template')
  @RequirePermissions('items:read')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.importService.generateTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-items.xlsx"');
    res.send(buffer);
  }

  @Post('import/preview')
  @RequirePermissions('items:create')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importPreview(@UploadedFile() file: Express.Multer.File) {
    return this.importService.preview(file.buffer);
  }

  @Post('import/confirm')
  @RequirePermissions('items:create')
  confirmImport(@Body() dto: ConfirmImportDto, @Req() req: AuthenticatedRequest) {
    return this.importService.confirmImport(dto.rows, req.user.sub);
  }

  @Get(':id')
  @RequirePermissions('items:read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('items:create')
  create(@Body() dto: CreateItemDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.user.sub);
  }

  @Patch(':id')
  @RequirePermissions('items:update')
  update(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('items:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
