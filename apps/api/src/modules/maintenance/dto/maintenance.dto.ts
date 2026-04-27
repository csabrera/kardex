import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaintenanceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMaintenanceDto {
  @ApiProperty()
  @IsString()
  equipmentId: string;

  @ApiProperty({ enum: MaintenanceType })
  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  description: string;

  @ApiPropertyOptional({ description: 'Fecha programada (solo preventivo)' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({ description: 'Contador programado (horómetro/km)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  scheduledCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technicianId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class StartMaintenanceDto {
  @ApiProperty({ minimum: 0, description: 'Lectura inicial del horómetro/km' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  countAtStart: number;
}

export class AddMaintenanceItemDto {
  @ApiProperty({ description: 'Ítem usado (tipo REPUESTO o MATERIAL)' })
  @IsString()
  itemId: string;

  @ApiProperty({ description: 'Almacén de origen del repuesto' })
  @IsString()
  warehouseId: string;

  @ApiProperty({ minimum: 0.001 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompleteMaintenanceDto {
  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  countAtEnd: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelMaintenanceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  reason: string;
}
