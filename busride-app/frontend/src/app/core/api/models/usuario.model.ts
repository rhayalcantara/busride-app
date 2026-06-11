// Modelos del módulo usuarios — espejo de usuarios.controller/service del backend.
// Las fechas viajan como string ISO en el JSON.

export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
}

// `UsuarioPublico` del backend: entidad Usuario sin passwordHash ni tokenVerificacion
export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  rolId: number;
  rol: Rol;
  activo: boolean;
  verificado: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
  ultimoLogin: string | null;
}

export interface ActualizarPerfilDto {
  nombre?: string;
  apellido?: string;
  telefono?: string;
}

export interface CambiarPasswordDto {
  passwordActual: string;
  passwordNueva: string;
}

export interface CambiarEstadoDto {
  activo: boolean;
}

export interface ListarUsuariosParams {
  pagina?: number; // desde 1 (default 1)
  limite?: number; // 1-100 (default 20)
}

// Respuesta de GET /usuarios (listado paginado, solo admin)
export interface PaginaUsuarios {
  datos: Usuario[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

export interface MensajeRespuesta {
  mensaje: string;
}

// Respuesta de PATCH /usuarios/:id/estado
export interface CambioEstadoUsuarioRespuesta {
  mensaje: string;
  usuario: Usuario;
}
