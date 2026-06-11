// Modelos del módulo conductores — espejo de conductores.controller/service del backend.
import type { Usuario } from './usuario.model';
import type { Asociacion } from './asociacion.model';

export interface Conductor {
  id: string;
  usuarioId: string;
  usuario?: Usuario;
  asociacionId: string;
  asociacion?: Asociacion;
  licenciaNumero: string;
  licenciaVence: string;
  fotoUrl: string | null;
  calificacionPromedio: number;
  totalViajes: number;
  cuentaBancaria: string | null;
  banco: string | null;
  activo: boolean;
  fechaCreacion: string;
}

export interface CrearConductorDto {
  usuarioId: string; // usuario existente con rol conductor
  asociacionId: string;
  licenciaNumero: string;
  licenciaVence: string; // YYYY-MM-DD
  fotoUrl?: string;
  cuentaBancaria?: string;
  banco?: string;
}

// Respuesta de POST /conductores
export interface ConductorCreadoRespuesta {
  mensaje: string;
  conductor: Conductor;
}

// Respuesta de GET /conductores/me (proyección camelCase del service)
export interface PerfilConductor {
  id: string;
  usuarioId: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string | null;
  asociacion: { id: string; nombre: string } | null;
  licenciaNumero: string;
  licenciaVence: string;
  fotoUrl: string | null;
  calificacionPromedio: number;
  totalViajes: number;
  cuentaBancaria: string | null;
  banco: string | null;
  activo: boolean;
  fechaCreacion: string;
}

// Fila de GET /conductores/asociacion/:asociacionId (proyección del service)
export interface ConductorDeAsociacion {
  id: string;
  usuarioId: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  licenciaNumero: string;
  licenciaVence: string;
  fotoUrl: string | null;
  calificacionPromedio: number;
  totalViajes: number;
  activo: boolean;
}

export interface CalificarConductorDto {
  viajeId: string; // viaje en el que el pasajero abordó con este conductor
  estrellas: number; // 1-5
  comentario?: string;
}

// Respuesta de POST /conductores/:id/calificar
export interface CalificacionRegistrada {
  mensaje: string;
  calificacion: {
    id: string;
    abordajeId: string;
    conductorId: string;
    estrellas: number;
    comentario: string | null;
  };
  calificacionPromedio: number | null;
}
