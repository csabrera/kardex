import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReplacementReason } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AssignEPPDto {
  @ApiProperty({ description: 'Empleado que recibe el EPP' })
  @IsString()
  workerId: string;

  @ApiProperty({ description: 'Ítem (debe ser tipo EPP)' })
  @IsString()
  itemId: string;

  @ApiProperty({ description: 'Almacén de obra donde se descuenta el stock' })
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
  @MaxLength(500)
  notes?: string;
}

export class ReplaceEPPDto {
  @ApiProperty({ minimum: 0.001 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({ enum: ReplacementReason })
  @IsEnum(ReplacementReason)
  reason: ReplacementReason;

  @ApiProperty({ description: 'Almacén de obra donde se descuenta el stock' })
  @IsString()
  warehouseId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
