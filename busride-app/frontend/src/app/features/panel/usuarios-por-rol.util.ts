import { Observable, map } from 'rxjs';
import { Usuario, UsuariosApi } from '../../core/api';

/**
 * Usuarios ACTIVOS con un rol concreto, para los selectores del panel
 * (vincular admin de asociación, alta de conductor, etc.).
 *
 * El backend no expone filtro por rol en GET /usuarios (solo paginación),
 * así que se trae la primera página al máximo permitido (limite=100) y se
 * filtra en cliente. LIMITACIÓN: con más de 100 usuarios, los que caigan
 * fuera de la primera página no aparecerán en los selectores (fricción
 * reportada para F-09: falta `GET /usuarios?rol=` en el backend).
 *
 * SOLO usable con sesión admin (GET /usuarios es admin-only).
 */
export function usuariosActivosConRol(
  usuariosApi: UsuariosApi,
  rolNombre: string,
): Observable<Usuario[]> {
  return usuariosApi.listar({ pagina: 1, limite: 100 }).pipe(
    map((pagina) =>
      pagina.datos.filter((usuario) => usuario.activo && usuario.rol?.nombre === rolNombre),
    ),
  );
}

/** Etiqueta legible de un usuario para mat-option. */
export function etiquetaUsuario(usuario: Usuario): string {
  const nombre = `${usuario.nombre} ${usuario.apellido}`.trim();
  return nombre ? `${nombre} — ${usuario.email}` : usuario.email;
}
