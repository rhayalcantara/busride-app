import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenStorage } from '../token-storage.service';

// Endpoints de auth que NO llevan Authorization (son @Public() en el backend;
// /auth/refresh autentica con el refresh token en el cuerpo, no con el header).
const RUTAS_SIN_TOKEN = ['/auth/login', '/auth/registrar', '/auth/refresh'];

/** true si la request va a un endpoint público de auth (login/registrar/refresh). */
export function esRutaAuthPublica(req: HttpRequest<unknown>): boolean {
  return RUTAS_SIN_TOKEN.some((ruta) => req.url.includes(ruta));
}

/**
 * Añade `Authorization: Bearer <accessToken>` a toda request salvo a los
 * endpoints públicos de auth. Si no hay token almacenado, no toca la request.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (esRutaAuthPublica(req)) {
    return next(req);
  }

  const accessToken = inject(TokenStorage).obtenerAccessToken();
  if (!accessToken) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }));
};
