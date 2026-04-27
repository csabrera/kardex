import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CountType, EquipmentStatus, EquipmentType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEquipmentDto {
  @ApiPropertyOptional({ description: 'Se auto-genera si no se proporciona' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  code?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ enum: EquipmentType, default: EquipmentType.OTRO })
  @IsOptional()
  @IsEnum(EquipmentType)
  type?: EquipmentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  year?: number;

  @ApiPropertyOptional({ enum: CountType, default: CountType.HOROMETRO })
  @IsOptional()
  @IsEnum(CountType)
  countType?: CountType;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  initialCountDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  acquisitionCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  obraId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEquipmentDto extends PartialType(CreateEquipmentDto) {
  @ApiPropertyOptional({ enum: EquipmentStatus })
  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;
}

export class RecordReadingDto {
  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  countValue: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
