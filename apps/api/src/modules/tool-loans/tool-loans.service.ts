import { Injectable, HttpStatus } from '@nestjs/common';
import {
  ItemType,
  Prisma,
  ToolLoanCondition,
  ToolLoanStatus,
  WarehouseType,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import {
  assertOverrideReasonIfNeeded,
  assertWarehouseScope,
} from '../../common/utils/scope';
import type {
  CreateToolLoanDto,
  MarkLostToolLoanDto,
  ReturnToolLoanDto,
} from './dto/tool-loan.dto';

const TOOL_LOAN_INCLUDE = {
  item: {
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      unit: { select: { abbreviation: true } },
    },
  },
  warehouse: {
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      obra: { select: { id: true, code: true, name: true } },
    },
  },
  workStation: {
    select: { id: true, name: true, obraId: true },
  },
  borrowerWorker: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      documentType: true,
      documentNumber: true,
      phone: true,
      specialty: { select: { id: true, code: true, name: true } },
    },
  },
  loanedBy: { select: { id: true, firstName: true, lastName: true } },
  returnedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class ToolLoansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    page?: number;
    pageSize?: number;
    status?: ToolLoanStatus;
    obraId?: string;
    warehouseId?: string;
    borrowerWorkerId?: string;
    overdueOnly?: boolean;
    search?: string;
  }) {
    const {
      page = 1,
      pageSize = 20,
      status,
      obraId,
      warehouseId,
      borrowerWorkerId,
      overdueOnly,
      search,
    } = query;
    const skip = (page - 1) * pageSize;

    const andConditions: Prisma.ToolLoanWhereInput[] = [];
    if (status) andConditions.push({ status });
    if (warehouseId) andConditions.push({ warehouseId });
    if (obraId) andConditions.push({ warehouse: { obraId } });
    if (borrowerWorkerId) andConditions.push({ borrowerWorkerId });
    if (overdueOnly) {
      andConditions.push({
        status: ToolLoanStatus.ACTIVE,
        expectedReturnAt: { lt: new Date() },
      });
    }
    if (search) {
      andConditions.push({
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          {
            item: {
              OR: [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
          {
            borrowerWorker: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { documentNumber: { contains: search } },
              ],
            },
          },
        ],
      });
    }

    const where: Prisma.ToolLoanWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const [items, total] = await Promise.all([
      this.prisma.toolLoan.findMany({
        where,
        include: TOOL_LOAN_INCLUDE,
        orderBy: [{ status: 'asc' }, { expectedReturnAt: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.toolLoan.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const loan = await this.prisma.toolLoan.findUnique({
      where: { id },
      include: TOOL_LOAN_INCLUDE,
    });
    if (!loan) {
      throw new BusinessException(
        BusinessErrorCode.TOOL_LOAN_NOT_FOUND,
        'Préstamo no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return loan;
  }

  async create(dto: CreateToolLoanDto, userId: string) {
    // 0. Si es RESIDENTE, validar que el almacén sea de su obra
    await assertWarehouseScope(this.prisma, userId, dto.warehouseId);

    // 1. Validar item
    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, deletedAt: null, active: true },
    });
    if (!item) {
      throw new BusinessException(
        BusinessErrorCode.ITEM_NOT_FOUND,
        'Ítem no encontrado o inactivo',
        HttpStatus.NOT_FOUND,
      );
    }
    if (item.type !== ItemType.PRESTAMO) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Solo se pueden prestar ítems de categoría tipo Préstamo',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 2. Validar almacén — debe ser tipo OBRA (no CENTRAL)
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, deletedAt: null, active: true },
    });
    if (!warehouse) {
      throw new BusinessException(
        BusinessErrorCode.WAREHOUSE_NOT_FOUND,
        'Almacén no encontrado o inactivo',
        HttpStatus.NOT_FOUND,
      );
    }
    if (warehouse.type !== WarehouseType.OBRA) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Los préstamos solo se pueden hacer desde un Almacén de Obra (no desde Central)',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!warehouse.obraId) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El almacén de obra no tiene obra asociada (inconsistencia de datos)',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Validar estación de trabajo — debe pertenecer a la misma obra del almacén
    const workStation = await this.prisma.workStation.findFirst({
      where: { id: dto.workStationId, deletedAt: null, active: true },
    });
    if (!workStation) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Estación de trabajo no encontrada o inactiva',
        HttpStatus.NOT_FOUND,
      );
    }
    if (workStation.obraId !== warehouse.obraId) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'La estación de trabajo no pertenece a la obra del almacén',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 4. Validar empleado — debe estar activo y pertenecer a la misma obra
    const worker = await this.prisma.worker.findFirst({
      where: { id: dto.borrowerWorkerId, deletedAt: null, active: true },
    });
    if (!worker) {
      throw new BusinessException(
        BusinessErrorCode.WORKER_NOT_FOUND,
        'Empleado no encontrado o inactivo',
        HttpStatus.NOT_FOUND,
      );
    }
    if (worker.obraId && worker.obraId !== warehouse.obraId) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El empleado está asignado a otra obra distinta',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 5. Validar fecha
    const expectedReturnAt = new Date(dto.expectedReturnAt);
    if (isNaN(expectedReturnAt.getTime())) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Fecha esperada de devolución inválida',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (expectedReturnAt.getTime() < Date.now() - 60_000) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'La fecha esperada de devolución no puede ser pasada',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 6. Validar stock disponible = stock - préstamos activos
    const [stock, activeLoans] = await Promise.all([
      this.prisma.stock.findUnique({
        where: {
          itemId_warehouseId: { itemId: dto.itemId, warehouseId: dto.warehouseId },
        },
      }),
      this.prisma.toolLoan.aggregate({
        where: {
          itemId: dto.itemId,
          warehouseId: dto.warehouseId,
          status: ToolLoanStatus.ACTIVE,
        },
        _sum: { quantity: true },
      }),
    ]);

    const totalQty = Number(stock?.quantity ?? 0);
    const lentQty = Number(activeLoans._sum.quantity ?? 0);
    const available = totalQty - lentQty;

    if (dto.quantity > available) {
      throw new BusinessException(
        BusinessErrorCode.TOOL_ALREADY_LOANED,
        `Cantidad solicitada (${dto.quantity}) excede disponible (${available}). Total: ${totalQty}, prestados: ${lentQty}.`,
        HttpStatus.CONFLICT,
      );
    }

    // 7. Validar motivo de excepción si quien crea no es residente responsable ni almacenero
    await assertOverrideReasonIfNeeded(
      this.prisma,
      userId,
      warehouse.obraId,
      dto.overrideReason,
    );

    // 8. Generar código y crear préstamo
    const seq = await this.prisma.toolLoanSequence.upsert({
      where: { id: 1 },
      update: { lastValue: { increment: 1 } },
      create: { id: 1, lastValue: 1 },
    });
    const code = `PRT-${String(seq.lastValue).padStart(5, '0')}`;

    return this.prisma.toolLoan.create({
      data: {
        code,
        itemId: dto.itemId,
        warehouseId: dto.warehouseId,
        workStationId: dto.workStationId,
        borrowerWorkerId: dto.borrowerWorkerId,
        quantity: dto.quantity,
        expectedReturnAt,
        borrowerNotes: dto.borrowerNotes,
        overrideReason: dto.overrideReason?.trim() || null,
        loanedById: userId,
      },
      include: TOOL_LOAN_INCLUDE,
    });
  }

  async returnLoan(id: string, dto: ReturnToolLoanDto, userId: string) {
    const loan = await this.findOne(id);
    await assertWarehouseScope(this.prisma, userId, loan.warehouseId);

    if (loan.status !== ToolLoanStatus.ACTIVE) {
      throw new BusinessException(
        BusinessErrorCode.TOOL_LOAN_NOT_FOUND,
        `No se puede devolver un préstamo en estado ${loan.status}`,
        HttpStatus.CONFLICT,
      );
    }

    if (!loan.warehouse.obra?.id) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El almacén del préstamo no tiene obra asociada',
        HttpStatus.BAD_REQUEST,
      );
    }
    await assertOverrideReasonIfNeeded(
      this.prisma,
      userId,
      loan.warehouse.obra.id,
      dto.overrideReason,
    );

    return this.prisma.toolLoan.update({
      where: { id },
      data: {
        status: ToolLoanStatus.RETURNED,
        returnedAt: new Date(),
        returnedById: userId,
        returnCondition: dto.condition,
        returnNotes: dto.notes,
        returnOverrideReason: dto.overrideReason?.trim() || null,
      },
      include: TOOL_LOAN_INCLUDE,
    });
  }

  async markLost(id: string, dto: MarkLostToolLoanDto, userId: string) {
    const loan = await this.findOne(id);
    await assertWarehouseScope(this.prisma, userId, loan.warehouseId);
    if (loan.status !== ToolLoanStatus.ACTIVE) {
      throw new BusinessException(
        BusinessErrorCode.TOOL_LOAN_NOT_FOUND,
        'Solo préstamos activos pueden marcarse como perdidos',
        HttpStatus.CONFLICT,
      );
    }

    if (!loan.warehouse.obra?.id) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El almacén del préstamo no tiene obra asociada',
        HttpStatus.BAD_REQUEST,
      );
    }
    await assertOverrideReasonIfNeeded(
      this.prisma,
      userId,
      loan.warehouse.obra.id,
      dto.overrideReason,
    );

    return this.prisma.toolLoan.update({
      where: { id },
      data: {
        status: ToolLoanStatus.LOST,
        returnedAt: new Date(),
        returnedById: userId,
        returnCondition: ToolLoanCondition.DAMAGED,
        returnNotes: 'Marcado como perdido',
        returnOverrideReason: dto.overrideReason?.trim() || null,
      },
      include: TOOL_LOAN_INCLUDE,
    });
  }

  async findOverdue() {
    return this.prisma.toolLoan.findMany({
      where: { status: ToolLoanStatus.ACTIVE, expectedReturnAt: { lt: new Date() } },
      include: TOOL_LOAN_INCLUDE,
      orderBy: { expectedReturnAt: 'asc' },
    });
  }

  async summary(warehouseId?: string) {
    const where: Prisma.ToolLoanWhereInput = {
      ...(warehouseId && { warehouseId }),
    };
    const [active, overdue, returned, lost] = await Promise.all([
      this.prisma.toolLoan.count({ where: { ...where, status: ToolLoanStatus.ACTIVE } }),
      this.prisma.toolLoan.count({
        where: {
          ...where,
          status: ToolLoanStatus.ACTIVE,
          expectedReturnAt: { lt: new Date() },
        },
      }),
      this.prisma.toolLoan.count({
        where: { ...where, status: ToolLoanStatus.RETURNED },
      }),
      this.prisma.toolLoan.count({ where: { ...where, status: ToolLoanStatus.LOST } }),
    ]);
    return { active, overdue, returned, lost };
  }
}
