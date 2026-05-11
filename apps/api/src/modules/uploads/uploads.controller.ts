import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { randomBytes } from 'crypto';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import { diskStorage } from 'multer';

// Use UPLOADS_DIR env var → Railway Volume path (/data/uploads)
// Fall back to OS temp dir which is always writable in any container
function getUploadsDir(): string {
  return process.env.UPLOADS_DIR ?? join(tmpdir(), 'kardex-uploads');
}

@Controller('uploads')
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = getUploadsDir();
          try {
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            cb(null, dir);
          } catch (err) {
            cb(err as Error, '');
          }
        },
        filename: (_req, file, cb) => {
          const unique = randomBytes(12).toString('hex');
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        // Accept by MIME type OR by extension (browsers may send application/octet-stream)
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

  @Get(':filename')
  serve(@Param('filename') filename: string, @Res() res: Response) {
    // Prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Nombre de archivo inválido');
    }
    const filePath = join(getUploadsDir(), filename);
    if (!existsSync(filePath)) {
      res.status(404).json({ message: 'Archivo no encontrado' });
      return;
    }
    createReadStream(filePath).pipe(res);
  }
}
