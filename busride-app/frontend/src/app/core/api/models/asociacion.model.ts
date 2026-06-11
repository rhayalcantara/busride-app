// Modelos del módulo asociaciones — espejo de asociaciones.controller/service del backend.
import type { Ruta } from './ruta.model';

export type EstadoAsociacion = 'PENDIENTE' | 'ACTIVA' | 'SUSPENDIDA';

export interface Asociacion {
  id: string;
  usuarioId: string;
  nombre: string;
  rnc: string | null;
  direccion: string | null;
  telefono: string | null;
  logoUrl: string | null;
  estado: EstadoAsociacion;
  comisionPct: number;
  fechaAprobacion: string | null;
  aprobadoPor: string | null;
  fechaCreacion: string;
}

export interface CrearAsociacionDto {
  usuarioId: string; // usuario administrador de la asociación
  nombre: string;
  rnc?: string;
  direccion?: string;
  telefono?: string;
  logoUrl?: string;
  comisionPct?: number; // 0-100, default 15.00
}

// El usuario admin se cambia solo vía PATCH /asociaciones/:id/usuario-admin
export type ActualizarAsociacionDto = Partial<Omit<CrearAsociacionDto, 'usuarioId'>>;

export interface VincularUsuarioAdminDto {
  usuarioId: string;
}

// Respuesta de GET /asociaciones/:id
export interface AsociacionConRutas extends Asociacion {
  rutas: Ruta[];
}
