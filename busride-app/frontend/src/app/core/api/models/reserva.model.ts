// Modelos del módulo reservas — espejo de reservas.controller/service del backend.
import type { Parada } from './ruta.model';
import type { Viaje } from './viaje.model';

export type EstadoReserva =
  | 'PROVISIONAL'
  | 'CONFIRMADA'
  | 'ABORDADA'
  | 'EXPIRADA'
  | 'CANCELADA';

// El pasajeroId NO viaja en el body: se deriva del JWT en el backend.
export interface CrearReservaDto {
  viajeId: string;
  paradaOrigenId: number;
  paradaDestinoId: number;
  latPasajero: number;
  lngPasajero: number;
}

// Respuesta de POST /reservas (forma exacta de ReservasService.crearReserva)
export interface ReservaCreada {
  reservaId: string;
  qrToken: string; // JWT firmado con TTL de 5 minutos
  qrImagen: string; // data URL PNG en base64, lista para <img [src]>
  expiraEn: string; // fecha ISO de expiración del QR
  mensaje: string;
}

export interface ConfirmarAbordajeDto {
  qrToken: string; // token del QR escaneado al pasajero
  numeroAsiento: number; // >= 1
}

// Respuesta de POST /reservas/abordar (mapeada a camelCase por el service)
export interface AbordajeConfirmado {
  abordajeId: string;
  ticketCodigo: string;
  asiento: number;
  monto: number;
  asientosRestantes: number;
}

// Fila de GET /reservas/mias (entidad con relaciones viaje, viaje.ruta, paradas)
export interface Reserva {
  id: string;
  pasajeroId: string;
  viajeId: string;
  viaje?: Viaje;
  paradaOrigenId: number;
  paradaOrigen?: Parada;
  paradaDestinoId: number;
  paradaDestino?: Parada;
  estado: EstadoReserva;
  qrToken: string;
  qrExpiraEn: string;
  numeroAsiento: number | null;
  fechaCreacion: string;
  fechaAbordaje: string | null;
}
