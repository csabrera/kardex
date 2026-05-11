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
import {
  accessSync,
  constants,
  createReadStream,
  existsSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import { diskStorage } from 'multer';
import { Public } from '../auth/decorators/public.decorator';

// Resolve upload directory once at startup.
// 1st choice: UPLOADS_DIR env var (Railway Volume mount path, e.g. /data/uploads)
// 2nd choice: OS temp dir — always writable in any container
//
// NOTE: existsSync is not enough — Railway mounts volumes as root:root (755).
// We test actual write access so we can fall back before multer hits EACCES.
function isWritable(dir: string): boolean {
  try {
    // Ensure directory exists
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // Verify write permission (accessSync throws if the process cannot write)
    accessSync(dir, constants.W_OK);
    // Double-check with an actual file write (some network filesystems lie)
    const probe = join(dir, `.write_probe_${process.pid}`);
    writeFileSync(probe, '');
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

const RESOLVED_DIR = (() => {
  const candidates = [
    process.env.UPLOADS_DIR,
    join(tmpdir(), 'kardex-uploads'),
    tmpdir(),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    if (isWritable(dir)) return dir;
  }
  return tmpdir(); // should never reach here
})();

const logger = new Logger('UploadsController');
logger.log(`Upload directory: ${RESOLVED_DIR}`);

@Controller('uploads')
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, RESOLVED_DIR),
        filename: (_req, file, cb) => {
          const unique = randomBytes(12).toString('hex');
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        // Accept by MIME type OR by extension (some browsers send application/octet-stream)
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

  @Public()
  @Get(':filename')
  serve(@Param('filename') filename: string, @Res() res: Response) {
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Nombre de archivo inválido');
    }
    const filePath = join(RESOLVED_DIR, filename);
    if (!existsSync(filePath)) {
      res.status(404).json({ message: 'Archivo no encontrado' });
      return;
    }
    const ext = extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const contentType = mimeTypes[ext] ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    createReadStream(filePath).pipe(res);
  }
}
