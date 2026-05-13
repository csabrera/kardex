import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Metadata de un archivo ya subido vía POST /attachments/upload.
 * Otros services (movements, transfers) lo aceptan en arrays para crear filas
 * Attachment asociadas al owner.
 */
export class AttachmentInputDto {
  @IsString()
  filename!: string;

  @IsString()
  originalName!: string;

  @IsString()
  mimetype!: string;

  @IsInt()
  @Min(0)
  size!: number;
}

export const ATTACHMENTS_MAX_PER_OWNER = 5;

/**
 * Validador reutilizable: array de adjuntos opcional, tope 5.
 */
export function attachmentsArrayDecorators() {
  return [
    IsArray(),
    ArrayMaxSize(ATTACHMENTS_MAX_PER_OWNER, {
      message: `Máximo ${ATTACHMENTS_MAX_PER_OWNER} adjuntos por movimiento o transferencia`,
    }),
    ValidateNested({ each: true }),
    Type(() => AttachmentInputDto),
  ];
}
