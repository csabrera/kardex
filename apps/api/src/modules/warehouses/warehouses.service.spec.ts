import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { WarehousesService } from './warehouses.service';

describe('WarehousesService', () => {
  let service: WarehousesService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      warehouse: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'wh-new', ...data })),
        update: jest
          .fn()
          .mockImplementation(({ where, data }) =>
            Promise.resolve({ id: where.id, ...data }),
          ),
      },
      obra: {
        findFirst: jest.fn().mockResolvedValue({ id: 'obra-1', deletedAt: null }),
      },
      stock: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [WarehousesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<WarehousesService>(WarehousesService);
  });

  describe('create — unicidad Almacén Principal', () => {
    it('rechaza crear un segundo CENTRAL si ya existe uno', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce({
        id: 'existing-principal',
        type: WarehouseType.CENTRAL,
        deletedAt: null,
      });
      await expect(
        service.create({
          code: 'ALM-02',
          name: 'Otro Principal',
          type: WarehouseType.CENTRAL,
        }),
      ).rejects.toMatchObject({ errorCode: 'DUPLICATE_RESOURCE' });
    });

    it('permite crear almacén OBRA cuando ya existe el Principal', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.create({
          code: 'ALM-OBR-01',
          name: 'Caseta',
          type: WarehouseType.OBRA,
          obraId: 'obra-1',
        }),
      ).resolves.toBeDefined();
    });

    it('rechaza CENTRAL con obraId', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValue(null);
      await expect(
        service.create({
          code: 'X',
          name: 'X',
          type: WarehouseType.CENTRAL,
          obraId: 'obra-1',
        }),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });

    it('rechaza OBRA sin obraId', async () => {
      await expect(
        service.create({ code: 'X', name: 'X', type: WarehouseType.OBRA }),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });

    it('rechaza código duplicado', async () => {
      prismaMock.warehouse.findUnique.mockResolvedValueOnce({
        id: 'existing',
        code: 'ALM-01',
      });
      await expect(
        service.create({
          code: 'ALM-01',
          name: 'Test',
          type: WarehouseType.OBRA,
          obraId: 'obra-1',
        }),
      ).rejects.toMatchObject({ errorCode: 'DUPLICATE_RESOURCE' });
    });
  });

  describe('update — restricciones del Principal', () => {
    it('no permite cambiar tipo de CENTRAL a OBRA', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce({
        id: 'wh-principal',
        type: WarehouseType.CENTRAL,
        deletedAt: null,
      });
      await expect(
        service.update('wh-principal', { type: WarehouseType.OBRA, obraId: 'obra-1' }),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });

    it('permite actualizar nombre del Principal', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce({
        id: 'wh-principal',
        type: WarehouseType.CENTRAL,
        deletedAt: null,
      });
      await expect(
        service.update('wh-principal', { name: 'Nuevo nombre' }),
      ).resolves.toBeDefined();
    });
  });

  describe('remove — el Principal no se elimina', () => {
    it('rechaza eliminar un almacén CENTRAL', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce({
        id: 'wh-principal',
        type: WarehouseType.CENTRAL,
        deletedAt: null,
      });
      await expect(service.remove('wh-principal')).rejects.toMatchObject({
        errorCode: 'RESOURCE_IN_USE',
      });
    });

    it('permite eliminar almacén OBRA sin stock', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce({
        id: 'wh-obra',
        type: WarehouseType.OBRA,
        deletedAt: null,
      });
      await expect(service.remove('wh-obra')).resolves.toBeDefined();
    });

    it('bloquea eliminar OBRA con stock registrado', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce({
        id: 'wh-obra',
        type: WarehouseType.OBRA,
        deletedAt: null,
      });
      prismaMock.stock.findFirst.mockResolvedValueOnce({ id: 'stock-1' });
      await expect(service.remove('wh-obra')).rejects.toMatchObject({
        errorCode: 'RESOURCE_IN_USE',
      });
    });
  });

  describe('findMain', () => {
    it('devuelve el Almacén Principal único', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce({
        id: 'wh-main',
        code: 'ALM-PRINCIPAL',
        type: WarehouseType.CENTRAL,
      });
      const result = await service.findMain();
      expect(result.code).toBe('ALM-PRINCIPAL');
    });

    it('throws si no está configurado', async () => {
      prismaMock.warehouse.findFirst.mockResolvedValueOnce(null);
      await expect(service.findMain()).rejects.toMatchObject({
        errorCode: 'WAREHOUSE_NOT_FOUND',
      });
    });
  });
});
