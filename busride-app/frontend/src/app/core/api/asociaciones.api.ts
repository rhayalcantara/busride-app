import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ActualizarAsociacionDto,
  Asociacion,
  AsociacionConRutas,
  CrearAsociacionDto,
} from './models/asociacion.model';

@Injectable({ providedIn: 'root' })
export class AsociacionesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/asociaciones`;

  // POST /asociaciones — crear en estado PENDIENTE (solo admin)
  crear(dto: CrearAsociacionDto): Observable<Asociacion> {
    return this.http.post<Asociacion>(this.baseUrl, dto);
  }

  // GET /asociaciones — listar activas (cualquier usuario autenticado)
  listarActivas(): Observable<Asociacion[]> {
    return this.http.get<Asociacion[]>(this.baseUrl);
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
