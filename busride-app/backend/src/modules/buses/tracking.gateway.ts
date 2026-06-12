import { Logger, UseGuards } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ViajesService } from './viajes.service';
import { WsJwtGuard } from '../../common';

interface PosicionPayload {
  viajeId: string;
  lat: number;
  lng: number;
}

interface SuscribirPayload {
  viajeId: string;
}

// Todos los mensajes requieren JWT válido (F9): WsJwtGuard valida el token
// del handshake (auth.token o header Authorization) y adjunta el payload
// verificado en client.data.user.
@UseGuards(WsJwtGuard)
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/tracking',
})
export class TrackingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(private viajesService: ViajesService) {}

  afterInit() {
    this.logger.log('TrackingGateway iniciado');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  // Conductor envía su posición GPS cada 5 segundos.
  // Además del JWT, solo el conductor dueño del viaje puede emitir (F4/F9).
  @SubscribeMessage('actualizar_posicion')
  async handleActualizarPosicion(
    @MessageBody() payload: PosicionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const usuarioId: string | undefined = client.data.user?.sub;
    if (!usuarioId) {
      throw new WsException('Usuario no autenticado');
    }

    const esConductor = await this.viajesService.esConductorDelViaje(payload.viajeId, usuarioId);
    if (!esConductor) {
      throw new WsException('Solo el conductor del viaje puede actualizar su posición');
    }

    const resultado = await this.viajesService.actualizarPosicion(
      payload.viajeId, payload.lat, payload.lng,
    );

    // Emitir a todos los pasajeros suscritos a este viaje
    this.server.to(`viaje_${payload.viajeId}`).emit('posicion_bus', {
      viajeId:   payload.viajeId,
      lat:       payload.lat,
      lng:       payload.lng,
      timestamp: resultado.timestamp,
    });

    return { ok: true };
  }

  // Pasajero se suscribe para seguir un viaje en el mapa
  @SubscribeMessage('suscribir_viaje')
  handleSuscribirViaje(
    @MessageBody() payload: SuscribirPayload,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`viaje_${payload.viajeId}`);
    return { ok: true, mensaje: `Suscrito a viaje ${payload.viajeId}` };
  }

  @SubscribeMessage('desuscribir_viaje')
  handleDesuscribirViaje(
    @MessageBody() payload: SuscribirPayload,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`viaje_${payload.viajeId}`);
    return { ok: true };
  }

  // Emitir nueva disponibilidad de asientos tras un abordaje (F-09a: lo invoca
  // ReservasService.confirmarAbordaje). Se emite a todo el namespace /tracking:
  // los suscritos a la sala viaje_<id> lo usan para el "asientos en vivo" y
  // cualquier cliente buscando rutas puede filtrar por viajeId.
  emitirDisponibilidadActualizada(viajeId: string, asientosDisponibles: number) {
    this.server.emit('disponibilidad_actualizada', { viajeId, asientosDisponibles });
  }
}
