import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth';
import { ConductoresApi } from '../../core/api';
import { ItemMenuShell, ShellComponent } from '../../shared';

/**
 * Shell del área conductor: toolbar + sidenav compartidos por todas las
 * páginas hijas (router-outlet). Rehidrata el nombre del usuario vía
 * GET /conductores/me cuando la sesión fue restaurada desde el JWT
 * (nombre/apellido llegan vacíos del payload).
 */
@Component({
  selector: 'app-conductor-shell',
  imports: [ShellComponent, RouterOutlet],
  template: `
    <app-shell
      titulo="BusRide — Conductor"
      [itemsMenu]="itemsMenu"
      [nombreUsuario]="nombreUsuario()"
      (cerrarSesion)="salir()"
    >
      <router-outlet />
    </app-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConductorShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly conductoresApi = inject(ConductoresApi);

  protected readonly itemsMenu: ItemMenuShell[] = [
    { label: 'Inicio', icono: 'home', ruta: '/conductor' },
    { label: 'Viaje activo', icono: 'directions_bus', ruta: '/conductor/viaje' },
    { label: 'Abordar pasajero', icono: 'qr_code_scanner', ruta: '/conductor/abordar' },
    { label: 'Finalizar viaje', icono: 'flag', ruta: '/conductor/finalizar' },
    { label: 'Liquidaciones', icono: 'payments', ruta: '/conductor/liquidaciones' },
  ];

  /** Nombre obtenido de GET /conductores/me cuando el JWT no lo trae. */
  private readonly nombrePerfil = signal('');

  protected readonly nombreUsuario = computed(() => {
    const usuario = this.auth.usuario();
    if (!usuario) return '';
    const nombreSesion = `${usuario.nombre} ${usuario.apellido}`.trim();
    return nombreSesion || this.nombrePerfil() || usuario.email;
  });

  constructor() {
    const usuario = this.auth.usuario();
    const sinNombre = !usuario || `${usuario.nombre} ${usuario.apellido}`.trim() === '';
    if (sinNombre) {
      this.conductoresApi.obtenerMiPerfil().subscribe({
        next: (perfil) =>
          this.nombrePerfil.set(`${perfil.nombre ?? ''} ${perfil.apellido ?? ''}`.trim()),
        // Sin perfil de conductor: se queda el email; las páginas ya avisan.
        error: () => undefined,
      });
    }
  }

  salir(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
