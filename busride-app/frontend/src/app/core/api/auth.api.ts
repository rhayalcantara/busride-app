import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CrearUsuarioDto, UsuarioCreadoRespuesta } from './models/auth.model';

// SOLO el alta de usuarios privilegiados para el panel admin.
// El login/refresh/logout viven en core/auth (F-02) — no se duplican aquí.
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  // POST /auth/usuarios — crear usuario con rol específico (solo admin)
  crearUsuario(dto: CrearUsuarioDto): Observable<UsuarioCreadoRespuesta> {
    return this.http.post<UsuarioCreadoRespuesta>(`${this.baseUrl}/usuarios`, dto);
  }
}
