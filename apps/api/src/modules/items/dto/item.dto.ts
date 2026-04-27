import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ItemType, MovementSource } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateItemDto {
  @ApiPropertyOptional({ description: 'Se auto-genera si no se proporciona' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  code?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ enum: ItemType, default: ItemType.MATERIAL })
  @IsOptional()
  @IsEnum(ItemType)
  type?: ItemType;

  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiProperty()
  @IsString()
  unitId: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxStock?: number;

  @ApiPropertyOptional({
    minimum: 0,
    description:
      'Si > 0, se crea una ENTRADA automática al Almacén Principal con esta cantidad',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialStock?: number;

  @ApiPropertyOptional({
    minimum: 0,
    description: 'Costo unitario para la ENTRADA inicial (opcional)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialUnitCost?: number;

  @ApiPropertyOptional({
    enum: MovementSource,
    description: 'Motivo del movimiento inicial. Default: COMPRA',
  })
  @IsOptional()
  @IsEnum(MovementSource)
  initialSource?: MovementSource;

  @ApiPropertyOptional({
    description:
      'Proveedor para la carga inicial. Requerido cuando initialSource=COMPRA. Si se omite, usa "Proveedor eventual - Efectivo" (code: PRV-EVENTUAL).',
  })
  @IsOptional()
  @IsString()
  initialSupplierId?: string;

  @ApiPropertyOptional({
    description: 'Nota libre para el movimiento inicial',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  initialNotes?: string;
}

export class UpdateItemDto extends PartialType(CreateItemDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
