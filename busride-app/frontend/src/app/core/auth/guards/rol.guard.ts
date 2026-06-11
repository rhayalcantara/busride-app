import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { Rol } from '../models/sesion.model';

/** Home de cada rol: destino al rechazar el acceso a una ruta ajena. */
export const HOME_POR_ROL: Record<Rol, string> = {
  [Rol.PASAJERO]: '/pasajero',
  [Rol.CONDUCTOR]: '/conductor',
  [Rol.ADMIN]: '/panel',
  [Rol.ASOCIACION]: '/panel',
};

/**
 * Fábrica de guard por rol. Uso en rutas:
 *   canActivate: [authGuard, rolGuard([Rol.ADMIN, Rol.ASOCIACION])]
 *
 * - Sin sesión → /login.
 * - Con sesión pero rol no autorizado → home del rol propio.
 */
export function rolGuard(roles: Rol[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const rol = auth.rol();
    if (rol === null) {
      return router.createUrlTree(['/login']);
    }

    if (roles.includes(rol)) {
      return true;
    }

    return router.createUrlTree([HOME_POR_ROL[rol] ?? '/login']);
  };
}
