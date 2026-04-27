import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum DocumentTypeDto {
  DNI = 'DNI',
  CE = 'CE',
  PASAPORTE = 'PASAPORTE',
}

const DOCUMENT_PATTERNS: Record<DocumentTypeDto, RegExp> = {
  [DocumentTypeDto.DNI]: /^\d{8}$/,
  [DocumentTypeDto.CE]: /^\d{9}$/,
  [DocumentTypeDto.PASAPORTE]: /^[A-Z0-9]{6,12}$/,
};

export class LoginDto {
  @ApiProperty({ enum: DocumentTypeDto, example: 'DNI' })
  @IsEnum(DocumentTypeDto)
  documentType!: DocumentTypeDto;

  @ApiProperty({ example: '12345678' })
  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @ApiProperty({ example: 'MiPassword123!' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  getDocumentPattern(): RegExp {
    return DOCUMENT_PATTERNS[this.documentType];
  }
}
