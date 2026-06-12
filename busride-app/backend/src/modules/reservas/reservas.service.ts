import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Reserva, EstadoReserva } from './entities/reserva.entity';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { ConfirmarAbordajeDto } from './dto/confirmar-abordaje.dto';
import { TrackingGateway } from '../buses/tracking.gateway';
import * as QRCode from 'qrcode';

@Injectable()
export class ReservasService {
  constructor(
    @InjectRepository(Reserva) private reservaRepo: Repository<Reserva>,
    private dataSource: DataSource,
    private jwtService: JwtService,
    private trackingGateway: TrackingGateway,
  ) {}

  // Mapea el userId del JWT al perfil de pasajero (F4: la identidad nunca viene del body)
  private async resolverPasajeroId(userId: string): Promise<string> {
    const filas = await this.dataSource.query(
      `SELECT id FROM pasajeros WHERE usuario_id = @0`,
      [userId],
    );
    if (!filas?.length) {
      throw new NotFoundException(
        'Tu usuario no tiene un perfil de pasajero asociado. Contacta a soporte.',
      );
    }
    return filas[0].id;
  }

  // Mapea el userId del JWT al perfil de conductor (F4)
  private async resolverConductorId(userId: string): Promise<string> {
    const filas = await this.dataSource.query(
      `SELECT id FROM conductores WHERE usuario_id = @0`,
      [userId],
    );
    if (!filas?.length) {
      throw new NotFoundException(
        'Tu usuario no tiene un perfil de conductor asociado. Contacta a soporte.',
      );
    }
    return filas[0].id;
  }

  async crearReserva(userId: string, dto: CrearReservaDto) {
    const pasajeroId = await this.resolverPasajeroId(userId);

    // Generar token JWT firmado como QR (TTL 5 minutos)
    const qrPayload = {
      pasajeroId,
      viajeId: dto.viajeId,
      paradaOrigenId: dto.paradaOrigenId,
      tipo: 'ABORDAJE',
    };
    const qrToken = this.jwtService.sign(qrPayload, { expiresIn: '5m' });

    const resultado = await this.dataSource.query(
      `EXEC sp_crear_reserva
        @pasajero_id       = @0,
        @viaje_id          = @1,
        @parada_origen_id  = @2,
        @parada_destino_id = @3,
        @lat_pasajero      = @4,
        @lng_pasajero      = @5,
        @qr_token          = @6`,
      [
        pasajeroId, dto.viajeId, dto.paradaOrigenId,
        dto.paradaDestinoId, dto.latPasajero, dto.lngPasajero, qrToken,
      ],
    );

    // B5 (Ola 6): si el SP no devuelve filas, error controlado en vez de TypeError/500
    if (!resultado?.length) {
      throw new BadRequestException('El procedimiento de reserva no devolvió resultado');
    }
    const res = resultado[0];
    if (!res.exito) throw new BadRequestException(res.mensaje);

    // Generar imagen QR en base64
    const qrImageBase64 = await QRCode.toDataURL(qrToken, {
      width: 300,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' },
    });

    return {
      reservaId: res.reserva_id,
      qrToken,
      qrImagen: qrImageBase64,
      expiraEn: new Date(Date.now() + 5 * 60 * 1000),
      mensaje: res.mensaje,
    };
  }

  async confirmarAbordaje(userId: string, dto: ConfirmarAbordajeDto) {
    const conductorId = await this.resolverConductorId(userId);

    // Verificar JWT del QR antes de llamar al SP (su payload trae el viajeId,
    // necesario para emitir la disponibilidad actualizada tras el abordaje)
    let qrPayload: { viajeId?: string };
    try {
      qrPayload = this.jwtService.verify(dto.qrToken);
    } catch {
      throw new BadRequestException('QR inválido o expirado');
    }

    const resultado = await this.dataSource.query(
      `EXEC sp_confirmar_abordaje
        @qr_token       = @0,
        @conductor_id   = @1,
        @numero_asiento = @2`,
      [dto.qrToken, conductorId, dto.numeroAsiento],
    );

    // B5 (Ola 6): si el SP no devuelve filas, error controlado en vez de TypeError/500
    if (!resultado?.length) {
      throw new BadRequestException('El procedimiento de abordaje no devolvió resultado');
    }
    const res = resultado[0];
    if (!res.exito) throw new BadRequestException(res.mensaje);

    // F-09a: notificar la nueva disponibilidad por Socket.IO (asientos en vivo).
    // Solo el abordaje cambia asientos_disponibles: sp_crear_reserva y
    // sp_expirar_reservas no tocan la disponibilidad, por eso no emiten.
    if (qrPayload?.viajeId && res.asientos_restantes != null) {
      this.trackingGateway.emitirDisponibilidadActualizada(
        qrPayload.viajeId,
        res.asientos_restantes,
      );
    }

    return {
      abordajeId:        res.abordaje_id,
      ticketCodigo:      res.ticket_codigo,
      asiento:           res.asiento,
      monto:             res.monto,
      asientosRestantes: res.asientos_restantes,
    };
  }

  async obtenerPasajerosEnParada(viajeId: string, paradaId: number) {
    return this.dataSource.query(
      `EXEC sp_pasajeros_en_parada @viaje_id = @0, @parada_id = @1`,
      [viajeId, paradaId],
    );
  }

  // Historial de reservas del pasajero autenticado (reemplaza al listado por :pasajeroId).
  // F-09a: cada reserva incluye `calificada` — true solo para reservas ABORDADAS
  // cuyo abordaje ya tiene calificación (calificaciones.abordaje_id es UNIQUE).
  async listarMisReservas(userId: string) {
    const pasajeroId = await this.resolverPasajeroId(userId);

    const reservas = await this.reservaRepo.find({
      where: { pasajeroId },
      relations: ['viaje', 'viaje.ruta', 'paradaOrigen', 'paradaDestino'],
      order: { fechaCreacion: 'DESC' },
    });

    // Reservas cuyo abordaje ya fue calificado por este pasajero
    const filas = await this.dataSource.query(
      `SELECT a.reserva_id
       FROM abordajes a
       INNER JOIN calificaciones c ON c.abordaje_id = a.id
       WHERE a.pasajero_id = @0`,
      [pasajeroId],
    );
    // Comparación de UUIDs case-insensitive (SQL Server los devuelve en mayúsculas)
    const reservasCalificadas = new Set<string>(
      (filas ?? []).map((f: { reserva_id: string }) => String(f.reserva_id).toLowerCase()),
    );

    return reservas.map((reserva) => ({
      ...reserva,
      calificada:
        reserva.estado === EstadoReserva.ABORDADA &&
        reservasCalificadas.has(String(reserva.id).toLowerCase()),
    }));
  }
}
