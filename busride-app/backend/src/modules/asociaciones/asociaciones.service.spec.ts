import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AsociacionesService, ESTADO_ASOCIACION } from './asociaciones.service';
import { Asociacion } from './entities/asociacion.entity';
import { CrearAsociacionDto } from './dto/crear-asociacion.dto';

describe('AsociacionesService', () => {
  let service: AsociacionesService;

  const managerMock = { findOne: jest.fn(), find: jest.fn() };
  const asociacionRepoMock = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    manager: managerMock,
  };

  const ASOCIACION_ID = 'asociacion-1';
  const ADMIN_ID = 'admin-1';

  const dtoCrear: CrearAsociacionDto = {
    usuarioId: 'usuario-1',
    nombre: 'ASOTRANSA',
    rnc: '101-12345-6',
  } as CrearAsociacionDto;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AsociacionesService,
        { provide: getRepositoryToken(Asociacion), useValue: asociacionRepoMock },
      ],
    }).compile();

    service = moduleRef.get(AsociacionesService);
  });

  describe('crear', () => {
    it('lanza NotFoundException si el usuario administrador no existe', async () => {
      // Arrange
      managerMock.findOne.mockResolvedValueOnce(null);

      // Act + Assert
      await expect(service.crear(dtoCrear)).rejects.toThrow(NotFoundException);
      expect(asociacionRepoMock.save).not.toHaveBeenCalled();
    });

    // B4 corregido (Ola 6): el RNC duplicado lanza ConflictException (409),
    // consistente con el resto del backend (placa de bus, licencia, asignaciones).
    it('lanza ConflictException si ya existe una asociación con ese RNC', async () => {
      // Arrange
      managerMock.findOne.mockResolvedValueOnce({ id: 'usuario-1' });
      asociacionRepoMock.findOne.mockResolvedValueOnce({ id: 'asociacion-existente', rnc: dtoCrear.rnc });

      // Act + Assert
      await expect(service.crear(dtoCrear)).rejects.toThrow(ConflictException);
      expect(asociacionRepoMock.save).not.toHaveBeenCalled();
    });

    it('crea la asociación en estado PENDIENTE', async () => {
      // Arrange
      managerMock.findOne.mockResolvedValueOnce({ id: 'usuario-1' });
      asociacionRepoMock.findOne.mockResolvedValueOnce(null); // RNC libre
      const entidad = { ...dtoCrear, estado: ESTADO_ASOCIACION.PENDIENTE };
      asociacionRepoMock.create.mockReturnValueOnce(entidad);
      asociacionRepoMock.save.mockResolvedValueOnce({ id: ASOCIACION_ID, ...entidad });

      // Act
      const resultado = await service.crear(dtoCrear);

      // Assert
      expect(asociacionRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ estado: ESTADO_ASOCIACION.PENDIENTE }),
      );
      expect(resultado).toMatchObject({ id: ASOCIACION_ID, estado: ESTADO_ASOCIACION.PENDIENTE });
    });
  });

  describe('aprobar', () => {
    it('lanza NotFoundException si la asociación no existe', async () => {
      // Arrange
      asociacionRepoMock.findOne.mockResolvedValueOnce(null);

      // Act + Assert
      await expect(service.aprobar('no-existe', ADMIN_ID)).rejects.toThrow(
        new NotFoundException('Asociación no encontrada'),
      );
    });

    it('lanza BadRequestException si la asociación ya está ACTIVA', async () => {
      // Arrange
      asociacionRepoMock.findOne.mockResolvedValueOnce({
        id: ASOCIACION_ID,
        estado: ESTADO_ASOCIACION.ACTIVA,
      });

      // Act + Assert
      await expect(service.aprobar(ASOCIACION_ID, ADMIN_ID)).rejects.toThrow(
        new BadRequestException('La asociación ya está activa'),
      );
      expect(asociacionRepoMock.save).not.toHaveBeenCalled();
    });

    it('activa la asociación y registra aprobadoPor + fechaAprobacion', async () => {
      // Arrange
      const asociacion = {
        id: ASOCIACION_ID,
        estado: ESTADO_ASOCIACION.PENDIENTE,
        aprobadoPor: undefined as string | undefined,
        fechaAprobacion: undefined as Date | undefined,
      };
      asociacionRepoMock.findOne.mockResolvedValueOnce(asociacion);
      asociacionRepoMock.save.mockImplementationOnce(async (a) => a);

      // Act
      const resultado = await service.aprobar(ASOCIACION_ID, ADMIN_ID);

      // Assert
      expect(resultado.estado).toBe(ESTADO_ASOCIACION.ACTIVA);
      expect(resultado.aprobadoPor).toBe(ADMIN_ID);
      expect(resultado.fechaAprobacion).toBeInstanceOf(Date);
      expect(asociacionRepoMock.save).toHaveBeenCalledWith(asociacion);
    });
  });

  describe('actualizar', () => {
    it('rechaza con 409 cambiar el RNC a uno que ya usa otra asociación (B4)', async () => {
      // Arrange
      asociacionRepoMock.findOne
        .mockResolvedValueOnce({ id: ASOCIACION_ID, rnc: '101-00000-0' }) // la editada
        .mockResolvedValueOnce({ id: 'otra-asociacion', rnc: '101-12345-6' }); // dueña del RNC

      // Act + Assert
      await expect(service.actualizar(ASOCIACION_ID, { rnc: '101-12345-6' })).rejects.toThrow(
        ConflictException,
      );
      expect(asociacionRepoMock.save).not.toHaveBeenCalled();
    });
  });

  describe('vincularUsuarioAdmin', () => {
    it('lanza NotFoundException si el usuario a vincular no existe', async () => {
      // Arrange
      asociacionRepoMock.findOne.mockResolvedValueOnce({ id: ASOCIACION_ID });
      managerMock.findOne.mockResolvedValueOnce(null);

      // Act + Assert
      await expect(service.vincularUsuarioAdmin(ASOCIACION_ID, 'usuario-fantasma')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('vincula el nuevo usuario administrador', async () => {
      // Arrange
      const asociacion = { id: ASOCIACION_ID, usuarioId: 'usuario-viejo' };
      asociacionRepoMock.findOne.mockResolvedValueOnce(asociacion);
      managerMock.findOne.mockResolvedValueOnce({ id: 'usuario-nuevo' });
      asociacionRepoMock.save.mockImplementationOnce(async (a) => a);

      // Act
      const resultado = await service.vincularUsuarioAdmin(ASOCIACION_ID, 'usuario-nuevo');

      // Assert
      expect(resultado.usuarioId).toBe('usuario-nuevo');
    });
  });
});
