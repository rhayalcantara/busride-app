import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EstadoLiquidacion, LiquidacionAdmin, LiquidacionesApi } from '../../../../core/api';
import {
  CeldaTablaDirective,
  ColumnaTabla,
  EstadoVacioComponent,
  FechaCortaPipe,
  MonedaDopPipe,
  TablaPaginadaComponent,
  extraerMensajeError,
} from '../../../../shared';
import { PagarLiquidacionDialogComponent } from './pagar-liquidacion-dialog.component';

type FiltroEstado = EstadoLiquidacion | 'TODAS';

const monedaDop = new MonedaDopPipe();
const fechaCorta = new FechaCortaPipe();

/**
 * Liquidaciones (solo admin): listado completo con filtro por estado
 * (`GET /liquidaciones?estado=`, F-09a) y acción «marcar pagada» con
 * referencia sobre las PENDIENTES.
 */
@Component({
  selector: 'app-liquidaciones-page',
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
      <h2>Liquidaciones</h2>
    </header>

    <mat-button-toggle-group
      class="filtro-estado"
      aria-label="Filtrar por estado"
      [value]="estado()"
      (change)="cambiarEstado($event.value)"
      hideSingleSelectionIndicator
    >
      <mat-button-toggle value="TODAS">Todas</mat-button-toggle>
      <mat-button-toggle value="PENDIENTE">Pendientes</mat-button-toggle>
      <mat-button-toggle value="EN_PROCESO">En proceso</mat-button-toggle>
      <mat-button-toggle value="PAGADA">Pagadas</mat-button-toggle>
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
        icono="receipt_long"
        [mensaje]="
          estado() === 'TODAS'
            ? 'Aún no hay liquidaciones registradas.'
            : 'No hay liquidaciones en estado ' + estado() + '.'
        "
      />
    } @else {
      <app-tabla-paginada [columnas]="columnas" [datos]="lista()">
        <ng-template appCeldaTabla="estado" let-fila>
          <span
            class="chip"
            [class.chip--ok]="fila.estado === 'PAGADA'"
            [class.chip--pendiente]="fila.estado === 'PENDIENTE'"
            [class.chip--proceso]="fila.estado === 'EN_PROCESO'"
          >
            {{ fila.estado }}
          </span>
        </ng-template>

        <ng-template appCeldaTabla="acciones" let-fila>
          @if (fila.estado === 'PENDIENTE') {
            <button
              mat-icon-button
              type="button"
              title="Marcar pagada"
              aria-label="Marcar liquidación como pagada"
              (click)="marcarPagada(fila)"
            >
              <mat-icon>price_check</mat-icon>
            </button>
          } @else if (fila.referencia_pago) {
            <span class="referencia" [title]="'Referencia: ' + fila.referencia_pago">
              {{ fila.referencia_pago }}
            </span>
          }
        </ng-template>
      </app-tabla-paginada>
    }
  `,
  styles: [
    `
      .pagina-encabezado {
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
      .chip--proceso {
        background: #e3f2fd;
        color: #1565c0;
      }
      .referencia {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiquidacionesPageComponent {
  private readonly liquidacionesApi = inject(LiquidacionesApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly estado = signal<FiltroEstado>('PENDIENTE');
  protected readonly lista = signal<LiquidacionAdmin[]>([]);
  protected readonly cargando = signal(false);
  protected readonly errorCarga = signal<string | null>(null);

  protected readonly columnas: ColumnaTabla<LiquidacionAdmin>[] = [
    { clave: 'conductor_nombre', encabezado: 'Conductor' },
    { clave: 'ruta_nombre', encabezado: 'Ruta', valor: (l) => l.ruta_nombre ?? '—' },
    {
      clave: 'fecha_creacion',
      encabezado: 'Generada',
      valor: (l) => fechaCorta.transform(l.fecha_creacion),
    },
    { clave: 'total_abordajes', encabezado: 'Abordajes' },
    {
      clave: 'ingreso_bruto',
      encabezado: 'Bruto',
      valor: (l) => monedaDop.transform(l.ingreso_bruto),
    },
    {
      clave: 'monto_neto',
      encabezado: 'Neto conductor',
      valor: (l) => monedaDop.transform(l.monto_neto),
    },
    { clave: 'estado', encabezado: 'Estado' },
    { clave: 'acciones', encabezado: 'Acciones' },
  ];

  constructor() {
    this.cargar();
  }

  cambiarEstado(estado: FiltroEstado): void {
    this.estado.set(estado);
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    const estado = this.estado();
    this.liquidacionesApi.listarTodas(estado === 'TODAS' ? undefined : estado).subscribe({
      next: (lista) => {
        this.lista.set(lista);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.errorCarga.set(
          extraerMensajeError(error, 'No se pudieron cargar las liquidaciones'),
        );
      },
    });
  }

  marcarPagada(liquidacion: LiquidacionAdmin): void {
    this.dialog
      .open(PagarLiquidacionDialogComponent, {
        data: { liquidacion },
        width: '440px',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((respuesta) => {
        if (respuesta) {
          this.snackBar.open(
            `${respuesta.mensaje} (referencia ${respuesta.referenciaPago})`,
            'OK',
            { duration: 5000 },
          );
          this.cargar();
        }
      });
  }
}
