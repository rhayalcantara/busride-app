import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthService, HOME_POR_ROL, Rol, authGuard, rolGuard } from './core/auth';

/**
 * Rutas raíz de la app (cableadas en F-05):
 *
 * - /login y /registro: públicas.
 * - /pasajero, /conductor, /panel: áreas lazy protegidas con authGuard +
 *   rolGuard. Cada área define sus páginas en su propio `<area>.routes.ts`
 *   (propiedad exclusiva de F-06/F-07/F-08 — aquí solo placeholders).
 * - '' redirige según la sesión restaurada por el appInitializer.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./features/auth/registro/registro.component').then((m) => m.RegistroComponent),
  },
  {
    path: 'pasajero',
    canActivate: [authGuard, rolGuard([Rol.PASAJERO])],
    loadChildren: () => import('./features/pasajero/pasajero.routes').then((m) => m.PASAJERO_ROUTES),
  },
  {
    path: 'conductor',
    canActivate: [authGuard, rolGuard([Rol.CONDUCTOR])],
    loadChildren: () =>
      import('./features/conductor/conductor.routes').then((m) => m.CONDUCTOR_ROUTES),
  },
  {
    path: 'panel',
    canActivate: [authGuard, rolGuard([Rol.ADMIN, Rol.ASOCIACION])],
    loadChildren: () => import('./features/panel/panel.routes').then((m) => m.PANEL_ROUTES),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => {
      const rol = inject(AuthService).rol();
      return rol ? HOME_POR_ROL[rol] : '/login';
    },
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/auth/no-encontrada/no-encontrada.component').then(
        (m) => m.NoEncontradaComponent,
      ),
  },
];
