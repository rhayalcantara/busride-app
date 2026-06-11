import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Asociacion, AsociacionesApi } from '../../../../core/api';
import {
  CeldaTablaDirective,
  ColumnaTabla,
  ConfirmDialogComponent,
  EstadoVacioComponent,
  TablaPaginadaComponent,
  sonUuidsIguales,
} from '../../../../shared';
import { AsociacionContextoService } from '../../asociacion-contexto.service';
import { extraerMensajeError } from '../../mensaje-error.util';
import { AsociacionDialogComponent } from './asociacion-dialog.component';
import { VincularAdminDialogComponent } from './vincular-admin-dialog.component';

/**
 * Asociaciones (solo admin): listado, crear/editar, aprobar y vincular
 * usuario administrador.
 *
 * LIMITACIÓN del backend: GET /asociaciones solo devuelve las ACTIVAS, no
 * existe un listado de PENDIENTES/SUSPENDIDAS. Las asociaciones creadas en
 * esta sesión se conservan en memoria para poder aprobarlas; al recargar la
 * página, una asociación PENDIENTE deja de ser visible (fricción reportada).
 */
@Component({
  selector: 'app-asociaciones-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TablaPaginadaComponent,
    CeldaTablaDirective,
    EstadoVacioComponent,
  ],
  template: `
    <header class="pagina-encabezado">
      <h2>Asociaciones</h2>
      <button mat-flat-button type="button" (click)="abrirCrear()">
        <mat-icon>add_business</mat-icon>
        Crear asociación
      </button>
    </header>

    <p class="aviso-limitacion">
      El backend solo lista asociaciones ACTIVAS: las PENDIENTES creadas en esta sesión se
      muestran abajo hasta aprobarlas, pero no sobreviven a una recarga.
    </p>

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
    } @else if (lista().length === 0 && !cargando()) {
      <app-estado-vacio
        mensaje="No hay asociaciones activas registradas."
        textoAccion="Crear la primera"
        (accion)="abrirCrear()"
      />
    } @else {
      <app-tabla-paginada [columnas]="columnas" [datos]="lista()">
        <ng-template appCeldaTabla="estado" let-fila>
          <span
            class="chip"
            [class.chip--ok]="fila.estado === 'ACTIVA'"
            [class.chip--pendiente]="fila.estado === 'PENDIENTE'"
            [class.chip--off]="fila.estado === 'SUSPENDIDA'"
          >
            {{ fila.estado }}
          </span>
        </ng-template>

        <ng-template appCeldaTabla="acciones" let-fila>
          @if (fila.estado === 'PENDIENTE') {
            <button
              mat-icon-button
              type="button"
              title="Aprobar asociación"
              aria-label="Aprobar asociación"
              (click)="aprobar(fila)"
            >
              <mat-icon>task_alt</mat-icon>
            </button>
          }
          <button
            mat-icon-button
            type="button"
            title="Editar"
            aria-label="Editar asociación"
            (click)="abrirEditar(fila)"
          >
            <mat-icon>edit</mat-icon>
          </button>
          <button
            mat-icon-button
            type="button"
            title="Vincular usuario administrador"
            aria-label="Vincular usuario administrador"
            (click)="abrirVincular(fila)"
          >
            <mat-icon>manage_accounts</mat-icon>
          </button>
        </ng-template>
      </app-tabla-paginada>
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
        margin-bottom: 8px;
      }
      .pagina-encabezado h2 {
        margin: 0;
      }
      .aviso-limitacion {
        margin: 0 0 12px;
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
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
      .chip--pendiente {
        background: #fff4e5;
        color: #9a6700;
      }
      .chip--off {
        background: #fdecea;
        color: #b3261e;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsociacionesPageComponent {
  private readonly asociacionesApi = inject(AsociacionesApi);
  private readonly contexto = inject(AsociacionContextoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly activas = signal<Asociacion[]>([]);
  /** PENDIENTES creadas en esta sesión (el backend no las lista). */
  protected readonly pendientesLocales = signal<Asociacion[]>([]);
  protected readonly cargando = signal(false);
  protected readonly errorCarga = signal<string | null>(null);

  protected readonly lista = computed<Asociacion[]>(() => [
    ...this.pendientesLocales(),
    ...this.activas(),
  ]);

  protected readonly columnas: ColumnaTabla<Asociacion>[] = [
    { clave: 'nombre', encabezado: 'Nombre' },
    { clave: 'rnc', encabezado: 'RNC' },
    { clave: 'telefono', encabezado: 'Teléfono' },
    {
      clave: 'comisionPct',
      encabezado: 'Comisión',
      valor: (a) => `${Number(a.comisionPct).toFixed(2)} %`,
    },
    { clave: 'estado', encabezado: 'Estado' },
    { clave: 'acciones', encabezado: 'Acciones' },
  ];

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.asociacionesApi.listarActivas().subscribe({
      next: (lista) => {
        this.activas.set(lista);
        // Si una pendiente local ya aparece activa, se quita de la lista local
        this.pendientesLocales.update((pendientes) =>
          pendientes.filter((p) => !lista.some((a) => sonUuidsIguales(a.id, p.id))),
        );
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.errorCarga.set(extraerMensajeError(error, 'No se pudieron cargar las asociaciones'));
      },
    });
  }

  abrirCrear(): void {
    this.dialog
      .open(AsociacionDialogComponent, { data: {}, width: '480px', autoFocus: false })
      .afterClosed()
      .subscribe((creada?: Asociacion) => {
        if (creada) {
          this.pendientesLocales.update((pendientes) => [creada, ...pendientes]);
          this.snackBar.open(
            `Asociación «${creada.nombre}» creada en estado ${creada.estado}`,
            'OK',
            { duration: 4000 },
          );
        }
      });
  }

  abrirEditar(asociacion: Asociacion): void {
    this.dialog
      .open(AsociacionDialogComponent, {
        data: { asociacion },
        width: '480px',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((actualizada?: Asociacion) => {
        if (actualizada) {
          this.snackBar.open('Asociación actualizada', 'OK', { duration: 4000 });
          this.reemplazarLocal(actualizada);
          this.cargar();
        }
      });
  }

  aprobar(asociacion: Asociacion): void {
    ConfirmDialogComponent.abrir(this.dialog, {
      titulo: 'Aprobar asociación',
      mensaje: `¿Aprobar «${asociacion.nombre}»? Pasará a estado ACTIVA y podrá operar rutas y flota.`,
      textoConfirmar: 'Aprobar',
    }).subscribe((confirmado) => {
      if (!confirmado) return;
      this.asociacionesApi.aprobar(asociacion.id).subscribe({
        next: () => {
          this.snackBar.open(`«${asociacion.nombre}» aprobada`, 'OK', { duration: 4000 });
          this.contexto.cargar(true); // refresca el selector compartido del panel
          this.cargar();
        },
        error: (error: unknown) => {
          this.snackBar.open(extraerMensajeError(error, 'No se pudo aprobar la asociación'), 'OK', {
            duration: 5000,
          });
        },
      });
    });
  }

  abrirVincular(asociacion: Asociacion): void {
    this.dialog
      .open(VincularAdminDialogComponent, {
        data: { asociacion },
        width: '460px',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((actualizada?: Asociacion) => {
        if (actualizada) {
          this.snackBar.open('Usuario administrador vinculado', 'OK', { duration: 4000 });
          this.reemplazarLocal(actualizada);
          this.cargar();
        }
      });
  }

  /** Mantiene coherente la lista local de pendientes tras editar/vincular. */
  private reemplazarLocal(asociacion: Asociacion): void {
    this.pendientesLocales.update((pendientes) =>
      pendientes.map((p) => (sonUuidsIguales(p.id, asociacion.id) ? asociacion : p)),
    );
  }
}
