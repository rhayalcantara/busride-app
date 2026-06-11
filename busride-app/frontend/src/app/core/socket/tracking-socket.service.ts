import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { Observable, Subject, filter } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

/** Payload que difunde el backend en el evento `posicion_bus` (sala `viaje_<id>`). */
export interface PosicionBus {
  viajeId: string;
  lat: number;
  lng: number;
  timestamp: string;
}

/** Payload del evento global `disponibilidad_actualizada`. */
export interface DisponibilidadActualizada {
  rutaId: string;
  asientosLibres: number;
}

// Misma clave de localStorage que usa core/auth (TokenStorage) para el access token.
// Se lee directamente (sin importar core/auth) para no acoplarse a F-02.
const CLAVE_ACCESS_TOKEN = 'busride.accessToken';

/**
 * Cliente Socket.IO del namespace `/tracking` del backend.
 *
 * - Conexión LAZY: no se abre el socket hasta el primer uso real
 *   (suscribirse a un viaje, emitir posición o escuchar disponibilidad).
 * - Autenticación: el WsJwtGuard del backend espera el JWT en
 *   `handshake.auth.token`; se usa un callback para que cada intento de
 *   (re)conexión lea el token vigente de localStorage.
 * - Reconexión: al reconectar se re-emite `suscribir_viaje` por cada sala
 *   activa, de modo que los observables siguen recibiendo `posicion_bus`.
 */
@Injectable({ providedIn: 'root' })
export class TrackingSocketService implements OnDestroy {
  private readonly zone = inject(NgZone);

  private socket: Socket | null = null;

  /** Viajes con suscripción activa, para re-unirse a sus salas al reconectar. */
  private readonly viajesSuscritos = new Set<string>();

  private readonly posicionBusSubject = new Subject<PosicionBus>();
  private readonly disponibilidadSubject = new Subject<DisponibilidadActualizada>();

  /**
   * Se suscribe a la sala del viaje y devuelve el flujo de posiciones
   * (`posicion_bus`) filtrado por ese viaje. Llamar a `desuscribirViaje`
   * cuando deje de interesar.
   */
  suscribirViaje(viajeId: string): Observable<PosicionBus> {
    const socket = this.asegurarConexion();
    this.viajesSuscritos.add(viajeId);
    if (socket.connected) {
      socket.emit('suscribir_viaje', { viajeId });
    }
    // Si aún no está conectado, el manejador de 'connect' emitirá la
    // suscripción de todas las salas registradas.
    return this.posicionBusSubject
      .asObservable()
      .pipe(filter((posicion) => posicion.viajeId === viajeId));
  }

  /** Abandona la sala del viaje y deja de re-suscribirla en reconexiones. */
  desuscribirViaje(viajeId: string): void {
    this.viajesSuscritos.delete(viajeId);
    if (this.socket?.connected) {
      this.socket.emit('desuscribir_viaje', { viajeId });
    }
  }

  /**
   * Emite la posición GPS del conductor (`actualizar_posicion`). El backend
   * valida que el usuario autenticado sea el conductor del viaje.
   */
  emitirPosicion(viajeId: string, lat: number, lng: number): void {
    const socket = this.asegurarConexion();
    // socket.io-client almacena en búfer los emits previos a la conexión.
    socket.emit('actualizar_posicion', { viajeId, lat, lng });
  }

  /**
   * Flujo de cambios de disponibilidad de asientos
   * (`disponibilidad_actualizada`, difundido a todos los clientes).
   * Conecta el socket si aún no lo está.
   */
  escucharDisponibilidad(): Observable<DisponibilidadActualizada> {
    this.asegurarConexion();
    return this.disponibilidadSubject.asObservable();
  }

  /** Cierra el socket y limpia el estado (las salas activas se olvidan). */
  desconectar(): void {
    this.viajesSuscritos.clear();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  ngOnDestroy(): void {
    this.desconectar();
  }

  /** Crea la conexión la primera vez que se necesita (lazy). */
  private asegurarConexion(): Socket {
    if (this.socket) {
      return this.socket;
    }

    // Fuera de la zona de Angular: los frames del socket no deben disparar
    // detección de cambios; se reentra a la zona al publicar en los Subjects.
    this.socket = this.zone.runOutsideAngular(() =>
      io(`${environment.wsUrl}/tracking`, {
        transports: ['websocket', 'polling'],
        // Callback: cada intento de (re)conexión lee el token vigente.
        auth: (cb) => cb({ token: localStorage.getItem(CLAVE_ACCESS_TOKEN) ?? '' }),
      }),
    );

    this.socket.on('connect', () => {
      // Re-unirse a las salas activas tras (re)conectar.
      for (const viajeId of this.viajesSuscritos) {
        this.socket?.emit('suscribir_viaje', { viajeId });
      }
    });

    this.socket.on('posicion_bus', (posicion: PosicionBus) => {
      this.zone.run(() => this.posicionBusSubject.next(posicion));
    });

    this.socket.on('disponibilidad_actualizada', (datos: DisponibilidadActualizada) => {
      this.zone.run(() => this.disponibilidadSubject.next(datos));
    });

    this.socket.on('connect_error', (error: Error) => {
      console.warn('[TrackingSocket] Error de conexión:', error.message);
    });

    return this.socket;
  }
}
