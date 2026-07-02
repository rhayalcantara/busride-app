import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ActualizarAsociacionDto,
  Asociacion,
  AsociacionConRutas,
  CrearAsociacionDto,
  EstadoAsociacion,
} from './models/asociacion.model';

@Injectable({ providedIn: 'root' })
export class AsociacionesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/asociaciones`;

  // POST /asociaciones — crear en estado PENDIENTE (solo admin)
  crear(dto: CrearAsociacionDto): Observable<Asociacion> {
    return this.http.post<Asociacion>(this.baseUrl, dto);
  }

  // GET /asociaciones[?estado=] — sin parámetro lista las ACTIVAS (cualquier
  // usuario autenticado); con ?estado= (PENDIENTE|ACTIVA|SUSPENDIDA) solo admin (F-09a).
  listar(estado?: EstadoAsociacion): Observable<Asociacion[]> {
    let params = new HttpParams();
    if (estado) params = params.set('estado', estado);
    return this.http.get<Asociacion[]>(this.baseUrl, { params });
  }

  // GET /asociaciones/mia — asociación vinculada al usuario autenticado
  // (rol asociacion; 404 si no está vinculada a ninguna). F-09a.
  obtenerMia(): Observable<Asociacion> {
    return this.http.get<Asociacion>(`${this.baseUrl}/mia`);
  }

  // GET /asociaciones/:id — detalle con sus rutas
  obtenerDetalle(id: string): Observable<AsociacionConRutas> {
    return this.http.get<AsociacionConRutas>(`${this.baseUrl}/${id}`);
  }

  // PATCH /asociaciones/:id — actualizar datos (solo admin)
  actualizar(id: string, dto: ActualizarAsociacionDto): Observable<Asociacion> {
    return this.http.patch<Asociacion>(`${this.baseUrl}/${id}`, dto);
  }

  // PATCH /asociaciones/:id/aprobar — aprobar y activar (solo admin)
  aprobar(id: string): Observable<Asociacion> {
    return this.http.patch<Asociacion>(`${this.baseUrl}/${id}/aprobar`, {});
  }

  // PATCH /asociaciones/:id/usuario-admin — vincular usuario administrador (solo admin)
  vincularUsuarioAdmin(id: string, usuarioId: string): Observable<Asociacion> {
    return this.http.patch<Asociacion>(`${this.baseUrl}/${id}/usuario-admin`, { usuarioId });
  }
}
