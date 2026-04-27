import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { DocumentTypeDto } from './login.dto';

export class SetupDto {
  @ApiProperty({ enum: DocumentTypeDto, example: 'DNI' })
  @IsEnum(DocumentTypeDto)
  documentType!: DocumentTypeDto;

  @ApiProperty({ example: '12345678' })
  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiPropertyOptional({ example: 'admin@empresa.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'MiPassword123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'MiPassword123!' })
  @IsString()
  confirmPassword!: string;
}
