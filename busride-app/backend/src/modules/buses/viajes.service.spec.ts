import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ViajesService } from './viajes.service';
import { Viaje, EstadoViaje } from './entities/viaje.entity';

describe('ViajesService', () => {
  let service: ViajesService;

  const dataSourceMock = { query: jest.fn() };
  const viajeRepoMock = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const USUARIO_ID = 'usuario-1';
  const CONDUCTOR_ID = 'conductor-1';
  const ASIGNACION_ID = 'asignacion-1';
  const VIAJE_ID = 'viaje-1';

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ViajesService,
        { provide: getRepositoryToken(Viaje), useValue: viajeRepoMock },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = moduleRef.get(ViajesService);
  });

  describe('iniciarViaje', () => {
    it('lanza NotFoundException si el usuario no tiene perfil de conductor', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([]); // sin conductor

      // Act + Assert
      await expect(service.iniciarViaje(USUARIO_ID, ASIGNACION_ID)).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si el conductor ya tiene un viaje EN_CURSO', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([{ id: CONDUCTOR_ID }]);
      viajeRepoMock.findOne.mockResolvedValueOnce({ id: 'viaje-en-curso', estado: EstadoViaje.EN_CURSO });

      // Act + Assert
      await expect(service.iniciarViaje(USUARIO_ID, ASIGNACION_ID)).rejects.toThrow(
        new BadRequestException('El conductor ya tiene un viaje en curso'),
      );
      expect(viajeRepoMock.findOne).toHaveBeenCalledWith({
        where: { conductorId: CONDUCTOR_ID, estado: EstadoViaje.EN_CURSO },
      });
      expect(viajeRepoMock.save).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si la asignación no existe o está inactiva', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: CONDUCTOR_ID }]) // resolverConductorId
        .mockResolvedValueOnce([]); // asignación no encontrada
      viajeRepoMock.findOne.mockResolvedValueOnce(null); // sin viaje en curso

      // Act + Assert
      await expect(service.iniciarViaje(USUARIO_ID, ASIGNACION_ID)).rejects.toThrow(
        new BadRequestException('Asignación no encontrada o inactiva'),
      );
    });

    it('crea el viaje EN_CURSO con asientosDisponibles = capacidad del bus', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: CONDUCTOR_ID }])
        .mockResolvedValueOnce([
          { bus_id: 'bus-1', ruta_id: 'ruta-1', conductor_id: CONDUCTOR_ID, capacidad_total: 32 },
        ]);
      viajeRepoMock.findOne.mockResolvedValueOnce(null);
      const viajeCreado = { id: VIAJE_ID };
      viajeRepoMock.create.mockReturnValueOnce(viajeCreado);
      viajeRepoMock.save.mockResolvedValueOnce(viajeCreado);

      // Act
      const resultado = await service.iniciarViaje(USUARIO_ID, ASIGNACION_ID);

      // Assert
      expect(viajeRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conductorId: CONDUCTOR_ID,
          asignacionId: ASIGNACION_ID,
          busId: 'bus-1',
          rutaId: 'ruta-1',
          estado: EstadoViaje.EN_CURSO,
          asientosDisponibles: 32,
        }),
      );
      expect(viajeRepoMock.save).toHaveBeenCalledWith(viajeCreado);
      expect(resultado).toBe(viajeCreado);
    });

    // B2 corregido (Ola 6): iniciarViaje compara el conductor_id de la asignación
    // con el conductor autenticado y lanza 403 si no coincide (IDOR bloqueado).
    it('rechaza iniciar viaje con una asignación que pertenece a otro conductor', async () => {
      // Arrange: asignación activa pero de OTRO conductor
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: CONDUCTOR_ID }])
        .mockResolvedValueOnce([
          { bus_id: 'bus-1', ruta_id: 'ruta-1', conductor_id: 'otro-conductor', capacidad_total: 32 },
        ]);
      viajeRepoMock.findOne.mockResolvedValueOnce(null);

      // Act + Assert
      await expect(service.iniciarViaje(USUARIO_ID, 'asignacion-de-otro')).rejects.toThrow(
        ForbiddenException,
      );
      expect(viajeRepoMock.save).not.toHaveBeenCalled();
    });
  });

  describe('finalizarViaje', () => {
    it('lanza NotFoundException si el viaje no existe', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([{ id: CONDUCTOR_ID }]);
      viajeRepoMock.findOne.mockResolvedValueOnce(null);

      // Act + Assert
      await expect(service.finalizarViaje(VIAJE_ID, USUARIO_ID)).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si el viaje pertenece a otro conductor', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([{ id: CONDUCTOR_ID }]);
      viajeRepoMock.findOne.mockResolvedValueOnce({
        id: VIAJE_ID,
        conductorId: 'otro-conductor',
        estado: EstadoViaje.EN_CURSO,
      });

      // Act + Assert
      await expect(service.finalizarViaje(VIAJE_ID, USUARIO_ID)).rejects.toThrow(ForbiddenException);
      expect(dataSourceMock.query).toHaveBeenCalledTimes(1); // nunca llega al SP
    });

    it('lanza BadRequestException si el viaje no está EN_CURSO', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([{ id: CONDUCTOR_ID }]);
      viajeRepoMock.findOne.mockResolvedValueOnce({
        id: VIAJE_ID,
        conductorId: CONDUCTOR_ID,
        estado: EstadoViaje.FINALIZADO,
      });

      // Act + Assert
      await expect(service.finalizarViaje(VIAJE_ID, USUARIO_ID)).rejects.toThrow(
        new BadRequestException('Solo se puede finalizar un viaje en curso'),
      );
    });

    // B5 (Ola 6): recordset vacío del SP → error controlado, no TypeError/500
    it('lanza BadRequestException si sp_liquidar_viaje no devuelve filas', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: CONDUCTOR_ID }])
        .mockResolvedValueOnce([]); // SP sin recordset
      viajeRepoMock.findOne.mockResolvedValueOnce({
        id: VIAJE_ID,
        conductorId: CONDUCTOR_ID,
        estado: EstadoViaje.EN_CURSO,
      });

      // Act + Assert
      await expect(service.finalizarViaje(VIAJE_ID, USUARIO_ID)).rejects.toThrow(
        new BadRequestException('El procedimiento de liquidación no devolvió resultado'),
      );
    });

    it('llama sp_liquidar_viaje y devuelve el resultado de la liquidación', async () => {
      // Arrange
      const liquidacion = { exito: true, liquidacion_id: 'liq-1', monto_neto: 800 };
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: CONDUCTOR_ID }])
        .mockResolvedValueOnce([liquidacion]);
      viajeRepoMock.findOne.mockResolvedValueOnce({
        id: VIAJE_ID,
        conductorId: CONDUCTOR_ID,
        estado: EstadoViaje.EN_CURSO,
      });

      // Act
      const resultado = await service.finalizarViaje(VIAJE_ID, USUARIO_ID);

      // Assert
      expect(dataSourceMock.query).toHaveBeenCalledWith(
        expect.stringContaining('EXEC sp_liquidar_viaje'),
        [VIAJE_ID, CONDUCTOR_ID],
      );
      expect(resultado).toBe(liquidacion);
    });
  });

  describe('esConductorDelViaje', () => {
    it('devuelve true cuando el viaje pertenece al conductor del usuario', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([{ id: CONDUCTOR_ID }]);
      viajeRepoMock.findOne.mockResolvedValueOnce({ id: VIAJE_ID, conductorId: CONDUCTOR_ID });

      // Act + Assert
      await expect(service.esConductorDelViaje(VIAJE_ID, USUARIO_ID)).resolves.toBe(true);
    });

    it('devuelve false cuando el viaje es de otro conductor', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([{ id: CONDUCTOR_ID }]);
      viajeRepoMock.findOne.mockResolvedValueOnce({ id: VIAJE_ID, conductorId: 'otro-conductor' });

      // Act + Assert
      await expect(service.esConductorDelViaje(VIAJE_ID, USUARIO_ID)).resolves.toBe(false);
    });

    it('devuelve false cuando el usuario no tiene perfil de conductor', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([]);

      // Act + Assert
      await expect(service.esConductorDelViaje(VIAJE_ID, USUARIO_ID)).resolves.toBe(false);
      expect(viajeRepoMock.findOne).not.toHaveBeenCalled();
    });
  });

  describe('actualizarPosicionComoConductor', () => {
    it('lanza ForbiddenException si el viaje no pertenece al conductor autenticado', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([{ id: CONDUCTOR_ID }]);
      viajeRepoMock.findOne.mockResolvedValueOnce({ id: VIAJE_ID, conductorId: 'otro-conductor' });

      // Act + Assert
      await expect(
        service.actualizarPosicionComoConductor(VIAJE_ID, USUARIO_ID, 18.5, -69.9),
      ).rejects.toThrow(ForbiddenException);
    });

    it('actualiza la posición (geography::Point) cuando el viaje es suyo', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: CONDUCTOR_ID }])
        .mockResolvedValueOnce(undefined); // UPDATE
      viajeRepoMock.findOne.mockResolvedValueOnce({ id: VIAJE_ID, conductorId: CONDUCTOR_ID });

      // Act
      const resultado = await service.actualizarPosicionComoConductor(VIAJE_ID, USUARIO_ID, 18.5, -69.9);

      // Assert
      expect(dataSourceMock.query).toHaveBeenCalledWith(
        expect.stringContaining('geography::Point(@0, @1, 4326)'),
        [18.5, -69.9, VIAJE_ID],
      );
      expect(resultado).toMatchObject({ viajeId: VIAJE_ID, lat: 18.5, lng: -69.9 });
    });
  });
});
