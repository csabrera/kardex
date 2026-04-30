import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { BootstrapService } from './bootstrap/bootstrap.service';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './modules/auth/guards/permissions.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EPPModule } from './modules/epp/epp.module';
import { ExportModule } from './modules/export/export.module';
import { InventoryCountsModule } from './modules/inventory-counts/inventory-counts.module';
import { ObrasModule } from './modules/obras/obras.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SpecialtiesModule } from './modules/specialties/specialties.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { ToolLoansModule } from './modules/tool-loans/tool-loans.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { UsersModule } from './modules/users/users.module';
import { WorkStationsModule } from './modules/work-stations/work-stations.module';
import { WorkersModule } from './modules/workers/workers.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { HealthModule } from './modules/health/health.module';
import { ItemsModule } from './modules/items/items.module';
import { MovementsModule } from './modules/movements/movements.module';
import { StockModule } from './modules/stock/stock.module';
import { UnitsModule } from './modules/units/units.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    WarehousesModule,
    CategoriesModule,
    UnitsModule,
    ItemsModule,
    StockModule,
    MovementsModule,
    AlertsModule,
    AuditLogsModule,
    DashboardModule,
    EPPModule,
    ExportModule,
    InventoryCountsModule,
    ReportsModule,
    TransfersModule,
    UsersModule,
    RealtimeModule,
    ToolLoansModule,
    ObrasModule,
    SpecialtiesModule,
    SuppliersModule,
    WorkersModule,
    WorkStationsModule,
  ],
  providers: [
    // Self-healing: en arranque siembra roles+permissions si la BD está vacía.
    BootstrapService,
    // Guards — order matters: JWT → Roles → Permissions
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Filters
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Interceptors
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
