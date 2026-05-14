import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const CONTRACT_DURATIONS = [3, 6, 12] as const;
export type ContractDuration = (typeof CONTRACT_DURATIONS)[number];

export class CreateUserDto {
  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty()
  @IsString()
  documentNumber: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  paternalLastName: string;

  @ApiPropertyOptional({
    description: 'Opcional para CE/Pasaporte. Backend valida obligatorio si DNI.',
  })
  @IsOptional()
  @IsString()
  maternalLastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty()
  @IsString()
  roleId: string;

  @ApiPropertyOptional({
    description:
      'Duración del contrato en meses (3, 6 o 12). Si se omite, sin fecha de vencimiento.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(CONTRACT_DURATIONS as unknown as number[])
  contractDurationMonths?: ContractDuration;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paternalLastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maternalLastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roleId?: string;
}

export class RenewContractDto {
  @ApiProperty({
    description: 'Duración de la nueva ventana de contrato en meses (3, 6 o 12).',
  })
  @Type(() => Number)
  @IsInt()
  @IsIn(CONTRACT_DURATIONS as unknown as number[])
  months: ContractDuration;
}
