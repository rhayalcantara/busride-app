import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PasajeroEnParada,
  PosicionActualizada,
  Viaje,
  ViajeFinalizado,
} from './models/viaje.model';

@Injectable({ providedIn: 'root' })
export class ViajesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/viajes`;

  // POST /viajes/iniciar — conductor autenticado inicia ruta con su asignación
  iniciar(asignacionId: string): Observable<Viaje> {
    return this.http.post<Viaje>(`${this.baseUrl}/iniciar`, { asignacionId });
  }

  // PATCH /viajes/:id/posicion — actualizar posición GPS del bus (solo el conductor del viaje)
  actualizarPosicion(viajeId: string, lat: number, lng: number): Observable<PosicionActualizada> {
    return this.http.patch<PosicionActualizada>(`${this.baseUrl}/${viajeId}/posicion`, {
      lat,
      lng,
    });
  }

  // POST /viajes/:id/finalizar — finaliza la ruta y genera la liquidación (sp_liquidar_viaje)
  finalizar(viajeId: string): Observable<ViajeFinalizado> {
    return this.http.post<ViajeFinalizado>(`${this.baseUrl}/${viajeId}/finalizar`, {});
  }

  // GET /viajes/mi-activo — viaje EN_CURSO del conductor autenticado (null si no hay)
  obtenerMiActivo(): Observable<Viaje | null> {
    return this.http.get<Viaje | null>(`${this.baseUrl}/mi-activo`);
  }

  // GET /viajes/:id/parada/:paradaId/pasajeros — pasajeros esperando en una parada
  pasajerosEnParada(viajeId: string, paradaId: number): Observable<PasajeroEnParada[]> {
    return this.http.get<PasajeroEnParada[]>(
      `${this.baseUrl}/${viajeId}/parada/${paradaId}/pasajeros`,
    );
  }
}
