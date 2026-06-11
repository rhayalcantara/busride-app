import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthService, Rol } from '../../core/auth';
import { AsociacionContextoService } from './asociacion-contexto.service';
import { PanelShellComponent } from './panel-shell.component';

/**
 * Rutas del área /panel (tarea F-08).
 *
 * El acceso al área ya está protegido en app.routes.ts con
 * `authGuard + rolGuard([admin, asociacion])`; aquí NO se añaden guards.
 * Dentro, la visibilidad se condiciona por rol:
 * - admin: usuarios, asociaciones, conductores, flota, rutas, liquidaciones.
 * - asociacion: conductores, flota, rutas (el menú del shell filtra el resto;
 *   si navega a mano a una página admin, el backend responde 403 y el
 *   interceptor global lo notifica).
 *
 * El AsociacionContextoService (asociación de trabajo seleccionada) se provee
 * en la ruta raíz para compartirlo entre las páginas del área.
 */
export const PANEL_ROUTES: Routes = [
  {
    path: '',
    component: PanelShellComponent,
    providers: [AsociacionContextoService],
    children: [
      {
        path: '',
        pathMatch: 'full',
        // Home por rol: admin aterriza en usuarios; asociación, en conductores
        redirectTo: () => (inject(AuthService).rol() === Rol.ADMIN ? 'usuarios' : 'conductores'),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./paginas/usuarios/usuarios.page').then((m) => m.UsuariosPageComponent),
        title: 'BusRide — Usuarios',
      },
      {
        path: 'asociaciones',
        loadComponent: () =>
          import('./paginas/asociaciones/asociaciones.page').then(
            (m) => m.AsociacionesPageComponent,
          ),
        title: 'BusRide — Asociaciones',
      },
      {
        path: 'conductores',
        loadComponent: () =>
          import('./paginas/conductores/conductores.page').then((m) => m.ConductoresPageComponent),
        title: 'BusRide — Conductores',
      },
      {
        path: 'flota',
        loadComponent: () => import('./paginas/flota/flota.page').then((m) => m.FlotaPageComponent),
        title: 'BusRide — Flota',
      },
      {
        path: 'rutas',
        loadComponent: () => import('./paginas/rutas/rutas.page').then((m) => m.RutasPageComponent),
        title: 'BusRide — Rutas',
      },
      {
        path: 'rutas/crear',
        loadComponent: () =>
          import('./paginas/rutas/crear-ruta.page').then((m) => m.CrearRutaPageComponent),
        title: 'BusRide — Nueva ruta',
      },
      {
        path: 'liquidaciones',
        loadComponent: () =>
          import('./paginas/liquidaciones/liquidaciones.page').then(
            (m) => m.LiquidacionesPageComponent,
          ),
        title: 'BusRide — Liquidaciones',
      },
    ],
  },
];
