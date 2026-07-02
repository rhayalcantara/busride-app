import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  LiquidacionConductor,
  LiquidacionesApi,
  ResumenLiquidaciones,
  ResumenLiquidacionesParams,
} from '../../../core/api';
import { EstadoVacioComponent, extraerMensajeError, FechaCortaPipe, MonedaDopPipe } from '../../../shared';

const ETIQUETA_ESTADO: Record<LiquidacionConductor['estado'], string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  PAGADA: 'Pagada',
};

/**
 * Liquidaciones del conductor: resumen agregado por período
 * (GET /liquidaciones/mias/resumen — llega como arreglo de 1 fila, se toma
 * la posición [0]) e historial completo (GET /liquidaciones/mias).
 */
@Component({
  selector: 'app-liquidaciones-conductor',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    EstadoVacioComponent,
    FechaCortaPipe,
    MonedaDopPipe,
  ],
  template: `
    <h2 class="liquidaciones__titulo">Mis liquidaciones</h2>

    @if (error(); as mensaje) {
      <p class="liquidaciones__error" role="alert">{{ mensaje }}</p>
    }

    <!-- Resumen por período -->
    <mat-card appearance="outlined" class="liquidaciones__resumen">
      <mat-card-header>
        <mat-card-title>Resumen</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <form class="liquidaciones__filtro" [formGroup]="filtro" (ngSubmit)="cargarResumen()">
          <mat-form-field appearance="outline">
            <mat-label>Desde</mat-label>
            <input matInput type="date" formControlName="inicio" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Hasta</mat-label>
            <input matInput type="date" formControlName="fin" />
          </mat-form-field>
          <button mat-stroked-button type="submit" [disabled]="cargandoResumen()">
            Filtrar
          </button>
        </form>

        @if (cargandoResumen()) {
          <div class="liquidaciones__centrado"><mat-spinner diameter="32" /></div>
        } @else if (resumen(); as datos) {
          <div class="liquidaciones__metricas">
            <div class="liquidaciones__metrica">
              <span class="liquidaciones__metrica-valor">{{ datos.total_viajes }}</span>
              <span class="liquidaciones__metrica-texto">Viajes</span>
            </div>
            <div class="liquidaciones__metrica">
              <span class="liquidaciones__metrica-valor">{{ datos.total_pasajeros ?? 0 }}</span>
              <span class="liquidaciones__metrica-texto">Pasajeros</span>
            </div>
            <div class="liquidaciones__metrica">
              <span class="liquidaciones__metrica-valor">
                {{ (datos.ingreso_bruto ?? 0) | monedaDop }}
              </span>
              <span class="liquidaciones__metrica-texto">Bruto</span>
            </div>
            <div class="liquidaciones__metrica liquidaciones__metrica--neto">
              <span class="liquidaciones__metrica-valor">
                {{ (datos.total_neto ?? 0) | monedaDop }}
              </span>
              <span class="liquidaciones__metrica-texto">Neto</span>
            </div>
          </div>
        }
      </mat-card-content>
    </mat-card>

    <!-- Historial -->
    <h3 class="liquidaciones__seccion">Historial</h3>
    @if (cargandoHistorial()) {
      <div class="liquidaciones__centrado"><mat-spinner diameter="40" /></div>
    } @else if (liquidaciones().length === 0) {
      <app-estado-vacio
        icono="receipt_long"
        mensaje="Todavía no tienes liquidaciones. Se generan al finalizar cada viaje."
      />
    } @else {
      <div class="liquidaciones__lista">
        @for (liquidacion of liquidaciones(); track liquidacion.id) {
          <mat-card appearance="outlined">
            <mat-card-content>
              <div class="liquidaciones__fila">
                <div class="liquidaciones__datos">
                  <strong>{{ liquidacion.ruta_nombre ?? 'Viaje' }}</strong>
                  <span class="liquidaciones__detalle">
                    {{ liquidacion.fecha_creacion | fechaCorta }} ·
                    {{ liquidacion.total_abordajes }} pasajeros
                  </span>
                  <span class="liquidaciones__detalle">
                    Bruto {{ liquidacion.ingreso_bruto | monedaDop }} · comisiones
                    {{
                      liquidacion.comision_plataforma + liquidacion.comision_asociacion
                        | monedaDop
                    }}
                  </span>
                  @if (liquidacion.referencia_pago; as referencia) {
                    <span class="liquidaciones__detalle">Ref. pago: {{ referencia }}</span>
                  }
                </div>
                <div class="liquidaciones__monto">
                  <span class="liquidaciones__neto">{{ liquidacion.monto_neto | monedaDop }}</span>
                  <span
                    class="liquidaciones__estado"
                    [class.liquidaciones__estado--pagada]="liquidacion.estado === 'PAGADA'"
                    [class.liquidaciones__estado--pendiente]="liquidacion.estado === 'PENDIENTE'"
                  >
                    {{ etiquetaEstado(liquidacion.estado) }}
                  </span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 600px;
        margin: 0 auto;
      }
      .liquidaciones__titulo {
        margin: 0 0 16px;
      }
      .liquidaciones__seccion {
        margin: 20px 0 8px;
      }
      .liquidaciones__error {
        color: var(--mat-sys-error, #b3261e);
        margin: 0 0 12px;
      }
      .liquidaciones__centrado {
        display: grid;
        place-items: center;
        padding: 24px 0;
      }
      .liquidaciones__filtro {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
        margin-bottom: 8px;
      }
      .liquidaciones__filtro mat-form-field {
        flex: 1 1 140px;
      }
      .liquidaciones__metricas {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 8px;
      }
      .liquidaciones__metrica {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 12px 8px;
        border-radius: 12px;
        background: var(--mat-sys-surface-container, rgba(0, 0, 0, 0.04));
        text-align: center;
      }
      .liquidaciones__metrica--neto {
        background: var(--mat-sys-secondary-container, rgba(25, 118, 210, 0.12));
      }
      .liquidaciones__metrica-valor {
        font-size: 18px;
        font-weight: 700;
      }
      .liquidaciones__metrica-texto {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
      .liquidaciones__lista {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .liquidaciones__fila {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .liquidaciones__datos {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .liquidaciones__detalle {
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
      .liquidaciones__monto {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
        white-space: nowrap;
      }
      .liquidaciones__neto {
        font-size: 16px;
        font-weight: 700;
      }
      .liquidaciones__estado {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 8px;
        background: var(--mat-sys-surface-container, rgba(0, 0, 0, 0.06));
      }
      .liquidaciones__estado--pagada {
        background: #e6f4ea;
        color: #1e7e34;
      }
      .liquidaciones__estado--pendiente {
        background: #fff4e5;
        color: #b26a00;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiquidacionesConductorComponent implements OnInit {
  private readonly liquidacionesApi = inject(LiquidacionesApi);

  protected readonly cargandoHistorial = signal(true);
  protected readonly cargandoResumen = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly liquidaciones = signal<LiquidacionConductor[]>([]);
  protected readonly resumen = signal<ResumenLiquidaciones | null>(null);

  protected readonly filtro = inject(NonNullableFormBuilder).group({
    inicio: [''],
    fin: [''],
  });

  ngOnInit(): void {
    this.cargarHistorial();
    this.cargarResumen();
  }

  protected etiquetaEstado(estado: LiquidacionConductor['estado']): string {
    return ETIQUETA_ESTADO[estado] ?? estado;
  }

  cargarResumen(): void {
    const { inicio, fin } = this.filtro.getRawValue();
    const params: ResumenLiquidacionesParams = {};
    if (inicio) params.inicio = inicio;
    if (fin) params.fin = fin;

    this.cargandoResumen.set(true);
    this.liquidacionesApi.obtenerMiResumen(params).subscribe({
      next: (filas) => {
        this.cargandoResumen.set(false);
        // El backend devuelve el agregado como arreglo de UNA fila
        this.resumen.set(filas[0] ?? null);
      },
      error: (err: unknown) => {
        this.cargandoResumen.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudo cargar el resumen'));
      },
    });
  }

  private cargarHistorial(): void {
    this.liquidacionesApi.listarMias().subscribe({
      next: (liquidaciones) => {
        this.cargandoHistorial.set(false);
        this.liquidaciones.set(liquidaciones);
      },
      error: (err: unknown) => {
        this.cargandoHistorial.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudieron cargar tus liquidaciones'));
      },
    });
  }
}
