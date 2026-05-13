import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransferShortageReason } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  ATTACHMENTS_MAX_PER_OWNER,
  AttachmentInputDto,
} from '../../attachments/dto/attachment.dto';

export class TransferItemDto {
  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiProperty({ minimum: 0.001 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  requestedQty: number;
}

export class CreateTransferDto {
  @ApiProperty()
  @IsString()
  fromWarehouseId: string;

  @ApiProperty()
  @IsString()
  toWarehouseId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [TransferItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];

  /** true → residente debe subir al menos un Attachment antes de confirmar recepción */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresRecipientDocument?: boolean;

  /** Adjuntos (guía/boleta) que el admin ya tiene al crear la transferencia. */
  @ApiPropertyOptional({ type: [AttachmentInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ATTACHMENTS_MAX_PER_OWNER)
  @ValidateNested({ each: true })
  @Type(() => AttachmentInputDto)
  attachments?: AttachmentInputDto[];
}

export class SendTransferDto {
  @ApiProperty({ description: 'Cantidades enviadas por ítem', type: [Object] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SentItemDto)
  items: SentItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

class SentItemDto {
  @ApiProperty()
  @IsString()
  transferItemId: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sentQty: number;
}

export class ReceiveTransferDto {
  @ApiProperty({ type: [Object] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivedItemDto)
  items: ReceivedItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Motivo de excepción al recibir cuando quien actúa no es residente responsable ni almacenero',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;

  /** Adjuntos que sube el residente al recibir (si requiresRecipientDocument=true). */
  @ApiPropertyOptional({ type: [AttachmentInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ATTACHMENTS_MAX_PER_OWNER)
  @ValidateNested({ each: true })
  @Type(() => AttachmentInputDto)
  attachments?: AttachmentInputDto[];
}

class ReceivedItemDto {
  @ApiProperty()
  @IsString()
  transferItemId: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  receivedQty: number;
}

export class RejectTransferDto {
  @ApiProperty()
  @IsString()
  reason: string;

  @ApiPropertyOptional({
    description:
      'Motivo de excepción al rechazar cuando quien actúa no es residente responsable ni almacenero',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;
}

export class CancelTransferDto {
  @ApiPropertyOptional({
    description:
      'Motivo de excepción al cancelar cuando quien actúa no es residente responsable ni almacenero',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;
}

// ─── Recepción adicional sobre transferencia PARCIALMENTE_RECIBIDA ──────────

class AdditionalReceivedItemDto {
  @ApiProperty()
  @IsString()
  transferItemId: string;

  @ApiProperty({ minimum: 0.001, description: 'Cantidad adicional a sumar a esta línea' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  additionalQty: number;
}

export class ReceiveAdditionalTransferDto {
  @ApiProperty({ type: [AdditionalReceivedItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdditionalReceivedItemDto)
  items: AdditionalReceivedItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Motivo de excepción cuando quien actúa no es residente responsable ni almacenero',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;

  /** Adjuntos adicionales OPCIONALES asociados a esta remesa parcial. */
  @ApiPropertyOptional({ type: [AttachmentInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ATTACHMENTS_MAX_PER_OWNER)
  @ValidateNested({ each: true })
  @Type(() => AttachmentInputDto)
  attachments?: AttachmentInputDto[];
}

// ─── Cierre como faltante definitivo (solo admin) ──────────────────────────

export class CloseShortageDto {
  @ApiProperty({
    type: [String],
    description: 'transferItemIds en estado RECIBIDO_PARCIAL a cerrar como faltante',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  transferItemIds: string[];

  @ApiProperty({ enum: TransferShortageReason })
  @IsEnum(TransferShortageReason)
  reason: TransferShortageReason;

  @ApiPropertyOptional({ description: 'Notas adicionales sobre el cierre' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
