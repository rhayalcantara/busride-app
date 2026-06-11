import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ActualizarBusDto,
  AsignacionBusRuta,
  Bus,
  CrearAsignacionDto,
  CrearBusDto,
  CrearHorarioDto,
  Horario,
} from './models/flota.model';

@Injectable({ providedIn: 'root' })
export class FlotaApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/flota`;

  // ---------- Buses ----------

  // POST /flota/buses — crear bus (solo admin/asociación)
  crearBus(dto: CrearBusDto): Observable<Bus> {
    return this.http.post<Bus>(`${this.baseUrl}/buses`, dto);
  }

  // GET /flota/buses/asociacion/:asociacionId — buses de una asociación
  listarBusesPorAsociacion(asociacionId: string): Observable<Bus[]> {
    return this.http.get<Bus[]>(`${this.baseUrl}/buses/asociacion/${asociacionId}`);
  }

  // PATCH /flota/buses/:id — editar bus o activarlo/desactivarlo (solo admin/asociación)
  actualizarBus(id: string, dto: ActualizarBusDto): Observable<Bus> {
    return this.http.patch<Bus>(`${this.baseUrl}/buses/${id}`, dto);
  }

  // ---------- Horarios ----------

  // POST /flota/horarios — crear horario de una ruta (solo admin/asociación)
  crearHorario(dto: CrearHorarioDto): Observable<Horario> {
    return this.http.post<Horario>(`${this.baseUrl}/horarios`, dto);
  }

  // GET /flota/horarios/ruta/:rutaId — horarios de una ruta
  listarHorariosPorRuta(rutaId: string): Observable<Horario[]> {
    return this.http.get<Horario[]>(`${this.baseUrl}/horarios/ruta/${rutaId}`);
  }

  // ---------- Asignaciones bus-ruta-conductor ----------

  // POST /flota/asignaciones — crear asignación (solo admin/asociación; 409 si bus/conductor ocupados)
  crearAsignacion(dto: CrearAsignacionDto): Observable<AsignacionBusRuta> {
    return this.http.post<AsignacionBusRuta>(`${this.baseUrl}/asignaciones`, dto);
  }

  // PATCH /flota/asignaciones/:id/desactivar — desactivar asignación (solo admin/asociación)
  desactivarAsignacion(id: string): Observable<AsignacionBusRuta> {
    return this.http.patch<AsignacionBusRuta>(`${this.baseUrl}/asignaciones/${id}/desactivar`, {});
  }

  // GET /flota/asignaciones/mias — asignaciones activas del conductor autenticado
  listarMisAsignaciones(): Observable<AsignacionBusRuta[]> {
    return this.http.get<AsignacionBusRuta[]>(`${this.baseUrl}/asignaciones/mias`);
  }

  // GET /flota/asignaciones/conductor/:conductorId — gestión (solo admin/asociación)
  listarAsignacionesPorConductor(conductorId: string): Observable<AsignacionBusRuta[]> {
    return this.http.get<AsignacionBusRuta[]>(
      `${this.baseUrl}/asignaciones/conductor/${conductorId}`,
    );
  }
}
