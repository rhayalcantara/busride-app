import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ReservasService } from './reservas.service';
import { Reserva, EstadoReserva } from './entities/reserva.entity';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { ConfirmarAbordajeDto } from './dto/confirmar-abordaje.dto';
import { TrackingGateway } from '../buses/tracking.gateway';
import * as QRCode from 'qrcode';

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,QR_FALSO'),
}));

describe('ReservasService', () => {
  let service: ReservasService;

  const dataSourceMock = { query: jest.fn() };
  const jwtServiceMock = { sign: jest.fn(), verify: jest.fn() };
  const reservaRepoMock = { find: jest.fn() };
  const trackingGatewayMock = { emitirDisponibilidadActualizada: jest.fn() };

  const USER_ID = 'usuario-1';
  const PASAJERO_ID = 'pasajero-1';
  const CONDUCTOR_ID = 'conductor-1';

  const dtoReserva: CrearReservaDto = {
    viajeId: 'viaje-1',
    paradaOrigenId: 10,
    paradaDestinoId: 20,
    latPasajero: 18.4861,
    lngPasajero: -69.9312,
  } as CrearReservaDto;

  const dtoAbordaje: ConfirmarAbordajeDto = {
    qrToken: 'token-qr',
    numeroAsiento: 7,
  } as ConfirmarAbordajeDto;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservasService,
        { provide: getRepositoryToken(Reserva), useValue: reservaRepoMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: TrackingGateway, useValue: trackingGatewayMock },
      ],
    }).compile();

    service = moduleRef.get(ReservasService);
  });

  describe('crearReserva', () => {
    it('lanza NotFoundException si el usuario no tiene perfil de pasajero', async () => {
      // Arrange: la consulta de pasajeros no devuelve filas
      dataSourceMock.query.mockResolvedValueOnce([]);

      // Act + Assert
      await expect(service.crearReserva(USER_ID, dtoReserva)).rejects.toThrow(NotFoundException);
      expect(jwtServiceMock.sign).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException con el mensaje del SP cuando exito=false', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: PASAJERO_ID }]) // resolverPasajeroId
        .mockResolvedValueOnce([{ exito: false, mensaje: 'No hay asientos disponibles' }]); // sp_crear_reserva
      jwtServiceMock.sign.mockReturnValue('jwt-qr');

      // Act + Assert
      await expect(service.crearReserva(USER_ID, dtoReserva)).rejects.toThrow(
        new BadRequestException('No hay asientos disponibles'),
      );
      expect(QRCode.toDataURL).not.toHaveBeenCalled();
    });

    // B5 (Ola 6): recordset vacío del SP → error controlado, no TypeError/500
    it('lanza BadRequestException si sp_crear_reserva no devuelve filas', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: PASAJERO_ID }]) // resolverPasajeroId
        .mockResolvedValueOnce([]); // SP sin recordset
      jwtServiceMock.sign.mockReturnValue('jwt-qr');

      // Act + Assert
      await expect(service.crearReserva(USER_ID, dtoReserva)).rejects.toThrow(
        new BadRequestException('El procedimiento de reserva no devolvió resultado'),
      );
      expect(QRCode.toDataURL).not.toHaveBeenCalled();
    });

    it('firma el QR con expiresIn 5m, genera la imagen y devuelve reservaId/qrToken', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: PASAJERO_ID }])
        .mockResolvedValueOnce([{ exito: true, mensaje: 'Reserva creada', reserva_id: 'reserva-1' }]);
      jwtServiceMock.sign.mockReturnValue('jwt-qr');

      // Act
      const resultado = await service.crearReserva(USER_ID, dtoReserva);

      // Assert: payload del QR firmado con TTL de 5 minutos
      expect(jwtServiceMock.sign).toHaveBeenCalledWith(
        {
          pasajeroId: PASAJERO_ID,
          viajeId: dtoReserva.viajeId,
          paradaOrigenId: dtoReserva.paradaOrigenId,
          tipo: 'ABORDAJE',
        },
        { expiresIn: '5m' },
      );
      // El SP recibe el pasajero resuelto del JWT y el token firmado
      expect(dataSourceMock.query).toHaveBeenCalledWith(
        expect.stringContaining('EXEC sp_crear_reserva'),
        [
          PASAJERO_ID,
          dtoReserva.viajeId,
          dtoReserva.paradaOrigenId,
          dtoReserva.paradaDestinoId,
          dtoReserva.latPasajero,
          dtoReserva.lngPasajero,
          'jwt-qr',
        ],
      );
      expect(QRCode.toDataURL).toHaveBeenCalledWith('jwt-qr', expect.any(Object));
      expect(resultado).toMatchObject({
        reservaId: 'reserva-1',
        qrToken: 'jwt-qr',
        qrImagen: 'data:image/png;base64,QR_FALSO',
        mensaje: 'Reserva creada',
      });
      expect(resultado.expiraEn).toBeInstanceOf(Date);
    });
  });

  describe('confirmarAbordaje', () => {
    it('lanza NotFoundException si el usuario no tiene perfil de conductor', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([]); // resolverConductorId sin filas

      // Act + Assert
      await expect(service.confirmarAbordaje(USER_ID, dtoAbordaje)).rejects.toThrow(NotFoundException);
      expect(jwtServiceMock.verify).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException "QR inválido o expirado" si jwtService.verify falla', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([{ id: CONDUCTOR_ID }]);
      jwtServiceMock.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      // Act + Assert
      await expect(service.confirmarAbordaje(USER_ID, dtoAbordaje)).rejects.toThrow(
        new BadRequestException('QR inválido o expirado'),
      );
      // No se debe haber llamado al SP de abordaje
      expect(dataSourceMock.query).toHaveBeenCalledTimes(1);
    });

    it('lanza BadRequestException con el mensaje del SP cuando exito=false (y NO emite disponibilidad)', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: CONDUCTOR_ID }])
        .mockResolvedValueOnce([{ exito: false, mensaje: 'Reserva ya abordada' }]);
      jwtServiceMock.verify.mockReturnValue({ tipo: 'ABORDAJE', viajeId: 'viaje-1' });

      // Act + Assert
      await expect(service.confirmarAbordaje(USER_ID, dtoAbordaje)).rejects.toThrow(
        new BadRequestException('Reserva ya abordada'),
      );
      expect(trackingGatewayMock.emitirDisponibilidadActualizada).not.toHaveBeenCalled();
    });

    // B5 (Ola 6): recordset vacío del SP → error controlado, no TypeError/500
    it('lanza BadRequestException si sp_confirmar_abordaje no devuelve filas', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: CONDUCTOR_ID }])
        .mockResolvedValueOnce([]); // SP sin recordset
      jwtServiceMock.verify.mockReturnValue({ tipo: 'ABORDAJE' });

      // Act + Assert
      await expect(service.confirmarAbordaje(USER_ID, dtoAbordaje)).rejects.toThrow(
        new BadRequestException('El procedimiento de abordaje no devolvió resultado'),
      );
    });

    it('mapea abordajeId/ticketCodigo/asiento al confirmar correctamente', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: CONDUCTOR_ID }])
        .mockResolvedValueOnce([{
          exito: true,
          abordaje_id: 'abordaje-1',
          ticket_codigo: 'TCK-001',
          asiento: 7,
          monto: 50,
          asientos_restantes: 12,
        }]);
      jwtServiceMock.verify.mockReturnValue({ tipo: 'ABORDAJE', viajeId: 'viaje-1' });

      // Act
      const resultado = await service.confirmarAbordaje(USER_ID, dtoAbordaje);

      // Assert
      expect(dataSourceMock.query).toHaveBeenCalledWith(
        expect.stringContaining('EXEC sp_confirmar_abordaje'),
        [dtoAbordaje.qrToken, CONDUCTOR_ID, dtoAbordaje.numeroAsiento],
      );
      expect(resultado).toEqual({
        abordajeId: 'abordaje-1',
        ticketCodigo: 'TCK-001',
        asiento: 7,
        monto: 50,
        asientosRestantes: 12,
      });
    });

    // F-09a: el abordaje exitoso emite la nueva disponibilidad por Socket.IO
    it('emite disponibilidad_actualizada con el viajeId del QR y los asientos restantes del SP', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: CONDUCTOR_ID }])
        .mockResolvedValueOnce([{
          exito: true,
          abordaje_id: 'abordaje-1',
          ticket_codigo: 'TCK-001',
          asiento: 7,
          monto: 50,
          asientos_restantes: 12,
        }]);
      jwtServiceMock.verify.mockReturnValue({ tipo: 'ABORDAJE', viajeId: 'viaje-1' });

      // Act
      await service.confirmarAbordaje(USER_ID, dtoAbordaje);

      // Assert
      expect(trackingGatewayMock.emitirDisponibilidadActualizada).toHaveBeenCalledTimes(1);
      expect(trackingGatewayMock.emitirDisponibilidadActualizada).toHaveBeenCalledWith('viaje-1', 12);
    });
  });

  describe('listarMisReservas', () => {
    it('busca las reservas del pasajero resuelto desde el JWT ordenadas por fecha', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: PASAJERO_ID }]) // resolverPasajeroId
        .mockResolvedValueOnce([]); // sin calificaciones
      const reservas = [{ id: 'reserva-1', estado: EstadoReserva.PROVISIONAL }];
      reservaRepoMock.find.mockResolvedValueOnce(reservas);

      // Act
      const resultado = await service.listarMisReservas(USER_ID);

      // Assert
      expect(reservaRepoMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pasajeroId: PASAJERO_ID },
          order: { fechaCreacion: 'DESC' },
        }),
      );
      expect(resultado).toEqual([
        { id: 'reserva-1', estado: EstadoReserva.PROVISIONAL, calificada: false },
      ]);
    });

    // F-09a: flag `calificada` para reservas ABORDADAS con calificación existente
    it('marca calificada=true solo en la ABORDADA cuyo abordaje ya tiene calificación (UUIDs case-insensitive)', async () => {
      // Arrange
      dataSourceMock.query
        .mockResolvedValueOnce([{ id: PASAJERO_ID }]) // resolverPasajeroId
        .mockResolvedValueOnce([{ reserva_id: 'RESERVA-ABORDADA-1' }]); // ya calificada (mayúsculas, como SQL Server)
      reservaRepoMock.find.mockResolvedValueOnce([
        { id: 'reserva-abordada-1', estado: EstadoReserva.ABORDADA },
        { id: 'reserva-abordada-2', estado: EstadoReserva.ABORDADA },
        { id: 'reserva-abordada-1-fantasma', estado: EstadoReserva.EXPIRADA },
      ]);

      // Act
      const resultado = await service.listarMisReservas(USER_ID);

      // Assert: la query de calificaciones une abordajes con calificaciones del pasajero
      expect(dataSourceMock.query).toHaveBeenLastCalledWith(
        expect.stringContaining('INNER JOIN calificaciones'),
        [PASAJERO_ID],
      );
      expect(resultado).toEqual([
        { id: 'reserva-abordada-1', estado: EstadoReserva.ABORDADA, calificada: true },
        { id: 'reserva-abordada-2', estado: EstadoReserva.ABORDADA, calificada: false },
        { id: 'reserva-abordada-1-fantasma', estado: EstadoReserva.EXPIRADA, calificada: false },
      ]);
    });
  });
});
