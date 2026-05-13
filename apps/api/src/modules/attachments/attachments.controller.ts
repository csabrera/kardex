import {
  BadRequestException,
  Controller,
  Delete,
  Logger,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomBytes } from 'crypto';
import { diskStorage } from 'multer';
import { extname } from 'path';

import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { RESOLVED_UPLOADS_DIR } from '../uploads/uploads-dir';
import { AttachmentsService } from './attachments.service';

@Controller('attachments')
export class AttachmentsController {
  private readonly logger = new Logger(AttachmentsController.name);

  constructor(private readonly service: AttachmentsService) {}

  /**
   * Subida de UN archivo. Devuelve metadata pero NO crea fila Attachment todavía:
   * la fila se crea cuando el owner (movement/transfer) se crea, con el array
   * `attachments[]` en su DTO. Esto evita filas huérfanas si el usuario abre el
   * modal, sube un archivo y luego cancela.
   *
   * (Cleanup de archivos huérfanos en disco queda como cron posterior — ver
   * project_state.md).
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, RESOLVED_UPLOADS_DIR),
        filename: (_req, file, cb) => {
          const unique = randomBytes(12).toString('hex');
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowedMimes = /^(image\/.+|application\/pdf|application\/octet-stream)$/;
        const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
        const ext = extname(file.originalname).toLowerCase();
        if (allowedMimes.test(file.mimetype) || allowedExts.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WEBP) y PDF'), false);
        }
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    this.logger.log(`Saved: ${file.path} (${file.size} bytes)`);
    return {
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  /**
   * Borra un adjunto. Solo ADMIN o el uploader original pueden hacerlo.
   * Borra la fila DB y el archivo físico de disco.
   */
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.service.remove(id, req.user.sub, req.user.role);
    return { success: true };
  }
}
