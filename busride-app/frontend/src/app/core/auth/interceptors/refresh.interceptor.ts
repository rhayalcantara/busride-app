import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth.service';
import { esRutaAuthPublica } from './auth.interceptor';

/**
 * Ante un 401 intenta UN solo refresh concurrente y reintenta la request con
 * el accessToken nuevo. La "cola" es el observable compartido de
 * AuthService.refrescar(): todas las requests que reciben 401 mientras hay un
 * refresh en vuelo se suscriben al MISMO observable, esperan el token nuevo y
 * se reintentan; solo se dispara una llamada a /auth/refresh.
 *
 * Si el refresh falla: limpia la sesión local y redirige a /login.
 *
 * Orden de registro (F-05): authInterceptor ANTES que refreshInterceptor.
 */
export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      const es401 = error instanceof HttpErrorResponse && error.status === 401;

      // No reintentar los endpoints públicos de auth (evita bucles si el
      // propio /auth/refresh devuelve 401)
      if (!es401 || esRutaAuthPublica(req)) {
        return throwError(() => error);
      }

      return auth.refrescar().pipe(
        // Solo captura fallos DEL REFRESH: los errores de la request
        // reintentada (switchMap posterior) se propagan sin tocar.
        catchError((errorRefresco: unknown) => {
          auth.limpiarSesion();
          void router.navigate(['/login']);
          return throwError(() => errorRefresco);
        }),
        switchMap((accessToken) =>
          next(req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })),
        ),
      );
    }),
  );
};
