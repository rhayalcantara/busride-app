import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { AuthService } from '../../core/auth';
import { ItemMenuShell, ShellComponent } from '../../shared';

/**
 * Placeholder de la Ola F3. F-08 (Ola F4) reemplaza ESTE archivo completo con
 * las páginas reales del panel admin/asociación (usuarios, asociaciones,
 * conductores, flota, rutas, liquidaciones). Patrón a seguir: páginas
 * standalone envueltas en <app-shell>; la visibilidad de items del menú según
 * el rol se decide leyendo AuthService.rol().
 */
@Component({
  selector: 'app-panel-en-construccion',
  imports: [ShellComponent],
  template: `
    <app-shell
      titulo="BusRide — Panel"
      [itemsMenu]="itemsMenu"
      [nombreUsuario]="nombreUsuario()"
      (cerrarSesion)="salir()"
    >
      <h2>Área en construcción</h2>
      <p>Las páginas del panel admin/asociación llegan en la Ola F4 (tarea F-08).</p>
      <p>Rol actual: {{ rol() }}</p>
    </app-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelEnConstruccionComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly itemsMenu: ItemMenuShell[] = [
    { label: 'Inicio', icono: 'home', ruta: '/panel' },
  ];

  protected readonly rol = this.auth.rol;

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

export const PANEL_ROUTES: Routes = [
  { path: '', component: PanelEnConstruccionComponent },
];
