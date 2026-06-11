import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { UsuariosApi } from '../../core/api';
import { AuthService, Rol } from '../../core/auth';
import { ItemMenuShell, ShellComponent } from '../../shared';

/** Items del menú con los roles que pueden verlos. */
const MENU_PANEL: (ItemMenuShell & { roles: Rol[] })[] = [
  { label: 'Usuarios', icono: 'group', ruta: '/panel/usuarios', roles: [Rol.ADMIN] },
  { label: 'Asociaciones', icono: 'apartment', ruta: '/panel/asociaciones', roles: [Rol.ADMIN] },
  {
    label: 'Conductores',
    icono: 'badge',
    ruta: '/panel/conductores',
    roles: [Rol.ADMIN, Rol.ASOCIACION],
  },
  {
    label: 'Flota',
    icono: 'directions_bus',
    ruta: '/panel/flota',
    roles: [Rol.ADMIN, Rol.ASOCIACION],
  },
  { label: 'Rutas', icono: 'route', ruta: '/panel/rutas', roles: [Rol.ADMIN, Rol.ASOCIACION] },
  { label: 'Liquidaciones', icono: 'payments', ruta: '/panel/liquidaciones', roles: [Rol.ADMIN] },
];

/**
 * Layout del área /panel: shell compartido (toolbar + sidenav) con el menú
 * filtrado según el rol (admin ve todo; asociacion solo conductores, flota y
 * rutas) y un router-outlet para las páginas hijas.
 */
@Component({
  selector: 'app-panel-shell',
  imports: [ShellComponent, RouterOutlet],
  template: `
    <app-shell
      [titulo]="titulo()"
      [itemsMenu]="itemsMenu()"
      [nombreUsuario]="nombreUsuario()"
      (cerrarSesion)="salir()"
    >
      <router-outlet />
    </app-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly usuariosApi = inject(UsuariosApi);

  /** Nombre rehidratado vía GET /usuarios/me cuando el JWT no lo trae. */
  private readonly nombrePerfil = signal('');

  protected readonly titulo = computed(() =>
    this.auth.rol() === Rol.ADMIN ? 'BusRide — Panel admin' : 'BusRide — Panel asociación',
  );

  protected readonly itemsMenu = computed<ItemMenuShell[]>(() => {
    const rol = this.auth.rol();
    return MENU_PANEL.filter((item) => rol !== null && item.roles.includes(rol)).map(
      ({ label, icono, ruta }) => ({ label, icono, ruta }),
    );
  });

  protected readonly nombreUsuario = computed(() => {
    const usuario = this.auth.usuario();
    if (!usuario) return '';
    const nombre = `${usuario.nombre} ${usuario.apellido}`.trim();
    return nombre || this.nombrePerfil() || usuario.email;
  });

  constructor() {
    // Sesión restaurada desde el JWT: nombre/apellido llegan vacíos.
    const usuario = this.auth.usuario();
    if (usuario && !`${usuario.nombre}${usuario.apellido}`.trim()) {
      this.usuariosApi.obtenerMiPerfil().subscribe({
        next: (perfil) => this.nombrePerfil.set(`${perfil.nombre} ${perfil.apellido}`.trim()),
        error: () => undefined, // sin nombre se muestra el email
      });
    }
  }

  salir(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
