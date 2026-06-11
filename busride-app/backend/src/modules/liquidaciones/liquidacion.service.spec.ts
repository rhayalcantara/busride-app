import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { LiquidacionService } from './liquidacion.service';
import { EstadoLiquidacion } from './entities/liquidacion.entity';

describe('LiquidacionService', () => {
  let service: LiquidacionService;

  const dataSourceMock = { query: jest.fn() };

  const USUARIO_ID = 'usuario-1';
  const CONDUCTOR_ID = 'conductor-1';
  const LIQUIDACION_ID = 'liquidacion-1';

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        LiquidacionService,
        { provide: getDataSourceToken(), useValue: dataSourceMock },
      ],
    }).compile();

    service = moduleRef.get(LiquidacionService);
  });

  describe('obtenerMisLiquidaciones', () => {
    it('lanza NotFoundException si el usuario no tiene perfil de conductor', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([]);

      // Act + Assert
      await expect(service.obtenerMisLiquidaciones(USUARIO_ID)).rejects.toThrow(NotFoundException);
      expect(dataSourceMock.query).toHaveBeenCalledTimes(1);
    });

    it('consulta las liquidaciones del conductor resuelto desde el JWT', async () => {
      // Arrange
      const liquidaciones = [{ id: LIQUIDACION_ID }];
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: CONDUCTOR_ID }])
        .mockResolvedValueOnce(liquidaciones);

      // Act
      const resultado = await service.obtenerMisLiquidaciones(USUARIO_ID);

      // Assert
      expect(dataSourceMock.query).toHaveBeenLastCalledWith(
        expect.stringContaining('FROM liquidaciones'),
        [CONDUCTOR_ID],
      );
      expect(resultado).toBe(liquidaciones);
    });
  });

  describe('resumenMisLiquidaciones', () => {
    it('lanza NotFoundException si el usuario no tiene perfil de conductor', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([]);

      // Act + Assert
      await expect(service.resumenMisLiquidaciones(USUARIO_ID)).rejects.toThrow(NotFoundException);
    });

    it('pasa null cuando no se especifica rango de fechas', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: CONDUCTOR_ID }])
        .mockResolvedValueOnce([{ total_viajes: 4 }]);

      // Act
      await service.resumenMisLiquidaciones(USUARIO_ID);

      // Assert
      expect(dataSourceMock.query).toHaveBeenLastCalledWith(expect.any(String), [
        CONDUCTOR_ID,
        null,
        null,
      ]);
    });

    it('filtra por periodo cuando se pasan inicio y fin', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: CONDUCTOR_ID }])
        .mockResolvedValueOnce([{ total_viajes: 2 }]);

      // Act
      await service.resumenMisLiquidaciones(USUARIO_ID, '2026-06-01', '2026-06-30');

      // Assert
      expect(dataSourceMock.query).toHaveBeenLastCalledWith(expect.any(String), [
        CONDUCTOR_ID,
        '2026-06-01',
        '2026-06-30',
      ]);
    });
  });

  describe('marcarPagada', () => {
    it('lanza NotFoundException si la liquidación no existe', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([]);

      // Act + Assert
      await expect(service.marcarPagada('no-existe', 'REF-1')).rejects.toThrow(
        new NotFoundException('Liquidación no encontrada'),
      );
    });

    it('lanza BadRequestException si ya está PAGADA', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([
        { id: LIQUIDACION_ID, estado: EstadoLiquidacion.PAGADA },
      ]);

      // Act + Assert
      await expect(service.marcarPagada(LIQUIDACION_ID, 'REF-1')).rejects.toThrow(
        new BadRequestException('La liquidación ya está marcada como pagada'),
      );
      expect(dataSourceMock.query).toHaveBeenCalledTimes(1); // no ejecuta el UPDATE
    });

    it('actualiza a PAGADA con la referencia de pago y devuelve el resumen', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: LIQUIDACION_ID, estado: EstadoLiquidacion.PENDIENTE }])
        .mockResolvedValueOnce(undefined); // UPDATE

      // Act
      const resultado = await service.marcarPagada(LIQUIDACION_ID, 'TRANSF-998');

      // Assert
      expect(dataSourceMock.query).toHaveBeenLastCalledWith(
        expect.stringContaining('UPDATE liquidaciones'),
        [EstadoLiquidacion.PAGADA, 'TRANSF-998', LIQUIDACION_ID],
      );
      expect(resultado).toEqual({
        mensaje: 'Liquidación marcada como pagada',
        liquidacionId: LIQUIDACION_ID,
        estado: EstadoLiquidacion.PAGADA,
        referenciaPago: 'TRANSF-998',
      });
    });
  });
});
