// Modelos del módulo viajes (buses en operación) — espejo de viajes.controller/service del backend.
import type { Ruta } from './ruta.model';
import type { Conductor } from './conductor.model';

export type EstadoViaje = 'PROGRAMADO' | 'EN_CURSO' | 'FINALIZADO' | 'CANCELADO';

export interface Viaje {
  id: string;
  conductorId: string;
  conductor?: Conductor;
  rutaId: string;
  ruta?: Ruta; // GET /viajes/mi-activo incluye ruta + ruta.paradas
  busId: string;
  asignacionId: string;
  estado: EstadoViaje;
  asientosDisponibles: number;
  fechaInicio: string | null;
  fechaFin: string | null;
  posLat: number | null;
  posLng: number | null;
  fechaPosicion: string | null;
  ingresoTotal: number;
  fechaCreacion: string;
}

export interface IniciarViajeDto {
  asignacionId: string; // asignación bus-ruta activa del conductor autenticado
}

export interface ActualizarPosicionDto {
  lat: number;
  lng: number;
}

// Respuesta de PATCH /viajes/:id/posicion
export interface PosicionActualizada {
  viajeId: string;
  lat: number;
  lng: number;
  timestamp: string;
}

// Respuesta de POST /viajes/:id/finalizar — fila cruda de sp_liquidar_viaje (snake_case)
export interface ViajeFinalizado {
  total_pasajeros: number;
  ingreso_bruto: number;
  comision_plataforma: number;
  comision_asociacion: number;
  monto_neto_conductor: number;
}

// Fila cruda de sp_pasajeros_en_parada (snake_case)
export interface PasajeroEnParada {
  reserva_id: string;
  nombre_pasajero: string;
  telefono: string | null;
  foto_url: string | null;
  hora_reserva: string;
  parada_destino: string;
}
