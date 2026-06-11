import { Routes } from '@angular/router';

// Rutas mínimas de la Ola F1. F-05 (Ola F3) define las rutas reales:
// /login, /registro y las áreas lazy /pasajero, /conductor y /panel.
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login-placeholder.component').then(
        (m) => m.LoginPlaceholderComponent,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
