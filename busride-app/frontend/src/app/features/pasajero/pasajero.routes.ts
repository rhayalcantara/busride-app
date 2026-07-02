import { Routes } from '@angular/router';
import { PasajeroShellComponent } from './pasajero-shell.component';

/**
 * Rutas del área pasajero (F-06). `app.routes.ts` ya aplica authGuard +
 * rolGuard([Rol.PASAJERO]) sobre `/pasajero`: aquí NO van guards.
 *
 * Mapa:
 * - /pasajero               → Buscar ruta (home: mapa + búsqueda geoespacial)
 * - /pasajero/reservar      → Reservar asiento + QR de abordaje
 * - /pasajero/viaje/:viajeId→ Viaje en vivo (tracking por socket)
 * - /pasajero/wallet        → Saldo, paquetes, historial
 * - /pasajero/reservas      → Mis reservas + calificar conductor
 */
export const PASAJERO_ROUTES: Routes = [
  {
    path: '',
    component: PasajeroShellComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./buscar/buscar.component').then((m) => m.BuscarComponent),
        title: 'BusRide — Buscar ruta',
      },
      {
        path: 'reservar',
        loadComponent: () =>
          import('./reservar/reservar.component').then((m) => m.ReservarComponent),
        title: 'BusRide — Reservar',
      },
      {
        path: 'viaje/:viajeId',
        loadComponent: () =>
          import('./viaje-vivo/viaje-vivo.component').then((m) => m.ViajeVivoComponent),
        title: 'BusRide — Viaje en vivo',
      },
      {
        path: 'wallet',
        loadComponent: () => import('./wallet/wallet.component').then((m) => m.WalletComponent),
        title: 'BusRide — Wallet',
      },
      {
        path: 'reservas',
        loadComponent: () =>
          import('./mis-reservas/mis-reservas.component').then((m) => m.MisReservasComponent),
        title: 'BusRide — Mis reservas',
      },
    ],
  },
];
