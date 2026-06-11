import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Usuario, UsuariosApi } from '../../core/api';
import { AuthService } from '../../core/auth';
import { ItemMenuShell, ShellComponent } from '../../shared';

/**
 * Layout del área pasajero: <app-shell> con el menú propio y un
 * <router-outlet> para las páginas hijas (buscar, reservar, viaje en vivo,
 * wallet, mis reservas). Rehidrata nombre/apellido vía GET /usuarios/me
 * cuando la sesión se restauró desde el JWT (que no los trae).
 */
@Component({
  selector: 'app-pasajero-shell',
  imports: [ShellComponent, RouterOutlet],
  template: `
    <app-shell
      titulo="BusRide — Pasajero"
      [itemsMenu]="itemsMenu"
      [nombreUsuario]="nombreUsuario()"
      (cerrarSesion)="salir()"
    >
      <router-outlet />
    </app-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasajeroShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly usuariosApi = inject(UsuariosApi);

  protected readonly itemsMenu: ItemMenuShell[] = [
    { label: 'Buscar ruta', icono: 'search', ruta: '/pasajero' },
    { label: 'Mis reservas', icono: 'confirmation_number', ruta: '/pasajero/reservas' },
    { label: 'Wallet', icono: 'account_balance_wallet', ruta: '/pasajero/wallet' },
  ];

  /** Perfil rehidratado desde la API (el JWT no trae nombre/apellido). */
  private readonly perfil = signal<Usuario | null>(null);

  protected readonly nombreUsuario = computed(() => {
    const perfil = this.perfil();
    if (perfil) {
      return `${perfil.nombre} ${perfil.apellido}`.trim() || perfil.email;
    }
    const usuario = this.auth.usuario();
    if (!usuario) return '';
    return `${usuario.nombre} ${usuario.apellido}`.trim() || usuario.email;
  });

  constructor() {
    const usuario = this.auth.usuario();
    if (usuario && !usuario.nombre) {
      this.usuariosApi.obtenerMiPerfil().subscribe({
        next: (perfil) => this.perfil.set(perfil),
        error: () => undefined, // el email del JWT sirve de respaldo
      });
    }
  }

  salir(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
