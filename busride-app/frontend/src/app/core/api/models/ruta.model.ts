// Modelos del módulo rutas — espejo de rutas.controller/service del backend.
import type { Asociacion } from './asociacion.model';

export interface Parada {
  id: number;
  rutaId: string;
  nombre: string;
  orden: number;
  referencia: string | null;
  esTerminal: boolean;
  // lat/lng NO están en la entidad (columna geography): solo llegan
  // vía GET /rutas/:id/paradas (ver ParadaConUbicacion).
  lat?: number;
  lng?: number;
}

export interface Ruta {
  id: string;
  asociacionId: string;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  tarifa: number;
  activa: boolean;
  fechaCreacion: string;
  paradas?: Parada[]; // presente en GET /rutas/:id y GET /rutas/asociacion/:id
  asociacion?: Asociacion; // presente en GET /rutas/:id
}

export interface BuscarRutasParams {
  latOrigen: number;
  lngOrigen: number;
  latDestino: number;
  lngDestino: number;
  radioMetros?: number; // 50-5000, default 500
}

// Fila cruda de sp_buscar_rutas_disponibles (el SP devuelve snake_case)
export interface RutaDisponible {
  viaje_id: string;
  ruta_id: string;
  ruta_nombre: string;
  ruta_codigo: string | null;
  tarifa: number;
  asientos_disponibles: number;
  parada_origen_id: number;
  parada_origen_nombre: string;
  parada_origen_referencia: string | null;
  distancia_origen_metros: number;
  parada_destino_id: number;
  parada_destino_nombre: string;
  parada_destino_referencia: string | null;
  distancia_destino_metros: number;
  conductor_nombre: string;
  bus_placa: string;
  bus_modelo: string | null;
  bus_lat: number | null;
  bus_lng: number | null;
  asociacion_nombre: string;
}

export interface ParadaRutaDto {
  nombre: string;
  orden: number; // desde 1
  lat: number;
  lng: number;
  referencia?: string;
  esTerminal?: boolean;
}

export interface CrearRutaDto {
  nombre: string;
  codigo?: string;
  descripcion?: string;
  tarifa: number;
  asociacionId?: string; // solo admin; rol asociacion lo deriva del JWT
  polylineWkt?: string; // LINESTRING WKT opcional
  paradas: ParadaRutaDto[]; // mínimo 2
}

// Fila cruda de GET /rutas/:id/paradas (consulta SQL con lat/lng desde geography)
export interface ParadaConUbicacion {
  id: number;
  nombre: string;
  orden: number;
  referencia: string | null;
  es_terminal: boolean;
  lat: number;
  lng: number;
}
