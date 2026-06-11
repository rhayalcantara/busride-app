import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ActualizarPerfilDto,
  CambiarPasswordDto,
  CambioEstadoUsuarioRespuesta,
  ListarUsuariosParams,
  MensajeRespuesta,
  PaginaUsuarios,
  Usuario,
} from './models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UsuariosApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/usuarios`;

  // GET /usuarios/me — perfil del usuario autenticado (con rol, sin datos sensibles)
  obtenerMiPerfil(): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.baseUrl}/me`);
  }

  // PATCH /usuarios/me — actualizar nombre, apellido o teléfono del propio perfil
  actualizarMiPerfil(dto: ActualizarPerfilDto): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.baseUrl}/me`, dto);
  }

  // PATCH /usuarios/me/password — cambiar contraseña (requiere la actual)
  cambiarPassword(dto: CambiarPasswordDto): Observable<MensajeRespuesta> {
    return this.http.patch<MensajeRespuesta>(`${this.baseUrl}/me/password`, dto);
  }

  // GET /usuarios — listado paginado (solo admin)
  listar(params: ListarUsuariosParams = {}): Observable<PaginaUsuarios> {
    let httpParams = new HttpParams();
    if (params.pagina !== undefined) httpParams = httpParams.set('pagina', params.pagina);
    if (params.limite !== undefined) httpParams = httpParams.set('limite', params.limite);
    return this.http.get<PaginaUsuarios>(this.baseUrl, { params: httpParams });
  }

  // PATCH /usuarios/:id/estado — activar/desactivar un usuario (solo admin)
  cambiarEstado(id: string, activo: boolean): Observable<CambioEstadoUsuarioRespuesta> {
    return this.http.patch<CambioEstadoUsuarioRespuesta>(`${this.baseUrl}/${id}/estado`, {
      activo,
    });
  }
}
