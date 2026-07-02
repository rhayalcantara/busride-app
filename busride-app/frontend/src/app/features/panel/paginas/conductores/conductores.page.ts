import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConductorDeAsociacion, ConductoresApi } from '../../../../core/api';
import {
  CeldaTablaDirective,
  ColumnaTabla,
  EstadoVacioComponent,
  extraerMensajeError,
  FechaCortaPipe,
  TablaPaginadaComponent,
} from '../../../../shared';
import { AsociacionContextoService } from '../../asociacion-contexto.service';
import { SelectorAsociacionComponent } from '../../selector-asociacion.component';
import { CrearConductorDialogComponent } from './crear-conductor-dialog.component';

/**
 * Conductores (admin y asociación): listado por asociación con calificación
 * visible y alta con el form completo de licencia.
 */
@Component({
  selector: 'app-conductores-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TablaPaginadaComponent,
    CeldaTablaDirective,
    EstadoVacioComponent,
    FechaCortaPipe,
    SelectorAsociacionComponent,
  ],
  template: `
    <header class="pagina-encabezado">
      <h2>Conductores</h2>
      <button
        mat-flat-button
        type="button"
        [disabled]="!contexto.seleccionada()"
        (click)="abrirAlta()"
      >
        <mat-icon>person_add</mat-icon>
        Registrar conductor
      </button>
    </header>

    <app-selector-asociacion />

    @if (cargando()) {
      <mat-progress-bar mode="indeterminate" />
    }

    @if (errorCarga(); as mensaje) {
      <app-estado-vacio
        icono="error_outline"
        [mensaje]="mensaje"
        textoAccion="Reintentar"
        (accion)="recargar()"
      />
    } @else if (contexto.seleccionada() && conductores().length === 0 && !cargando()) {
      <app-estado-vacio
        mensaje="Esta asociación no tiene conductores registrados."
        textoAccion="Registrar el primero"
        (accion)="abrirAlta()"
      />
    } @else if (conductores().length > 0) {
      <app-tabla-paginada [columnas]="columnas" [datos]="conductores()">
        <ng-template appCeldaTabla="licenciaVence" let-fila>
          {{ fila.licenciaVence | fechaCorta: false }}
        </ng-template>

        <ng-template appCeldaTabla="calificacionPromedio" let-fila>
          <span class="calificacion">
            <mat-icon class="calificacion__estrella">star</mat-icon>
            {{ formatearCalificacion(fila.calificacionPromedio) }}
          </span>
        </ng-template>

        <ng-template appCeldaTabla="activo" let-fila>
          <span class="chip" [class.chip--ok]="fila.activo" [class.chip--off]="!fila.activo">
            {{ fila.activo ? 'Activo' : 'Inactivo' }}
          </span>
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
        margin-bottom: 12px;
      }
      .pagina-encabezado h2 {
        margin: 0;
      }
      .calificacion {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }
      .calificacion__estrella {
        color: #f5a623;
        font-size: 18px;
        width: 18px;
        height: 18px;
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
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConductoresPageComponent {
  private readonly conductoresApi = inject(ConductoresApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly contexto = inject(AsociacionContextoService);

  protected readonly conductores = signal<ConductorDeAsociacion[]>([]);
  protected readonly cargando = signal(false);
  protected readonly errorCarga = signal<string | null>(null);

  protected readonly columnas: ColumnaTabla<ConductorDeAsociacion>[] = [
    {
      clave: 'nombre',
      encabezado: 'Nombre',
      valor: (c) => `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim() || '—',
    },
    { clave: 'email', encabezado: 'Email' },
    { clave: 'licenciaNumero', encabezado: 'Licencia' },
    { clave: 'licenciaVence', encabezado: 'Vence' },
    { clave: 'calificacionPromedio', encabezado: 'Calificación' },
    { clave: 'totalViajes', encabezado: 'Viajes' },
    { clave: 'activo', encabezado: 'Estado' },
  ];

  constructor() {
    // Recarga el listado cada vez que cambia la asociación seleccionada
    effect(() => {
      const asociacionId = this.contexto.seleccionadaId();
      if (asociacionId) {
        this.cargar(asociacionId);
      } else {
        this.conductores.set([]);
      }
    });
  }

  protected formatearCalificacion(valor: number | string | null): string {
    const numero = Number(valor);
    return Number.isNaN(numero) ? '—' : numero.toFixed(2);
  }

  recargar(): void {
    const asociacionId = this.contexto.seleccionadaId();
    if (asociacionId) {
      this.cargar(asociacionId);
    }
  }

  private cargar(asociacionId: string): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.conductoresApi.listarPorAsociacion(asociacionId).subscribe({
      next: (lista) => {
        this.conductores.set(lista);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.errorCarga.set(extraerMensajeError(error, 'No se pudieron cargar los conductores'));
      },
    });
  }

  abrirAlta(): void {
    const asociacion = this.contexto.seleccionada();
    if (!asociacion) return;

    this.dialog
      .open(CrearConductorDialogComponent, {
        data: {
          asociacionId: asociacion.id,
          asociacionNombre: asociacion.nombre,
          esAdmin: this.contexto.esAdmin(),
        },
        width: '480px',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((respuesta) => {
        if (respuesta) {
          this.snackBar.open(respuesta.mensaje, 'OK', { duration: 4000 });
          this.recargar();
        }
      });
  }
}
