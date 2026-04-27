import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ToolLoanCondition } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateToolLoanDto {
  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiProperty({ description: 'Almacén tipo OBRA desde donde sale la herramienta' })
  @IsString()
  warehouseId: string;

  @ApiProperty({ description: 'Estación de trabajo de la obra donde se usará' })
  @IsString()
  workStationId: string;

  @ApiProperty({ description: 'Empleado (Worker) que recibe la herramienta' })
  @IsString()
  borrowerWorkerId: string;

  @ApiProperty({ minimum: 0.001 })
  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ description: 'Fecha esperada de devolución (ISO string)' })
  @IsDateString()
  expectedReturnAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  borrowerNotes?: string;
}

export class ReturnToolLoanDto {
  @ApiProperty({ enum: ToolLoanCondition })
  @IsEnum(ToolLoanCondition)
  condition: ToolLoanCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
