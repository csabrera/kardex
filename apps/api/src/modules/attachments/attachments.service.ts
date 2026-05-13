import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AttachmentOwnerType, Prisma } from '@prisma/client';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

import { PrismaService } from '../../prisma/prisma.service';
import { RESOLVED_UPLOADS_DIR } from '../uploads/uploads-dir';
import { ATTACHMENTS_MAX_PER_OWNER, AttachmentInputDto } from './dto/attachment.dto';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea filas Attachment para un owner. Pensado para llamarse dentro de la
   * misma transacción que crea el owner (movements.service / transfers.service).
   *
   * NO valida la existencia del owner — eso es responsabilidad del caller que
   * acaba de crearlo. Sí valida tope y que los filenames provistos existan en
   * disco (los subió previamente vía POST /attachments/upload).
   */
  async attach(
    tx: Prisma.TransactionClient,
    ownerType: AttachmentOwnerType,
    ownerId: string,
    attachments: AttachmentInputDto[] | undefined,
    uploadedById: string,
  ): Promise<void> {
    if (!attachments || attachments.length === 0) return;

    if (attachments.length > ATTACHMENTS_MAX_PER_OWNER) {
      throw new BadRequestException(
        `Máximo ${ATTACHMENTS_MAX_PER_OWNER} adjuntos por movimiento o transferencia`,
      );
    }

    // Validar que cada filename existe físicamente — evita que un cliente envíe
    // metadata fabricada sin haber subido el archivo realmente.
    for (const a of attachments) {
      const filePath = join(RESOLVED_UPLOADS_DIR, a.filename);
      if (!existsSync(filePath)) {
        throw new BadRequestException(
          `El archivo "${a.originalName}" no se encontró en disco. Vuelve a subirlo.`,
        );
      }
    }

    await tx.attachment.createMany({
      data: attachments.map((a) => ({
        filename: a.filename,
        originalName: a.originalName,
        mimetype: a.mimetype,
        size: a.size,
        ownerType,
        ownerId,
        uploadedById,
      })),
    });
  }

  /**
   * Adjuntos ya asociados a un owner — usado para contar al recibir transferencias
   * (regla `requiresRecipientDocument`).
   */
  async countForOwner(
    tx: Prisma.TransactionClient,
    ownerType: AttachmentOwnerType,
    ownerId: string,
  ): Promise<number> {
    return tx.attachment.count({ where: { ownerType, ownerId } });
  }

  /**
   * Borra una fila Attachment + el archivo físico de disco.
   * Solo ADMIN o el uploader original pueden hacerlo.
   */
  async remove(id: string, userId: string, userRole: string): Promise<void> {
    const att = await this.prisma.attachment.findUnique({ where: { id } });
    if (!att) throw new NotFoundException('Adjunto no encontrado');

    if (userRole !== 'ADMIN' && att.uploadedById !== userId) {
      throw new ForbiddenException(
        'Solo el ADMIN o quien subió el archivo puede borrarlo',
      );
    }

    await this.prisma.attachment.delete({ where: { id } });

    // Borrar el archivo de disco después de borrar la fila (best-effort).
    try {
      const filePath = join(RESOLVED_UPLOADS_DIR, att.filename);
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch (e) {
      this.logger.warn(
        `No se pudo borrar el archivo físico ${att.filename}: ${(e as Error).message}`,
      );
    }
  }
}
