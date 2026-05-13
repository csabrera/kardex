import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MovementSource, MovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  ATTACHMENTS_MAX_PER_OWNER,
  AttachmentInputDto,
} from '../../attachments/dto/attachment.dto';

export class MovementItemDto {
  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiProperty({ minimum: 0.001 })
  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost?: number;
}

export class CreateMovementDto {
  @ApiProperty({ enum: MovementType })
  @IsEnum(MovementType)
  type: MovementType;

  @ApiProperty({ enum: MovementSource })
  @IsEnum(MovementSource)
  source: MovementSource;

  @ApiProperty()
  @IsString()
  warehouseId: string;

  @ApiPropertyOptional({
    description:
      'Requerido cuando source=COMPRA. Prohibido para otras fuentes (validado en el service).',
  })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [MovementItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MovementItemDto)
  items: MovementItemDto[];

  @ApiPropertyOptional({
    type: [AttachmentInputDto],
    description: `Adjuntos (guía/boleta). Solo válido si source=COMPRA. Máx ${ATTACHMENTS_MAX_PER_OWNER}.`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ATTACHMENTS_MAX_PER_OWNER)
  @ValidateNested({ each: true })
  @Type(() => AttachmentInputDto)
  attachments?: AttachmentInputDto[];
}
