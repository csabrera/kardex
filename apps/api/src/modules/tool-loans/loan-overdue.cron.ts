import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AlertType, ToolLoanStatus } from '@prisma/client';
import { WS_EVENTS } from '@kardex/types';

import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

/**
 * Cron diario que detecta préstamos vencidos y emite alertas LOAN_VENCIDO.
 *
 * Reglas:
 *  - Un préstamo está vencido si: status=ACTIVE AND expectedReturnAt < ahora.
 *  - Para cada préstamo vencido sin alerta unread previa, crea una Alert
 *    LOAN_VENCIDO + emite ALERT_CREATED por WebSocket a admin + residente
 *    responsable de la obra del almacén.
 *  - Dedup: si ya existe Alert LOAN_VENCIDO no leída para ese toolLoanId, se
 *    omite (evita duplicar día tras día).
 *
 * Cadencia: diaria, 08:00 Lima (America/Lima).
 *
 * Idempotente — re-ejecutar el mismo día no crea duplicados gracias al
 * findFirst de dedup. En entornos multi-instancia hay una ventana de carrera
 * estrecha pero aceptable (la cron corre solo unos segundos por día).
 */
@Injectable()
export class LoanOverdueCron {
  private readonly logger = new Logger(LoanOverdueCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'America/Lima', name: 'loan-overdue-daily' })
  async runDailyCheck(): Promise<void> {
    await this.checkOverdueLoans();
  }

  /**
   * Ejecuta la verificación. Expuesto público para testing y para disparar
   * manualmente desde un controller admin si se quiere correr fuera del horario.
   */
  async checkOverdueLoans(): Promise<{ scanned: number; alertsCreated: number }> {
    const now = new Date();
    const overdueLoans = await this.prisma.toolLoan.findMany({
      where: {
        status: ToolLoanStatus.ACTIVE,
        expectedReturnAt: { lt: now },
      },
      include: {
        item: { select: { id: true, code: true, name: true } },
        warehouse: {
          select: {
            id: true,
            obra: { select: { id: true, name: true, responsibleUserId: true } },
          },
        },
        borrowerWorker: {
          select: { firstName: true, paternalLastName: true, maternalLastName: true },
        },
      },
    });

    let alertsCreated = 0;
    for (const loan of overdueLoans) {
      const existing = await this.prisma.alert.findFirst({
        where: {
          toolLoanId: loan.id,
          type: AlertType.LOAN_VENCIDO,
          read: false,
        },
      });
      if (existing) continue;

      const daysOverdue = Math.floor(
        (now.getTime() - loan.expectedReturnAt.getTime()) / 86_400_000,
      );
      const borrowerName = [
        loan.borrowerWorker.firstName,
        loan.borrowerWorker.paternalLastName,
        loan.borrowerWorker.maternalLastName,
      ]
        .filter(Boolean)
        .join(' ');

      const alert = await this.prisma.alert.create({
        data: {
          type: AlertType.LOAN_VENCIDO,
          itemId: loan.itemId,
          warehouseId: loan.warehouseId,
          toolLoanId: loan.id,
          message: `Préstamo vencido: ${loan.item.name} a ${borrowerName} (${daysOverdue} día${daysOverdue === 1 ? '' : 's'})`,
        },
        include: {
          item: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: { select: { abbreviation: true } },
            },
          },
          warehouse: { select: { id: true, code: true, name: true } },
          toolLoan: {
            select: {
              id: true,
              code: true,
              expectedReturnAt: true,
              borrowerWorker: {
                select: {
                  firstName: true,
                  paternalLastName: true,
                  maternalLastName: true,
                },
              },
            },
          },
        },
      });

      this.realtime.emitToRole('ADMIN', WS_EVENTS.ALERT_CREATED, alert);
      // Los préstamos viven en almacenes de obra; warehouse.obra solo es null
      // para almacenes CENTRAL (que no prestan herramientas), por lo que en
      // la práctica el residente siempre existe.
      const responsibleUserId = loan.warehouse.obra?.responsibleUserId;
      if (responsibleUserId) {
        this.realtime.emitToUser(responsibleUserId, WS_EVENTS.ALERT_CREATED, alert);
      }

      alertsCreated++;
    }

    if (alertsCreated > 0) {
      this.logger.log(
        `Préstamos vencidos: ${overdueLoans.length} escaneados, ${alertsCreated} alertas nuevas`,
      );
    }
    return { scanned: overdueLoans.length, alertsCreated };
  }
}
