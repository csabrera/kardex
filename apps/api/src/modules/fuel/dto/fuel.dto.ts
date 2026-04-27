import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class DispatchFuelDto {
  @ApiProperty()
  @IsString()
  equipmentId: string;

  @ApiProperty({ description: 'Ítem tipo COMBUSTIBLE' })
  @IsString()
  itemId: string;

  @ApiProperty()
  @IsString()
  warehouseId: string;

  @ApiProperty({ minimum: 0.001, description: 'Cantidad despachada (litros/galones)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({
    minimum: 0,
    description: 'Lectura del horómetro/kilometraje al momento del despacho',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  countReading: number;

  @ApiPropertyOptional({ description: 'Empleado que opera/recibe' })
  @IsOptional()
  @IsString()
  operatorWorkerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
