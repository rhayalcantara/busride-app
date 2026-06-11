import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FlotaService } from './flota.service';
import { Bus } from '../buses/entities/bus.entity';
import { Horario } from '../buses/entities/horario.entity';
import { AsignacionBusRuta } from '../buses/entities/asignacion-bus-ruta.entity';
import { CrearBusDto } from './dto/crear-bus.dto';
import { CrearHorarioDto } from './dto/crear-horario.dto';
import { CrearAsignacionDto } from './dto/crear-asignacion.dto';

describe('FlotaService', () => {
  let service: FlotaService;

  const busRepoMock = { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn() };
  const horarioRepoMock = { find: jest.fn(), create: jest.fn(), save: jest.fn() };
  const asignacionRepoMock = { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn() };
  const dataSourceMock = { query: jest.fn() };

  const ASOCIACION_ID = 'asociacion-1';

  const dtoBus: CrearBusDto = {
    placa: ' a123456 ',
    asociacionId: ASOCIACION_ID,
    capacidadTotal: 32,
  } as unknown as CrearBusDto;

  const dtoAsignacion: CrearAsignacionDto = {
    busId: 'bus-1',
    rutaId: 'ruta-1',
    conductorId: 'conductor-1',
  } as CrearAsignacionDto;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        FlotaService,
        { provide: getRepositoryToken(Bus), useValue: busRepoMock },
        { provide: getRepositoryToken(Horario), useValue: horarioRepoMock },
        { provide: getRepositoryToken(AsignacionBusRuta), useValue: asignacionRepoMock },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = moduleRef.get(FlotaService);
  });

  describe('crearBus', () => {
    it('lanza ConflictException si la placa ya existe (normalizada a mayúsculas)', async () => {
      // Arrange
      busRepoMock.findOne.mockResolvedValueOnce({ id: 'bus-existente', placa: 'A123456' });

      // Act + Assert
      await expect(service.crearBus(dtoBus)).rejects.toThrow(ConflictException);
      // La búsqueda se hace con la placa saneada (trim + upper)
      expect(busRepoMock.findOne).toHaveBeenCalledWith({ where: { placa: 'A123456' } });
      expect(busRepoMock.save).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si la asociación no existe o no está ACTIVA', async () => {
      // Arrange
      busRepoMock.findOne.mockResolvedValueOnce(null);
      dataSourceMock.query.mockResolvedValueOnce([]); // sin asociación activa

      // Act + Assert
      await expect(service.crearBus(dtoBus)).rejects.toThrow(
        new NotFoundException('La asociación no existe o está inactiva'),
      );
      expect(dataSourceMock.query).toHaveBeenCalledWith(
        expect.stringContaining(`estado = 'ACTIVA'`),
        [ASOCIACION_ID],
      );
    });

    it('crea el bus con la placa normalizada cuando todo es válido', async () => {
      // Arrange
      busRepoMock.findOne.mockResolvedValueOnce(null);
      dataSourceMock.query.mockResolvedValueOnce([{ id: ASOCIACION_ID }]);
      const busCreado = { id: 'bus-1', placa: 'A123456' };
      busRepoMock.create.mockReturnValueOnce(busCreado);
      busRepoMock.save.mockResolvedValueOnce(busCreado);

      // Act
      const resultado = await service.crearBus(dtoBus);

      // Assert
      expect(busRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ placa: 'A123456', asociacionId: ASOCIACION_ID }),
      );
      expect(resultado).toBe(busCreado);
    });
  });

  describe('actualizarBus', () => {
    it('lanza ConflictException si otra unidad ya usa la nueva placa', async () => {
      // Arrange
      busRepoMock.findOne
        .mockResolvedValueOnce({ id: 'bus-1', placa: 'A111111' }) // bus a editar
        .mockResolvedValueOnce({ id: 'bus-2', placa: 'B222222' }); // duplicado ajeno

      // Act + Assert
      await expect(service.actualizarBus('bus-1', { placa: 'b222222' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('crearHorario', () => {
    it('lanza BadRequestException si horaInicio >= horaFin', async () => {
      // Arrange
      const dto: CrearHorarioDto = {
        rutaId: 'ruta-1',
        diasSemana: 'LMXJV',
        horaInicio: '18:00',
        horaFin: '06:00',
      } as CrearHorarioDto;

      // Act + Assert
      await expect(service.crearHorario(dto)).rejects.toThrow(
        new BadRequestException('La hora de inicio debe ser anterior a la hora de fin'),
      );
      expect(dataSourceMock.query).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si la ruta no existe o está inactiva', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([]);

      // Act + Assert
      await expect(
        service.crearHorario({
          rutaId: 'ruta-x',
          diasSemana: 'LMXJV',
          horaInicio: '06:00',
          horaFin: '22:00',
        } as CrearHorarioDto),
      ).rejects.toThrow(new NotFoundException('La ruta no existe o está inactiva'));
    });

    it('crea el horario con frecuencia default de 30 minutos', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([{ id: 'ruta-1' }]);
      const horario = { id: 'horario-1' };
      horarioRepoMock.create.mockReturnValueOnce(horario);
      horarioRepoMock.save.mockResolvedValueOnce(horario);

      // Act
      const resultado = await service.crearHorario({
        rutaId: 'ruta-1',
        diasSemana: 'LMXJV',
        horaInicio: '06:00',
        horaFin: '22:00',
      } as CrearHorarioDto);

      // Assert
      expect(horarioRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ frecuenciaMin: 30 }),
      );
      expect(resultado).toBe(horario);
    });
  });

  describe('crearAsignacion', () => {
    const prepararValidacionesBasicas = () => {
      busRepoMock.findOne.mockResolvedValueOnce({ id: 'bus-1', activo: true });
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: 'ruta-1' }]) // ruta activa
        .mockResolvedValueOnce([{ id: 'conductor-1' }]); // conductor activo
    };

    it('lanza BadRequestException si el bus está desactivado', async () => {
      // Arrange
      busRepoMock.findOne.mockResolvedValueOnce({ id: 'bus-1', activo: false });

      // Act + Assert
      await expect(service.crearAsignacion(dtoAsignacion)).rejects.toThrow(
        new BadRequestException('El bus está desactivado'),
      );
    });

    it('lanza ConflictException si el bus ya tiene una asignación activa', async () => {
      // Arrange
      prepararValidacionesBasicas();
      asignacionRepoMock.findOne.mockResolvedValueOnce({ id: 'asig-previa', activa: true });

      // Act + Assert
      await expect(service.crearAsignacion(dtoAsignacion)).rejects.toThrow(
        new ConflictException('El bus ya tiene una asignación activa'),
      );
      expect(asignacionRepoMock.findOne).toHaveBeenCalledWith({
        where: { busId: 'bus-1', activa: true },
      });
    });

    it('lanza ConflictException si el conductor ya tiene una asignación activa', async () => {
      // Arrange
      prepararValidacionesBasicas();
      asignacionRepoMock.findOne
        .mockResolvedValueOnce(null) // bus libre
        .mockResolvedValueOnce({ id: 'asig-previa', activa: true }); // conductor ocupado

      // Act + Assert
      await expect(service.crearAsignacion(dtoAsignacion)).rejects.toThrow(
        new ConflictException('El conductor ya tiene una asignación activa'),
      );
      expect(asignacionRepoMock.save).not.toHaveBeenCalled();
    });

    it('crea la asignación activa cuando bus, ruta y conductor están libres', async () => {
      // Arrange
      prepararValidacionesBasicas();
      asignacionRepoMock.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      const asignacion = { id: 'asig-1' };
      asignacionRepoMock.create.mockReturnValueOnce(asignacion);
      asignacionRepoMock.save.mockResolvedValueOnce(asignacion);

      // Act
      const resultado = await service.crearAsignacion(dtoAsignacion);

      // Assert
      expect(asignacionRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          busId: 'bus-1',
          rutaId: 'ruta-1',
          conductorId: 'conductor-1',
          activa: true,
        }),
      );
      expect(resultado).toBe(asignacion);
    });
  });

  describe('desactivarAsignacion', () => {
    it('lanza NotFoundException si la asignación no existe', async () => {
      // Arrange
      asignacionRepoMock.findOne.mockResolvedValueOnce(null);

      // Act + Assert
      await expect(service.desactivarAsignacion('no-existe')).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si ya está desactivada', async () => {
      // Arrange
      asignacionRepoMock.findOne.mockResolvedValueOnce({ id: 'asig-1', activa: false });

      // Act + Assert
      await expect(service.desactivarAsignacion('asig-1')).rejects.toThrow(
        new BadRequestException('La asignación ya está desactivada'),
      );
      expect(asignacionRepoMock.save).not.toHaveBeenCalled();
    });

    it('desactiva y cierra la asignación con fechaFin', async () => {
      // Arrange
      const asignacion = { id: 'asig-1', activa: true, fechaFin: undefined as Date | undefined };
      asignacionRepoMock.findOne.mockResolvedValueOnce(asignacion);
      asignacionRepoMock.save.mockImplementationOnce(async (a) => a);

      // Act
      const resultado = await service.desactivarAsignacion('asig-1');

      // Assert
      expect(resultado.activa).toBe(false);
      expect(resultado.fechaFin).toBeInstanceOf(Date);
      expect(asignacionRepoMock.save).toHaveBeenCalledWith(asignacion);
    });
  });
});
