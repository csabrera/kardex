import { BadRequestException, Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { extname, join } from 'path';
import { Public } from '../auth/decorators/public.decorator';
import { RESOLVED_UPLOADS_DIR } from './uploads-dir';

// Serve público de archivos. La subida vive en /attachments/upload — este
// controller solo expone el binario a quien tenga el filename (acceso por
// posesión del nombre, suficiente porque los filenames son hex random de 12B).
@Controller('uploads')
export class UploadsController {
  @Public()
  @Get(':filename')
  serve(@Param('filename') filename: string, @Res() res: Response) {
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Nombre de archivo inválido');
    }
    const filePath = join(RESOLVED_UPLOADS_DIR, filename);
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
