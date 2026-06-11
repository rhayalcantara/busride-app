import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { AuthService } from '../../core/auth';
import { ItemMenuShell, ShellComponent } from '../../shared';

/**
 * Placeholder de la Ola F3. F-06 (Ola F4) reemplaza ESTE archivo completo con
 * las páginas reales del pasajero (buscar ruta, reservar, viaje en vivo,
 * wallet, mis reservas). Patrón a seguir: páginas standalone envueltas en
 * <app-shell> con itemsMenu propios y logout vía AuthService + Router.
 */
@Component({
  selector: 'app-pasajero-en-construccion',
  imports: [ShellComponent],
  template: `
    <app-shell
      titulo="BusRide — Pasajero"
      [itemsMenu]="itemsMenu"
      [nombreUsuario]="nombreUsuario()"
      (cerrarSesion)="salir()"
    >
      <h2>Área en construcción</h2>
      <p>Las páginas del pasajero llegan en la Ola F4 (tarea F-06).</p>
    </app-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasajeroEnConstruccionComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly itemsMenu: ItemMenuShell[] = [
    { label: 'Inicio', icono: 'home', ruta: '/pasajero' },
  ];

  protected readonly nombreUsuario = computed(() => {
    const usuario = this.auth.usuario();
    if (!usuario) return '';
    return `${usuario.nombre} ${usuario.apellido}`.trim() || usuario.email;
  });

  salir(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}

export const PASAJERO_ROUTES: Routes = [
  { path: '', component: PasajeroEnConstruccionComponent },
];
