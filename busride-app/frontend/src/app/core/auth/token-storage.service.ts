import { Injectable } from '@angular/core';
import { ParTokens } from './models/sesion.model';

const CLAVE_ACCESS_TOKEN = 'busride.accessToken';
const CLAVE_REFRESH_TOKEN = 'busride.refreshToken';

/**
 * Persistencia del par de tokens en localStorage.
 * Único punto de acceso al almacenamiento: AuthService y los interceptores
 * nunca tocan localStorage directamente.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  guardarTokens(tokens: ParTokens): void {
    localStorage.setItem(CLAVE_ACCESS_TOKEN, tokens.accessToken);
    localStorage.setItem(CLAVE_REFRESH_TOKEN, tokens.refreshToken);
  }

  obtenerAccessToken(): string | null {
    return localStorage.getItem(CLAVE_ACCESS_TOKEN);
  }

  obtenerRefreshToken(): string | null {
    return localStorage.getItem(CLAVE_REFRESH_TOKEN);
  }

  limpiar(): void {
    localStorage.removeItem(CLAVE_ACCESS_TOKEN);
    localStorage.removeItem(CLAVE_REFRESH_TOKEN);
  }
}
