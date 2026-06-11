import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConductoresService } from './conductores.service';
import { Conductor } from './entities/conductor.entity';
import { Calificacion } from './entities/calificacion.entity';
import { CalificarConductorDto } from './dto/calificar-conductor.dto';
import { CrearConductorDto } from './dto/crear-conductor.dto';

describe('ConductoresService', () => {
  let service: ConductoresService;

  const conductorRepoMock = { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn() };
  const calificacionRepoMock = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const dataSourceMock = { query: jest.fn() };

  const CONDUCTOR_ID = 'conductor-1';
  const USUARIO_ID = 'usuario-pasajero';
  const PASAJERO_ID = 'pasajero-1';
  const ABORDAJE_ID = 'abordaje-1';

  const dtoCalificar: CalificarConductorDto = {
    viajeId: 'viaje-1',
    estrellas: 5,
    comentario: 'Excelente conducción',
  } as CalificarConductorDto;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConductoresService,
        { provide: getRepositoryToken(Conductor), useValue: conductorRepoMock },
        { provide: getRepositoryToken(Calificacion), useValue: calificacionRepoMock },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = moduleRef.get(ConductoresService);
  });

  describe('calificar', () => {
    it('lanza NotFoundException si el conductor no existe', async () => {
      // Arrange
      conductorRepoMock.findOne.mockResolvedValueOnce(null);

      // Act + Assert
      await expect(service.calificar('no-existe', USUARIO_ID, dtoCalificar)).rejects.toThrow(
        new NotFoundException('El conductor indicado no existe'),
      );
    });

    it('lanza NotFoundException si el usuario no tiene perfil de pasajero', async () => {
      // Arrange
      conductorRepoMock.findOne.mockResolvedValueOnce({ id: CONDUCTOR_ID });
      dataSourceMock.query.mockResolvedValueOnce([]); // sin pasajero

      // Act + Assert
      await expect(service.calificar(CONDUCTOR_ID, USUARIO_ID, dtoCalificar)).rejects.toThrow(
        new NotFoundException('No existe un perfil de pasajero para el usuario autenticado'),
      );
    });

    it('lanza BadRequestException si el pasajero no abordó ese viaje con ese conductor', async () => {
      // Arrange
      conductorRepoMock.findOne.mockResolvedValueOnce({ id: CONDUCTOR_ID });
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: PASAJERO_ID }]) // pasajero existe
        .mockResolvedValueOnce([]); // sin abordaje

      // Act + Assert
      await expect(service.calificar(CONDUCTOR_ID, USUARIO_ID, dtoCalificar)).rejects.toThrow(
        BadRequestException,
      );
      // La búsqueda del abordaje cruza pasajero + viaje + conductor
      expect(dataSourceMock.query).toHaveBeenLastCalledWith(
        expect.stringContaining('FROM abordajes'),
        [PASAJERO_ID, dtoCalificar.viajeId, CONDUCTOR_ID],
      );
    });

    it('lanza ConflictException si el abordaje ya fue calificado', async () => {
      // Arrange
      conductorRepoMock.findOne.mockResolvedValueOnce({ id: CONDUCTOR_ID });
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: PASAJERO_ID }])
        .mockResolvedValueOnce([{ id: ABORDAJE_ID }]);
      calificacionRepoMock.findOne.mockResolvedValueOnce({ id: 'calificacion-previa' });

      // Act + Assert
      await expect(service.calificar(CONDUCTOR_ID, USUARIO_ID, dtoCalificar)).rejects.toThrow(
        new ConflictException('Ya calificaste este viaje'),
      );
      expect(calificacionRepoMock.save).not.toHaveBeenCalled();
    });

    it('lanza ConflictException ante una carrera contra el UNIQUE(abordaje_id)', async () => {
      // Arrange: el findOne no la ve, pero el INSERT choca con el índice UNIQUE
      conductorRepoMock.findOne.mockResolvedValueOnce({ id: CONDUCTOR_ID });
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: PASAJERO_ID }])
        .mockResolvedValueOnce([{ id: ABORDAJE_ID }]);
      calificacionRepoMock.findOne.mockResolvedValueOnce(null);
      calificacionRepoMock.create.mockReturnValueOnce({});
      calificacionRepoMock.save.mockRejectedValueOnce(
        new Error('Violation of UNIQUE KEY constraint UQ_calificaciones_abordaje'),
      );

      // Act + Assert
      await expect(service.calificar(CONDUCTOR_ID, USUARIO_ID, dtoCalificar)).rejects.toThrow(
        ConflictException,
      );
    });

    it('inserta la calificación y recalcula el promedio vía sp_actualizar_calificacion_conductor', async () => {
      // Arrange
      conductorRepoMock.findOne
        .mockResolvedValueOnce({ id: CONDUCTOR_ID }) // validación inicial
        .mockResolvedValueOnce({ id: CONDUCTOR_ID, calificacionPromedio: '4.80' }); // releído tras el SP
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: PASAJERO_ID }])
        .mockResolvedValueOnce([{ id: ABORDAJE_ID }])
        .mockResolvedValueOnce(undefined); // EXEC sp_actualizar_calificacion_conductor
      calificacionRepoMock.findOne.mockResolvedValueOnce(null);
      const calificacionGuardada = {
        id: 'calificacion-1',
        abordajeId: ABORDAJE_ID,
        conductorId: CONDUCTOR_ID,
        estrellas: 5,
        comentario: 'Excelente conducción',
      };
      calificacionRepoMock.create.mockReturnValueOnce(calificacionGuardada);
      calificacionRepoMock.save.mockResolvedValueOnce(calificacionGuardada);

      // Act
      const resultado = await service.calificar(CONDUCTOR_ID, USUARIO_ID, dtoCalificar);

      // Assert
      expect(calificacionRepoMock.create).toHaveBeenCalledWith({
        abordajeId: ABORDAJE_ID,
        pasajeroId: PASAJERO_ID,
        conductorId: CONDUCTOR_ID,
        estrellas: 5,
        comentario: 'Excelente conducción',
      });
      expect(dataSourceMock.query).toHaveBeenLastCalledWith(
        expect.stringContaining('EXEC sp_actualizar_calificacion_conductor'),
        [CONDUCTOR_ID],
      );
      expect(resultado).toMatchObject({
        mensaje: 'Calificación registrada correctamente',
        calificacion: expect.objectContaining({ id: 'calificacion-1', estrellas: 5 }),
        calificacionPromedio: 4.8,
      });
    });
  });

  describe('crearConductor', () => {
    const dtoCrear: CrearConductorDto = {
      usuarioId: 'usuario-conductor',
      asociacionId: 'asociacion-1',
      licenciaNumero: 'LIC-001',
      licenciaVence: '2027-01-01',
    } as CrearConductorDto;

    it('lanza BadRequestException si el usuario no tiene rol conductor', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([{ id: 'usuario-x', activo: true, rol: 'pasajero' }]);

      // Act + Assert
      await expect(service.crearConductor(dtoCrear)).rejects.toThrow(
        new BadRequestException('El usuario indicado no tiene rol conductor'),
      );
    });

    it('lanza BadRequestException si la asociación está SUSPENDIDA', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: 'usuario-conductor', activo: true, rol: 'conductor' }])
        .mockResolvedValueOnce([{ id: 'asociacion-1', estado: 'SUSPENDIDA' }]);

      // Act + Assert
      await expect(service.crearConductor(dtoCrear)).rejects.toThrow(
        new BadRequestException('La asociación indicada está suspendida'),
      );
    });

    it('lanza ConflictException si el usuario ya está registrado como conductor', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: 'usuario-conductor', activo: true, rol: 'conductor' }])
        .mockResolvedValueOnce([{ id: 'asociacion-1', estado: 'ACTIVA' }]);
      conductorRepoMock.findOne.mockResolvedValueOnce({ id: 'conductor-existente' });

      // Act + Assert
      await expect(service.crearConductor(dtoCrear)).rejects.toThrow(
        new ConflictException('El usuario ya está registrado como conductor'),
      );
    });
  });
});
