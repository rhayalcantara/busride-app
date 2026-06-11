// Modelos de sesión del frontend. Espejan EXACTAMENTE las formas que expone
// el backend NestJS (backend/src/modules/auth): no añadir campos extra a los
// DTOs de envío porque el ValidationPipe global usa forbidNonWhitelisted.

/**
 * Nombres de rol tal como existen en la tabla `roles` del backend
 * (ver backend/src/common/decorators/roles.decorator.ts — RolNombre).
 */
export enum Rol {
  ADMIN = 'admin',
  ASOCIACION = 'asociacion',
  CONDUCTOR = 'conductor',
  PASAJERO = 'pasajero',
}

/** Usuario tal como lo devuelve POST /auth/login en la propiedad `usuario`. */
export interface UsuarioSesion {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: Rol;
}

/** Sesión completa en memoria: par de tokens + usuario autenticado. */
export interface Sesion {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioSesion;
}

/** Cuerpo de POST /auth/login (LoginDto del backend). */
export interface Credenciales {
  email: string;
  password: string;
}

/**
 * Cuerpo de POST /auth/registrar (RegistrarDto del backend).
 * SOLO crea pasajeros; el backend NO acepta rolId (responde 400 si se envía).
 */
export interface DatosRegistro {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
}

/** Respuesta de POST /auth/refresh: el backend ROTA el refresh token. */
export interface ParTokens {
  accessToken: string;
  refreshToken: string;
}

/** Respuesta de POST /auth/login. */
export interface RespuestaLogin extends ParTokens {
  usuario: UsuarioSesion;
}

/** Respuesta de POST /auth/registrar. */
export interface RespuestaRegistro {
  mensaje: string;
  usuarioId: string;
}

/**
 * Payload del access token JWT que firma el backend
 * (AuthService.emitirTokens: { sub, email, rol } + iat/exp estándar).
 */
export interface PayloadJwt {
  sub: string;
  email: string;
  rol: Rol;
  iat: number;
  exp: number;
}
