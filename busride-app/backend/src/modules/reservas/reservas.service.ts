import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Reserva } from './entities/reserva.entity';
import * as QRCode from 'qrcode';

export interface CrearReservaDto {
  pasajeroId: string;
  viajeId: string;
  paradaOrigenId: number;
  paradaDestinoId: number;
  latPasajero: number;
  lngPasajero: number;
}

export interface ConfirmarAbordajeDto {
  qrToken: string;
  conductorId: string;
  numeroAsiento: number;
}

@Injectable()
export class ReservasService {
  constructor(
    @InjectRepository(Reserva) private reservaRepo: Repository<Reserva>,
    private dataSource: DataSource,
    private jwtService: JwtService,
  ) {}

  async crearReserva(dto: CrearReservaDto) {
    // Generar token JWT firmado como QR (TTL 5 minutos)
    const qrPayload = {
      pasajeroId: dto.pasajeroId,
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
        dto.pasajeroId, dto.viajeId, dto.paradaOrigenId,
        dto.paradaDestinoId, dto.latPasajero, dto.lngPasajero, qrToken,
      ],
    );

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

  async confirmarAbordaje(dto: ConfirmarAbordajeDto) {
    // Verificar JWT del QR antes de llamar al SP
    try {
      this.jwtService.verify(dto.qrToken);
    } catch {
      throw new BadRequestException('QR inválido o expirado');
    }

    const resultado = await this.dataSource.query(
      `EXEC sp_confirmar_abordaje
        @qr_token       = @0,
        @conductor_id   = @1,
        @numero_asiento = @2`,
      [dto.qrToken, dto.conductorId, dto.numeroAsiento],
    );

    const res = resultado[0];
    if (!res.exito) throw new BadRequestException(res.mensaje);

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

  async listarReservasPasajero(pasajeroId: string) {
    return this.reservaRepo.find({
      where: { pasajeroId },
      relations: ['viaje', 'viaje.ruta', 'paradaOrigen', 'paradaDestino'],
      order: { fechaCreacion: 'DESC' },
    });
  }
}
