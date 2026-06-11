import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ComprarPaqueteDto,
  CompraPaqueteRespuesta,
  Paquete,
  Saldo,
  Transaccion,
} from './models/wallet.model';

@Injectable({ providedIn: 'root' })
export class WalletApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/wallet`;

  // GET /wallet/paquetes — catálogo de paquetes de viajes (cualquier autenticado)
  listarPaquetes(): Observable<Paquete[]> {
    return this.http.get<Paquete[]>(`${this.baseUrl}/paquetes`);
  }

  // GET /wallet/mi-saldo — saldo del pasajero autenticado
  obtenerMiSaldo(): Observable<Saldo> {
    return this.http.get<Saldo>(`${this.baseUrl}/mi-saldo`);
  }

  // POST /wallet/comprar — comprar paquete (idempotente por referenciaExterna;
  // la respuesta trae el flag `idempotente`, ver CompraPaqueteRespuesta)
  comprarPaquete(dto: ComprarPaqueteDto): Observable<CompraPaqueteRespuesta> {
    return this.http.post<CompraPaqueteRespuesta>(`${this.baseUrl}/comprar`, dto);
  }

  // GET /wallet/historial — transacciones del pasajero autenticado (limite 1-100, default 20)
  historial(limite?: number): Observable<Transaccion[]> {
    let params = new HttpParams();
    if (limite !== undefined) params = params.set('limite', limite);
    return this.http.get<Transaccion[]>(`${this.baseUrl}/historial`, { params });
  }
}
