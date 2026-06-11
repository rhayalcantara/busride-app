// Modelos de POST /auth/usuarios (alta de usuario privilegiado, solo admin).
// El login/refresh/logout pertenecen a core/auth (F-02), no se duplican aquí.

export interface CrearUsuarioDto {
  email: string;
  password: string; // mínimo 8 caracteres
  nombre: string;
  apellido: string;
  rolId: number; // tabla roles: 1=admin, 2=asociacion, 3=conductor, 4=pasajero
}

// Respuesta de AuthService.crearUsuarioConRol
export interface UsuarioCreadoRespuesta {
  mensaje: string;
  usuarioId: string;
}
