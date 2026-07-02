import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  EstadoLiquidacion,
  LiquidacionAdmin,
  LiquidacionConductor,
  LiquidacionPagadaRespuesta,
  ResumenLiquidaciones,
  ResumenLiquidacionesParams,
} from './models/liquidacion.model';

@Injectable({ providedIn: 'root' })
export class LiquidacionesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/liquidaciones`;

  // GET /liquidaciones?estado= — listado completo (solo admin, F-09a),
  // orden fecha_creacion DESC, con conductor_nombre y ruta_nombre del JOIN.
  listarTodas(estado?: EstadoLiquidacion): Observable<LiquidacionAdmin[]> {
    let params = new HttpParams();
    if (estado) params = params.set('estado', estado);
    return this.http.get<LiquidacionAdmin[]>(this.baseUrl, { params });
  }

  // GET /liquidaciones/mias — historial del conductor autenticado
  listarMias(): Observable<LiquidacionConductor[]> {
    return this.http.get<LiquidacionConductor[]>(`${this.baseUrl}/mias`);
  }

  // GET /liquidaciones/mias/resumen — resumen por período del conductor autenticado.
  // El backend devuelve el agregado como arreglo de una fila (consulta cruda).
  obtenerMiResumen(params: ResumenLiquidacionesParams = {}): Observable<ResumenLiquidaciones[]> {
    let httpParams = new HttpParams();
    if (params.inicio !== undefined) httpParams = httpParams.set('inicio', params.inicio);
    if (params.fin !== undefined) httpParams = httpParams.set('fin', params.fin);
    return this.http.get<ResumenLiquidaciones[]>(`${this.baseUrl}/mias/resumen`, {
      params: httpParams,
    });
  }

  // PATCH /liquidaciones/:id/pagar — marcar liquidación como pagada (solo admin)
  marcarPagada(id: string, referenciaPago: string): Observable<LiquidacionPagadaRespuesta> {
    return this.http.patch<LiquidacionPagadaRespuesta>(`${this.baseUrl}/${id}/pagar`, {
      referenciaPago,
    });
  }
}
