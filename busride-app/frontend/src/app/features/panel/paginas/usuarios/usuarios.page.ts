import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PaginaUsuarios, Usuario, UsuariosApi } from '../../../../core/api';
import {
  CeldaTablaDirective,
  ColumnaTabla,
  ConfirmDialogComponent,
  EstadoVacioComponent,
  extraerMensajeError,
  FechaCortaPipe,
  TablaPaginadaComponent,
} from '../../../../shared';
import { CrearUsuarioDialogComponent } from './crear-usuario-dialog.component';

/**
 * Usuarios (solo admin): listado paginado en servidor (GET /usuarios),
 * activar/desactivar con confirmación y alta de usuarios privilegiados.
 *
 * La paginación es del backend: la tabla muestra la página actual completa y
 * la navegación entre páginas se hace con los botones anterior/siguiente.
 */
@Component({
  selector: 'app-usuarios-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TablaPaginadaComponent,
    CeldaTablaDirective,
    EstadoVacioComponent,
    FechaCortaPipe,
  ],
  template: `
    <header class="pagina-encabezado">
      <h2>Usuarios</h2>
      <button mat-flat-button type="button" (click)="abrirCrear()">
        <mat-icon>person_add</mat-icon>
        Crear usuario
      </button>
    </header>

    @if (cargando()) {
      <mat-progress-bar mode="indeterminate" />
    }

    @if (errorCarga(); as mensaje) {
      <app-estado-vacio
        icono="error_outline"
        [mensaje]="mensaje"
        textoAccion="Reintentar"
        (accion)="cargar()"
      />
    } @else if (pagina(); as paginaActual) {
      @if (paginaActual.total === 0) {
        <app-estado-vacio mensaje="No hay usuarios registrados." />
      } @else {
        <app-tabla-paginada
          [columnas]="columnas"
          [datos]="paginaActual.datos"
          [tamanoPagina]="paginaActual.limite"
          [opcionesPagina]="[paginaActual.limite]"
        >
          <ng-template appCeldaTabla="ultimoLogin" let-fila>
            {{ fila.ultimoLogin ? (fila.ultimoLogin | fechaCorta) : 'Nunca' }}
          </ng-template>

          <ng-template appCeldaTabla="activo" let-fila>
            <span class="chip" [class.chip--ok]="fila.activo" [class.chip--off]="!fila.activo">
              {{ fila.activo ? 'Activo' : 'Inactivo' }}
            </span>
          </ng-template>

          <ng-template appCeldaTabla="acciones" let-fila>
            <button
              mat-icon-button
              type="button"
              [title]="fila.activo ? 'Desactivar usuario' : 'Activar usuario'"
              [attr.aria-label]="fila.activo ? 'Desactivar usuario' : 'Activar usuario'"
              (click)="alternarEstado(fila)"
            >
              <mat-icon>{{ fila.activo ? 'person_off' : 'how_to_reg' }}</mat-icon>
            </button>
          </ng-template>
        </app-tabla-paginada>

        <footer class="paginacion-servidor">
          <button
            mat-stroked-button
            type="button"
            [disabled]="cargando() || paginaActual.pagina <= 1"
            (click)="irAPagina(paginaActual.pagina - 1)"
          >
            <mat-icon>chevron_left</mat-icon>
            Anterior
          </button>
          <span>
            Página {{ paginaActual.pagina }} de {{ paginaActual.totalPaginas }} —
            {{ paginaActual.total }} usuarios
          </span>
          <button
            mat-stroked-button
            type="button"
            [disabled]="cargando() || paginaActual.pagina >= paginaActual.totalPaginas"
            (click)="irAPagina(paginaActual.pagina + 1)"
          >
            Siguiente
            <mat-icon iconPositionEnd>chevron_right</mat-icon>
          </button>
        </footer>
      }
    }
  `,
  styles: [
    `
      .pagina-encabezado {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
      .pagina-encabezado h2 {
        margin: 0;
      }
      .chip {
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 12px;
        white-space: nowrap;
      }
      .chip--ok {
        background: #e6f4ea;
        color: #1e7d32;
      }
      .chip--off {
        background: #fdecea;
        color: #b3261e;
      }
      .paginacion-servidor {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        flex-wrap: wrap;
        padding: 12px 0;
        font-size: 14px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuariosPageComponent {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly pagina = signal<PaginaUsuarios | null>(null);
  protected readonly cargando = signal(false);
  protected readonly errorCarga = signal<string | null>(null);
  private readonly paginaSolicitada = signal(1);
  private readonly limite = 20;

  protected readonly columnas: ColumnaTabla<Usuario>[] = [
    { clave: 'nombre', encabezado: 'Nombre', valor: (u) => `${u.nombre} ${u.apellido}`.trim() },
    { clave: 'email', encabezado: 'Email' },
    { clave: 'rol', encabezado: 'Rol', valor: (u) => u.rol?.nombre ?? u.rolId },
    { clave: 'ultimoLogin', encabezado: 'Último login' },
    { clave: 'activo', encabezado: 'Estado' },
    { clave: 'acciones', encabezado: 'Acciones' },
  ];

  protected readonly hayDatos = computed(() => (this.pagina()?.total ?? 0) > 0);

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.usuariosApi.listar({ pagina: this.paginaSolicitada(), limite: this.limite }).subscribe({
      next: (respuesta) => {
        this.pagina.set(respuesta);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.errorCarga.set(extraerMensajeError(error, 'No se pudieron cargar los usuarios'));
      },
    });
  }

  irAPagina(numero: number): void {
    this.paginaSolicitada.set(Math.max(1, numero));
    this.cargar();
  }

  alternarEstado(usuario: Usuario): void {
    const activar = !usuario.activo;
    const nombre = `${usuario.nombre} ${usuario.apellido}`.trim() || usuario.email;
    ConfirmDialogComponent.abrir(this.dialog, {
      titulo: activar ? 'Activar usuario' : 'Desactivar usuario',
      mensaje: activar
        ? `¿Activar a ${nombre}? Podrá volver a iniciar sesión.`
        : `¿Desactivar a ${nombre}? No podrá iniciar sesión hasta que se reactive.`,
      textoConfirmar: activar ? 'Activar' : 'Desactivar',
    }).subscribe((confirmado) => {
      if (!confirmado) return;
      this.usuariosApi.cambiarEstado(usuario.id, activar).subscribe({
        next: (respuesta) => {
          this.snackBar.open(respuesta.mensaje, 'OK', { duration: 4000 });
          this.cargar();
        },
        error: (error: unknown) => {
          this.snackBar.open(
            extraerMensajeError(error, 'No se pudo cambiar el estado del usuario'),
            'OK',
            { duration: 5000 },
          );
        },
      });
    });
  }

  abrirCrear(): void {
    this.dialog
      .open(CrearUsuarioDialogComponent, { width: '440px', autoFocus: false })
      .afterClosed()
      .subscribe((respuesta) => {
        if (respuesta) {
          this.snackBar.open(respuesta.mensaje, 'OK', { duration: 4000 });
          this.cargar();
        }
      });
  }
}
