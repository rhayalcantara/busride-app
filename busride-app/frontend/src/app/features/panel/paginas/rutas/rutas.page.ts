import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { Ruta, RutasApi } from '../../../../core/api';
import {
  CeldaTablaDirective,
  ColumnaTabla,
  EstadoVacioComponent,
  extraerMensajeError,
  MonedaDopPipe,
  TablaPaginadaComponent,
} from '../../../../shared';
import { AsociacionContextoService } from '../../asociacion-contexto.service';
import { SelectorAsociacionComponent } from '../../selector-asociacion.component';

/**
 * Rutas (admin y asociación): listado de rutas activas de la asociación
 * seleccionada, con acceso a la creación de rutas sobre el mapa.
 */
@Component({
  selector: 'app-rutas-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TablaPaginadaComponent,
    CeldaTablaDirective,
    EstadoVacioComponent,
    MonedaDopPipe,
    SelectorAsociacionComponent,
  ],
  template: `
    <header class="pagina-encabezado">
      <h2>Rutas</h2>
      <a mat-flat-button routerLink="/panel/rutas/crear" [disabled]="!contexto.seleccionada()">
        <mat-icon>add_road</mat-icon>
        Nueva ruta
      </a>
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
    } @else if (contexto.seleccionada() && rutas().length === 0 && !cargando()) {
      <app-estado-vacio mensaje="Esta asociación no tiene rutas activas." />
    } @else if (rutas().length > 0) {
      <app-tabla-paginada [columnas]="columnas" [datos]="rutas()">
        <ng-template appCeldaTabla="tarifa" let-fila>
          {{ fila.tarifa | monedaDop }}
        </ng-template>
        <ng-template appCeldaTabla="paradas" let-fila>
          {{ fila.paradas?.length ?? 0 }} paradas
        </ng-template>
        <ng-template appCeldaTabla="activa" let-fila>
          <span class="chip" [class.chip--ok]="fila.activa" [class.chip--off]="!fila.activa">
            {{ fila.activa ? 'Activa' : 'Inactiva' }}
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
export class RutasPageComponent {
  private readonly rutasApi = inject(RutasApi);
  protected readonly contexto = inject(AsociacionContextoService);

  protected readonly rutas = signal<Ruta[]>([]);
  protected readonly cargando = signal(false);
  protected readonly errorCarga = signal<string | null>(null);

  protected readonly columnas: ColumnaTabla<Ruta>[] = [
    { clave: 'nombre', encabezado: 'Nombre' },
    { clave: 'codigo', encabezado: 'Código' },
    { clave: 'descripcion', encabezado: 'Descripción' },
    { clave: 'tarifa', encabezado: 'Tarifa' },
    { clave: 'paradas', encabezado: 'Paradas' },
    { clave: 'activa', encabezado: 'Estado' },
  ];

  constructor() {
    effect(() => {
      const asociacionId = this.contexto.seleccionadaId();
      if (asociacionId) {
        this.cargar(asociacionId);
      } else {
        this.rutas.set([]);
      }
    });
  }

  recargar(): void {
    const asociacionId = this.contexto.seleccionadaId();
    if (asociacionId) this.cargar(asociacionId);
  }

  private cargar(asociacionId: string): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.rutasApi.listarPorAsociacion(asociacionId).subscribe({
      next: (lista) => {
        this.rutas.set(lista);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.errorCarga.set(extraerMensajeError(error, 'No se pudieron cargar las rutas'));
      },
    });
  }
}
