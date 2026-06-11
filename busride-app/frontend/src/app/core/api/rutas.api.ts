import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BuscarRutasParams,
  CrearRutaDto,
  ParadaConUbicacion,
  Ruta,
  RutaDisponible,
} from './models/ruta.model';

@Injectable({ providedIn: 'root' })
export class RutasApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/rutas`;

  // GET /rutas/buscar — rutas disponibles cerca del origen y destino (sp_buscar_rutas_disponibles)
  buscar(params: BuscarRutasParams): Observable<RutaDisponible[]> {
    let httpParams = new HttpParams()
      .set('latOrigen', params.latOrigen)
      .set('lngOrigen', params.lngOrigen)
      .set('latDestino', params.latDestino)
      .set('lngDestino', params.lngDestino);
    if (params.radioMetros !== undefined) {
      httpParams = httpParams.set('radioMetros', params.radioMetros);
    }
    return this.http.get<RutaDisponible[]>(`${this.baseUrl}/buscar`, { params: httpParams });
  }

  // POST /rutas — crear ruta con paradas (asociación: la suya; admin: indica asociacionId)
  crear(dto: CrearRutaDto): Observable<Ruta> {
    return this.http.post<Ruta>(this.baseUrl, dto);
  }

  // GET /rutas/asociacion/:asociacionId — rutas activas de una asociación (con paradas)
  listarPorAsociacion(asociacionId: string): Observable<Ruta[]> {
    return this.http.get<Ruta[]>(`${this.baseUrl}/asociacion/${asociacionId}`);
  }

  // GET /rutas/:id — detalle con paradas y asociación
  obtener(id: string): Observable<Ruta> {
    return this.http.get<Ruta>(`${this.baseUrl}/${id}`);
  }

  // GET /rutas/:id/paradas — paradas con coordenadas lat/lng (desde geography)
  obtenerParadas(rutaId: string): Observable<ParadaConUbicacion[]> {
    return this.http.get<ParadaConUbicacion[]>(`${this.baseUrl}/${rutaId}/paradas`);
  }
}
