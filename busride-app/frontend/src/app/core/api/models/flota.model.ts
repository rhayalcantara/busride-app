// Modelos del módulo flota (buses, horarios, asignaciones) — espejo de flota.controller del backend.
import type { Ruta } from './ruta.model';
import type { Conductor } from './conductor.model';

export interface Bus {
  id: string;
  asociacionId: string;
  placa: string;
  modelo: string | null;
  marca: string | null;
  anno: number | null;
  capacidadTotal: number;
  fotoUrl: string | null;
  activo: boolean;
  fechaCreacion: string;
}

export interface CrearBusDto {
  asociacionId: string;
  placa: string;
  modelo?: string;
  marca?: string;
  anno?: number; // 1950-2100
  capacidadTotal: number; // mínimo 1
  fotoUrl?: string;
}

// PATCH /flota/buses/:id — la asociación dueña no se cambia por esta vía
export type ActualizarBusDto = Partial<Omit<CrearBusDto, 'asociacionId'>> & {
  activo?: boolean;
};

export interface Horario {
  id: number;
  rutaId: string;
  diasSemana: string; // caracteres L,M,X,J,V,S,D
  horaInicio: string; // HH:mm
  horaFin: string; // HH:mm
  frecuenciaMin: number;
}

export interface CrearHorarioDto {
  rutaId: string;
  diasSemana: string; // p. ej. 'LMXJV'
  horaInicio: string; // HH:mm
  horaFin: string; // HH:mm (posterior a horaInicio)
  frecuenciaMin?: number; // default 30
}

export interface AsignacionBusRuta {
  id: string;
  rutaId: string;
  ruta?: Ruta; // presente en los listados de asignaciones
  busId: string;
  bus?: Bus; // presente en los listados de asignaciones
  conductorId: string;
  conductor?: Conductor;
  activa: boolean;
  fechaInicio: string;
  fechaFin: string | null;
}

export interface CrearAsignacionDto {
  busId: string;
  rutaId: string;
  conductorId: string;
  fechaInicio?: string; // YYYY-MM-DD (default hoy)
  fechaFin?: string; // YYYY-MM-DD
}
