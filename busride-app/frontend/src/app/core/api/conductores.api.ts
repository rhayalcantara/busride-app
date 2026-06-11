import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CalificacionRegistrada,
  CalificarConductorDto,
  ConductorCreadoRespuesta,
  ConductorDeAsociacion,
  CrearConductorDto,
  PerfilConductor,
} from './models/conductor.model';

@Injectable({ providedIn: 'root' })
export class ConductoresApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/conductores`;

  // POST /conductores — alta de conductor (solo admin/asociación)
  crear(dto: CrearConductorDto): Observable<ConductorCreadoRespuesta> {
    return this.http.post<ConductorCreadoRespuesta>(this.baseUrl, dto);
  }

  // GET /conductores/me — perfil del conductor autenticado (con calificación promedio)
  obtenerMiPerfil(): Observable<PerfilConductor> {
    return this.http.get<PerfilConductor>(`${this.baseUrl}/me`);
  }

  // GET /conductores/asociacion/:asociacionId — listado por asociación (admin/asociación)
  listarPorAsociacion(asociacionId: string): Observable<ConductorDeAsociacion[]> {
    return this.http.get<ConductorDeAsociacion[]>(`${this.baseUrl}/asociacion/${asociacionId}`);
  }

  // POST /conductores/:id/calificar — pasajero califica a un conductor
  calificar(conductorId: string, dto: CalificarConductorDto): Observable<CalificacionRegistrada> {
    return this.http.post<CalificacionRegistrada>(`${this.baseUrl}/${conductorId}/calificar`, dto);
  }
}
