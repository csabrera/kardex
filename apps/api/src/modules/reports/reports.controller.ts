import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
  ConsumptionByObraQueryDto,
  MovementsSummaryQueryDto,
  StockValuationQueryDto,
  TopItemsQueryDto,
} from './dto/reports-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('consumption-by-obra')
  @RequirePermissions('reports:read')
  consumptionByObra(@Query() query: ConsumptionByObraQueryDto) {
    return this.service.consumptionByObra(query);
  }

  @Get('top-items')
  @RequirePermissions('reports:read')
  topItems(@Query() query: TopItemsQueryDto) {
    return this.service.topItems(query);
  }

  @Get('stock-valuation')
  @RequirePermissions('reports:read')
  stockValuation(@Query() query: StockValuationQueryDto) {
    return this.service.stockValuation(query);
  }

  @Get('movements-summary')
  @RequirePermissions('reports:read')
  movementsSummary(@Query() query: MovementsSummaryQueryDto) {
    return this.service.movementsSummary(query);
  }
}
