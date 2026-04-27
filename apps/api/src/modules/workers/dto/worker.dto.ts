import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Teléfono móvil Perú: 9 dígitos que empiezan con 9.
 * Ejemplos válidos: 987654321, 901234567
 */
const PERU_MOBILE_REGEX = /^9\d{8}$/;

export class CreateWorkerDto {
  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty()
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  documentNumber: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ description: 'Celular Perú: 9 dígitos empezando con 9' })
  @IsString()
  @Matches(PERU_MOBILE_REGEX, {
    message:
      'Teléfono inválido. Debe ser celular de 9 dígitos que empiece con 9 (ej. 987654321)',
  })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty()
  @IsString()
  specialtyId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  obraId?: string;
}

export class UpdateWorkerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(PERU_MOBILE_REGEX, {
    message: 'Teléfono inválido. Debe ser celular de 9 dígitos que empiece con 9',
  })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialtyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  obraId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
