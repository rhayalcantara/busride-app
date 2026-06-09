import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ViajesService } from './viajes.service';

interface PosicionPayload {
  viajeId: string;
  lat: number;
  lng: number;
}

interface SuscribirPayload {
  viajeId: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/tracking',
})
export class TrackingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private viajesService: ViajesService) {}

  afterInit() {
    console.log('TrackingGateway iniciado');
  }

  handleConnection(client: Socket) {
    console.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente desconectado: ${client.id}`);
  }

  // Conductor envía su posición GPS cada 5 segundos
  @SubscribeMessage('actualizar_posicion')
  async handleActualizarPosicion(
    @MessageBody() payload: PosicionPayload,
    @ConnectedSocket() client: Socket,
  ) {
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

  // Emitir nueva disponibilidad de asientos a pasajeros buscando esta ruta
  emitirDisponibilidadActualizada(rutaId: string, asientosLibres: number) {
    this.server.emit('disponibilidad_actualizada', { rutaId, asientosLibres });
  }
}
