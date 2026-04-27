import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DocumentTypeDto } from './login.dto';

export class ForgotPasswordDto {
  @ApiProperty({ enum: DocumentTypeDto, example: 'DNI' })
  @IsEnum(DocumentTypeDto)
  documentType!: DocumentTypeDto;

  @ApiProperty({ example: '12345678' })
  @IsString()
  @IsNotEmpty()
  documentNumber!: string;
}
