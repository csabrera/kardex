import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ItemType } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImportItemRowDto {
  @ApiProperty()
  @IsNumber()
  row: number;

  @ApiPropertyOptional({ description: 'Opcional; se auto-genera si viene vacío' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: ItemType })
  @IsEnum(ItemType)
  type: ItemType;

  @ApiProperty()
  @IsString()
  categoryCode: string;

  @ApiProperty()
  @IsString()
  unitCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxStock?: number;

  @ApiPropertyOptional({
    description: 'Cantidad inicial que ingresa al Almacén Principal',
  })
  @IsOptional()
  @IsNumber()
  stockInicial?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class ImportPreviewRowDto {
  row: number;
  code?: string;
  name: string;
  type: string;
  categoryCode: string;
  unitCode: string;
  minStock?: number;
  maxStock?: number;
  stockInicial?: number;
  description?: string;
  valid: boolean;
  errors: string[];
}

export class ConfirmImportDto {
  @ApiProperty({ type: [ImportItemRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportItemRowDto)
  rows: ImportItemRowDto[];
}
