import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AbordajeConfirmado,
  ConfirmarAbordajeDto,
  CrearReservaDto,
  Reserva,
  ReservaCreada,
} from './models/reserva.model';

@Injectable({ providedIn: 'root' })
export class ReservasApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/reservas`;

  // POST /reservas — pasajero reserva asiento; devuelve QR (token + imagen base64)
  crear(dto: CrearReservaDto): Observable<ReservaCreada> {
    return this.http.post<ReservaCreada>(this.baseUrl, dto);
  }

  // POST /reservas/abordar — conductor escanea QR y confirma abordaje
  confirmarAbordaje(dto: ConfirmarAbordajeDto): Observable<AbordajeConfirmado> {
    return this.http.post<AbordajeConfirmado>(`${this.baseUrl}/abordar`, dto);
  }

  // GET /reservas/mias — historial de reservas del pasajero autenticado
  listarMias(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>(`${this.baseUrl}/mias`);
  }
}
