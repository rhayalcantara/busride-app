import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Asociacion, AsociacionesApi, EstadoAsociacion } from '../../../../core/api';
import {
  CeldaTablaDirective,
  ColumnaTabla,
  ConfirmDialogComponent,
  EstadoVacioComponent,
  TablaPaginadaComponent,
  extraerMensajeError,
} from '../../../../shared';
import { AsociacionContextoService } from '../../asociacion-contexto.service';
import { AsociacionDialogComponent } from './asociacion-dialog.component';
import { VincularAdminDialogComponent } from './vincular-admin-dialog.component';

/**
 * Asociaciones (solo admin): listado con filtro por estado (F-09a añadió
 * `GET /asociaciones?estado=`, así que las PENDIENTES sobreviven al reload),
 * crear/editar, aprobar y vincular usuario administrador.
 */
@Component({
  selector: 'app-asociaciones-page',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
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

    <mat-button-toggle-group
      class="filtro-estado"
      aria-label="Filtrar por estado"
      [value]="estado()"
      (change)="cambiarEstado($event.value)"
      hideSingleSelectionIndicator
    >
      <mat-button-toggle value="ACTIVA">Activas</mat-button-toggle>
      <mat-button-toggle value="PENDIENTE">Pendientes</mat-button-toggle>
      <mat-button-toggle value="SUSPENDIDA">Suspendidas</mat-button-toggle>
    </mat-button-toggle-group>

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
        [mensaje]="'No hay asociaciones en estado ' + estado() + '.'"
        textoAccion="Crear asociación"
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
      .filtro-estado {
        margin-bottom: 12px;
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

  protected readonly estado = signal<EstadoAsociacion>('ACTIVA');
  protected readonly lista = signal<Asociacion[]>([]);
  protected readonly cargando = signal(false);
  protected readonly errorCarga = signal<string | null>(null);

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

  cambiarEstado(estado: EstadoAsociacion): void {
    this.estado.set(estado);
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.asociacionesApi.listar(this.estado()).subscribe({
      next: (lista) => {
        this.lista.set(lista);
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
          this.snackBar.open(
            `Asociación «${creada.nombre}» creada en estado ${creada.estado}`,
            'OK',
            { duration: 4000 },
          );
          // Las recién creadas nacen PENDIENTE: se salta al filtro que las muestra.
          this.estado.set('PENDIENTE');
          this.cargar();
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
          this.cargar();
        }
      });
  }
}
