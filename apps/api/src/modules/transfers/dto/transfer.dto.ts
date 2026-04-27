import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

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
}
