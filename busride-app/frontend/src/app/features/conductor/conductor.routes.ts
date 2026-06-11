import { Routes } from '@angular/router';
import { ConductorShellComponent } from './conductor-shell.component';

/**
 * Rutas del área conductor (F-07). El shell envuelve a las páginas hijas con
 * <app-shell> (toolbar + sidenav móvil primero); los guards de auth/rol los
 * aplica app.routes.ts al cargar el área — aquí NO se añaden guards.
 */
export const CONDUCTOR_ROUTES: Routes = [
  {
    path: '',
    component: ConductorShellComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./inicio/inicio.component').then((m) => m.InicioConductorComponent),
      },
      {
        path: 'viaje',
        loadComponent: () =>
          import('./viaje-activo/viaje-activo.component').then((m) => m.ViajeActivoComponent),
      },
      {
        path: 'abordar',
        loadComponent: () =>
          import('./abordar/abordar.component').then((m) => m.AbordarComponent),
      },
      {
        path: 'finalizar',
        loadComponent: () =>
          import('./finalizar/finalizar.component').then((m) => m.FinalizarViajeComponent),
      },
      {
        path: 'liquidaciones',
        loadComponent: () =>
          import('./liquidaciones/liquidaciones.component').then(
            (m) => m.LiquidacionesConductorComponent,
          ),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
