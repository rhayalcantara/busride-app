import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RutasService } from './rutas.service';
import { Ruta } from './entities/ruta.entity';
import { Parada } from './entities/parada.entity';
import { RolNombre, UsuarioAutenticado } from '../../common';
import { CrearRutaDto } from './dto/crear-ruta.dto';
import { BuscarRutasDto } from './dto/buscar-rutas.dto';

describe('RutasService', () => {
  let service: RutasService;

  const queryRunnerMock = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn(),
    manager: { save: jest.fn() },
  };

  const dataSourceMock = {
    query: jest.fn(),
    createQueryRunner: jest.fn(() => queryRunnerMock),
  };

  const rutaRepoMock = { create: jest.fn(), find: jest.fn(), findOne: jest.fn() };
  const paradaRepoMock = { find: jest.fn() };

  const ASOCIACION_ID = 'asociacion-1';

  const usuarioAsociacion: UsuarioAutenticado = {
    userId: 'usuario-asoc',
    email: 'asoc@busride.do',
    rol: RolNombre.ASOCIACION,
  };
  const usuarioAdmin: UsuarioAutenticado = {
    userId: 'usuario-admin',
    email: 'admin@busride.do',
    rol: RolNombre.ADMIN,
  };

  const dtoBase: CrearRutaDto = {
    nombre: 'Ruta Centro - Aeropuerto',
    tarifa: 50,
    paradas: [
      { nombre: 'Parada A', orden: 1, lat: 18.4861, lng: -69.9312, esTerminal: true },
      { nombre: 'Parada B', orden: 2, lat: 18.4539, lng: -69.9395, referencia: 'Frente al parque' },
    ],
  } as CrearRutaDto;

  beforeEach(async () => {
    jest.clearAllMocks();
    dataSourceMock.createQueryRunner.mockReturnValue(queryRunnerMock);

    const moduleRef = await Test.createTestingModule({
      providers: [
        RutasService,
        { provide: getRepositoryToken(Ruta), useValue: rutaRepoMock },
        { provide: getRepositoryToken(Parada), useValue: paradaRepoMock },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = moduleRef.get(RutasService);
  });

  describe('crearRutaComoUsuario', () => {
    it('lanza NotFoundException si el rol asociacion no administra ninguna asociación', async () => {
      // Arrange: la consulta por usuario_id no devuelve asociación
      dataSourceMock.query.mockResolvedValueOnce([]);

      // Act + Assert
      await expect(service.crearRutaComoUsuario(usuarioAsociacion, dtoBase)).rejects.toThrow(
        new NotFoundException('Tu usuario no administra ninguna asociación'),
      );
      expect(dataSourceMock.createQueryRunner).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si el admin no envía asociacionId', async () => {
      // Act + Assert: el admin debe indicar la asociación en el DTO
      await expect(service.crearRutaComoUsuario(usuarioAdmin, dtoBase)).rejects.toThrow(
        new BadRequestException('asociacionId es obligatorio para rol admin'),
      );
      expect(dataSourceMock.query).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el admin envía una asociación inexistente', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([]); // la asociación del DTO no existe

      // Act + Assert
      await expect(
        service.crearRutaComoUsuario(usuarioAdmin, { ...dtoBase, asociacionId: 'no-existe' }),
      ).rejects.toThrow(new NotFoundException('Asociación no encontrada'));
    });

    it('rol asociacion: delega en crearRuta con la asociación derivada del JWT', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([{ id: ASOCIACION_ID }]);
      const rutaCreada = { id: 'ruta-1' };
      const spyCrearRuta = jest
        .spyOn(service, 'crearRuta')
        .mockResolvedValueOnce(rutaCreada as Ruta);

      // Act
      const resultado = await service.crearRutaComoUsuario(usuarioAsociacion, dtoBase);

      // Assert
      expect(dataSourceMock.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM asociaciones WHERE usuario_id'),
        [usuarioAsociacion.userId],
      );
      expect(spyCrearRuta).toHaveBeenCalledWith(ASOCIACION_ID, dtoBase);
      expect(resultado).toBe(rutaCreada);
    });

    it('rol admin: delega en crearRuta con el asociacionId validado del DTO', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([{ id: ASOCIACION_ID }]);
      const spyCrearRuta = jest
        .spyOn(service, 'crearRuta')
        .mockResolvedValueOnce({ id: 'ruta-1' } as Ruta);
      const dto = { ...dtoBase, asociacionId: ASOCIACION_ID };

      // Act
      await service.crearRutaComoUsuario(usuarioAdmin, dto);

      // Assert
      expect(spyCrearRuta).toHaveBeenCalledWith(ASOCIACION_ID, dto);
    });
  });

  describe('crearRuta', () => {
    it('guarda la ruta sin paradas/polylineWkt e inserta cada parada con geography::Point', async () => {
      // Arrange
      const rutaEntidad = { nombre: dtoBase.nombre };
      const rutaGuardada = { id: 'ruta-1', nombre: dtoBase.nombre };
      rutaRepoMock.create.mockReturnValueOnce(rutaEntidad);
      queryRunnerMock.manager.save.mockResolvedValueOnce(rutaGuardada);
      queryRunnerMock.query.mockResolvedValue(undefined);

      // Act
      const resultado = await service.crearRuta(ASOCIACION_ID, dtoBase);

      // Assert: la entidad se crea sin paradas ni polylineWkt y con la asociación
      expect(rutaRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ nombre: dtoBase.nombre, asociacionId: ASOCIACION_ID }),
      );
      expect(rutaRepoMock.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ paradas: expect.anything() }),
      );

      // Una INSERT cruda por parada, con geography::Point y sus coordenadas
      expect(queryRunnerMock.query).toHaveBeenCalledTimes(dtoBase.paradas.length);
      expect(queryRunnerMock.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('geography::Point(@3, @4, 4326)'),
        ['ruta-1', 'Parada A', 1, 18.4861, -69.9312, null, true],
      );
      expect(queryRunnerMock.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO paradas'),
        ['ruta-1', 'Parada B', 2, 18.4539, -69.9395, 'Frente al parque', false],
      );

      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.rollbackTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
      expect(resultado).toBe(rutaGuardada);
    });

    it('actualiza el polyline con STGeomFromText cuando se envía polylineWkt', async () => {
      // Arrange
      const wkt = 'LINESTRING(-69.9312 18.4861, -69.9395 18.4539)';
      rutaRepoMock.create.mockReturnValueOnce({});
      queryRunnerMock.manager.save.mockResolvedValueOnce({ id: 'ruta-1' });
      queryRunnerMock.query.mockResolvedValue(undefined);

      // Act
      await service.crearRuta(ASOCIACION_ID, { ...dtoBase, polylineWkt: wkt });

      // Assert: 2 paradas + 1 update de polyline
      expect(queryRunnerMock.query).toHaveBeenCalledTimes(3);
      expect(queryRunnerMock.query).toHaveBeenLastCalledWith(
        expect.stringContaining('geography::STGeomFromText(@0, 4326)'),
        [wkt, 'ruta-1'],
      );
    });

    it('hace rollback y libera el queryRunner si falla la inserción de paradas', async () => {
      // Arrange
      rutaRepoMock.create.mockReturnValueOnce({});
      queryRunnerMock.manager.save.mockResolvedValueOnce({ id: 'ruta-1' });
      const errorSql = new Error('ubicacion NOT NULL violada');
      queryRunnerMock.query.mockRejectedValueOnce(errorSql);

      // Act + Assert
      await expect(service.crearRuta(ASOCIACION_ID, dtoBase)).rejects.toThrow(errorSql);
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunnerMock.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });
  });

  describe('buscarRutasDisponibles', () => {
    it('usa radio default de 500 metros cuando no se especifica', async () => {
      // Arrange
      const dto: BuscarRutasDto = {
        latOrigen: 18.4861,
        lngOrigen: -69.9312,
        latDestino: 18.4539,
        lngDestino: -69.9395,
      } as BuscarRutasDto;
      const rutas = [{ ruta_id: 'ruta-1' }];
      dataSourceMock.query.mockResolvedValueOnce(rutas);

      // Act
      const resultado = await service.buscarRutasDisponibles(dto);

      // Assert
      expect(dataSourceMock.query).toHaveBeenCalledWith(
        expect.stringContaining('EXEC sp_buscar_rutas_disponibles'),
        [18.4861, -69.9312, 18.4539, -69.9395, 500],
      );
      expect(resultado).toBe(rutas);
    });

    it('respeta el radio indicado en el DTO', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([]);

      // Act
      await service.buscarRutasDisponibles({
        latOrigen: 18.4861,
        lngOrigen: -69.9312,
        latDestino: 18.4539,
        lngDestino: -69.9395,
        radioMetros: 1200,
      } as BuscarRutasDto);

      // Assert
      expect(dataSourceMock.query).toHaveBeenCalledWith(expect.any(String), [
        18.4861, -69.9312, 18.4539, -69.9395, 1200,
      ]);
    });
  });

  describe('obtenerRuta', () => {
    it('lanza NotFoundException si la ruta no existe', async () => {
      // Arrange
      rutaRepoMock.findOne.mockResolvedValueOnce(null);

      // Act + Assert
      await expect(service.obtenerRuta('no-existe')).rejects.toThrow(
        new NotFoundException('Ruta no encontrada'),
      );
    });
  });
});
