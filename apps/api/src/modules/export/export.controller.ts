import { Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { ExportService, ReportType } from './export.service';

const REPORT_NAMES: Record<ReportType, string> = {
  kardex: 'kardex',
  stock: 'stock',
  movements: 'movimientos',
};

@ApiTags('export')
@Controller('export')
export class ExportController {
  constructor(private readonly service: ExportService) {}

  @Post('excel')
  @RequirePermissions('items:export')
  async downloadExcel(
    @Res() res: Response,
    @Query('reportType') reportType: ReportType = 'stock',
    @Query('itemId') itemId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('type') type?: string,
  ) {
    const buffer = await this.service.generateExcel(reportType, {
      itemId,
      warehouseId,
      type,
    });
    const filename = `${REPORT_NAMES[reportType]}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post('pdf')
  @RequirePermissions('items:export')
  async queuePdf(
    @Req() req: AuthenticatedRequest,
    @Query('reportType') reportType: ReportType = 'stock',
    @Query('itemId') itemId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('type') type?: string,
  ) {
    return this.service.queuePdf(reportType, { itemId, warehouseId, type }, req.user.sub);
  }

  @Get('pdf/:jobId')
  @RequirePermissions('items:export')
  getJobStatus(@Param('jobId') jobId: string) {
    return this.service.getPdfJobStatus(jobId);
  }

  @Get('pdf/:jobId/download')
  @RequirePermissions('items:export')
  async downloadPdf(@Param('jobId') jobId: string, @Res() res: Response) {
    const filePath = await this.service.getPdfFile(jobId);
    const filename = path.basename(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(filePath).pipe(res);
  }
}
