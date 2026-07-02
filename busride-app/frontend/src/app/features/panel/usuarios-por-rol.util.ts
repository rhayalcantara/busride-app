import { Observable, map } from 'rxjs';
import { ListarUsuariosParams, Usuario, UsuariosApi } from '../../core/api';

/**
 * Usuarios ACTIVOS con un rol concreto, para los selectores del panel
 * (vincular admin de asociación, alta de conductor, etc.).
 *
 * Usa el filtro del backend `GET /usuarios?rol=` (F-09a) y descarta en
 * cliente solo los inactivos. SOLO usable con sesión admin
 * (GET /usuarios es admin-only).
 */
export function usuariosActivosConRol(
  usuariosApi: UsuariosApi,
  rolNombre: NonNullable<ListarUsuariosParams['rol']>,
): Observable<Usuario[]> {
  return usuariosApi
    .listar({ pagina: 1, limite: 100, rol: rolNombre })
    .pipe(map((pagina) => pagina.datos.filter((usuario) => usuario.activo)));
}

/** Etiqueta legible de un usuario para mat-option. */
export function etiquetaUsuario(usuario: Usuario): string {
  const nombre = `${usuario.nombre} ${usuario.apellido}`.trim();
  return nombre ? `${nombre} — ${usuario.email}` : usuario.email;
}
