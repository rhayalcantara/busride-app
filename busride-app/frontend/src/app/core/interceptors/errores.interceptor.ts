import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

/**
 * Interceptor global de errores HTTP (tercero en la cadena, tras auth y refresh):
 *
 * - 403 → snackbar "Sin permisos".
 * - 0 (sin conexión) y 5xx → snackbar genérico de error del servidor.
 * - 401 NO se toca aquí: lo gestiona refreshInterceptor (refresh + reintento).
 * - 400/404/409 NO se tratan globalmente: cada feature muestra el mensaje
 *   del backend en su propio contexto.
 *
 * Siempre re-lanza el error para que el llamador pueda reaccionar igualmente.
 */
export const erroresInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 403) {
          snackBar.open('Sin permisos para realizar esta acción', 'Cerrar', { duration: 5000 });
        } else if (error.status === 0 || error.status >= 500) {
          snackBar.open('Error del servidor. Inténtalo de nuevo más tarde.', 'Cerrar', {
            duration: 5000,
          });
        }
      }
      return throwError(() => error);
    }),
  );
};
