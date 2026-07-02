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
        title: 'BusRide — Conductor',
      },
      {
        path: 'viaje',
        loadComponent: () =>
          import('./viaje-activo/viaje-activo.component').then((m) => m.ViajeActivoComponent),
        title: 'BusRide — Viaje activo',
      },
      {
        path: 'abordar',
        loadComponent: () =>
          import('./abordar/abordar.component').then((m) => m.AbordarComponent),
        title: 'BusRide — Abordar pasajero',
      },
      {
        path: 'finalizar',
        loadComponent: () =>
          import('./finalizar/finalizar.component').then((m) => m.FinalizarViajeComponent),
        title: 'BusRide — Finalizar viaje',
      },
      {
        path: 'liquidaciones',
        loadComponent: () =>
          import('./liquidaciones/liquidaciones.component').then(
            (m) => m.LiquidacionesConductorComponent,
          ),
        title: 'BusRide — Mis liquidaciones',
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
