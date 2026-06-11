import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { map } from 'rxjs';

/** Entrada del menú lateral del shell. */
export interface ItemMenuShell {
  label: string;
  icono: string;
  ruta: string;
}

/**
 * Layout principal: toolbar Material + sidenav responsive.
 *
 * Desacoplado de la autenticación (F-02): recibe `nombreUsuario` por input y
 * delega el cierre de sesión en el output `cerrarSesion`; la navegación usa
 * `routerLink` directamente. En pantallas pequeñas el sidenav pasa a modo
 * `over` y se cierra al navegar.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    RouterLink,
    RouterLinkActive,
  ],
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav
        #sidenav
        class="shell__sidenav"
        [mode]="esMovil() ? 'over' : 'side'"
        [opened]="!esMovil()"
      >
        <mat-nav-list>
          @for (item of itemsMenu(); track item.ruta) {
            <a
              mat-list-item
              [routerLink]="item.ruta"
              routerLinkActive="shell__item-activo"
              (click)="cerrarSiMovil(sidenav)"
            >
              <mat-icon matListItemIcon>{{ item.icono }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content class="shell__contenido-wrapper">
        <mat-toolbar class="shell__toolbar">
          <button
            mat-icon-button
            type="button"
            aria-label="Alternar menú de navegación"
            (click)="sidenav.toggle()"
          >
            <mat-icon>menu</mat-icon>
          </button>
          <span class="shell__titulo">{{ titulo() }}</span>
          <span class="shell__espaciador"></span>
          @if (nombreUsuario()) {
            <span class="shell__usuario">{{ nombreUsuario() }}</span>
          }
          <button
            mat-icon-button
            type="button"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            (click)="cerrarSesion.emit()"
          >
            <mat-icon>logout</mat-icon>
          </button>
        </mat-toolbar>

        <main class="shell__contenido">
          <ng-content />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
      .shell {
        height: 100%;
      }
      .shell__sidenav {
        width: 240px;
      }
      .shell__toolbar {
        position: sticky;
        top: 0;
        z-index: 2;
        background: var(--mat-sys-primary, #1976d2);
        color: var(--mat-sys-on-primary, #fff);
      }
      .shell__toolbar .mat-mdc-icon-button {
        color: inherit;
      }
      .shell__titulo {
        margin-left: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .shell__espaciador {
        flex: 1 1 auto;
      }
      .shell__usuario {
        margin-right: 8px;
        font-size: 14px;
        opacity: 0.9;
      }
      .shell__contenido {
        padding: 16px;
      }
      .shell__item-activo {
        background: var(--mat-sys-secondary-container, rgba(25, 118, 210, 0.12));
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  readonly titulo = input('');
  readonly itemsMenu = input<ItemMenuShell[]>([]);
  readonly nombreUsuario = input('');

  /** El padre decide qué hacer al cerrar sesión (sin acoplar AuthService). */
  readonly cerrarSesion = output<void>();

  private readonly breakpointObserver = inject(BreakpointObserver);

  /** true en pantallas tipo móvil: el sidenav pasa a modo `over`. */
  readonly esMovil = toSignal(
    this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Small])
      .pipe(map((resultado) => resultado.matches)),
    { initialValue: false },
  );

  cerrarSiMovil(sidenav: MatSidenav): void {
    if (this.esMovil()) {
      void sidenav.close();
    }
  }
}
