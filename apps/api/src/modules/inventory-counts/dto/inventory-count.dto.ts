import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { InventoryCountStatus } from '@prisma/client';

export class CreateInventoryCountDto {
  @ApiProperty({ description: 'Almacén sobre el que se hará el conteo' })
  @IsString()
  warehouseId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateCountItemDto {
  @ApiProperty({ description: 'Cantidad contada físicamente' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  countedQty: number;

  @ApiPropertyOptional({ description: 'Observación por línea' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

export class CloseInventoryCountDto {
  @ApiPropertyOptional({ description: 'Nota al cerrar el conteo' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CancelInventoryCountDto {
  @ApiPropertyOptional({ description: 'Motivo de cancelación' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class QueryInventoryCountsDto {
  @ApiPropertyOptional({ enum: InventoryCountStatus })
  @IsOptional()
  @IsEnum(InventoryCountStatus)
  status?: InventoryCountStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}
