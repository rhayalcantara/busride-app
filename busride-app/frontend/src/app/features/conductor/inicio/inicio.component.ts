import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { AsignacionBusRuta, FlotaApi, Viaje, ViajesApi } from '../../../core/api';
import { EstadoVacioComponent, FechaCortaPipe } from '../../../shared';
import { extraerMensajeError } from '../../auth/mensaje-error.util';

/**
 * Home del conductor: si hay un viaje EN_CURSO ofrece ir directo a la pantalla
 * de viaje; si no, lista las asignaciones bus-ruta activas y permite iniciar
 * un viaje con una de ellas.
 */
@Component({
  selector: 'app-conductor-inicio',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    EstadoVacioComponent,
    FechaCortaPipe,
  ],
  template: `
    <h2 class="inicio__titulo">Mis asignaciones</h2>

    @if (cargando()) {
      <div class="inicio__centrado"><mat-spinner diameter="40" /></div>
    } @else {
      @if (error(); as mensaje) {
        <p class="inicio__error" role="alert">{{ mensaje }}</p>
      }

      @if (viajeActivo(); as viaje) {
        <mat-card class="inicio__viaje-activo" appearance="outlined">
          <mat-card-content>
            <div class="inicio__viaje-activo-fila">
              <mat-icon color="primary">directions_bus</mat-icon>
              <div>
                <strong>Tienes un viaje en curso</strong>
                <p class="inicio__detalle">
                  {{ viaje.ruta?.nombre ?? 'Ruta' }} ·
                  {{ viaje.asientosDisponibles }} asientos libres
                </p>
              </div>
            </div>
          </mat-card-content>
          <mat-card-actions>
            <a mat-flat-button routerLink="/conductor/viaje">
              <mat-icon>navigation</mat-icon>
              Ir al viaje
            </a>
          </mat-card-actions>
        </mat-card>
      }

      @if (asignaciones().length === 0) {
        <app-estado-vacio
          icono="no_transfer"
          mensaje="No tienes asignaciones activas. Contacta a tu asociación."
        />
      } @else {
        <div class="inicio__lista">
          @for (asignacion of asignaciones(); track asignacion.id) {
            <mat-card appearance="outlined">
              <mat-card-header>
                <mat-card-title>{{ asignacion.ruta?.nombre ?? 'Ruta asignada' }}</mat-card-title>
                <mat-card-subtitle>
                  Bus {{ asignacion.bus?.placa ?? '—' }}
                  @if (asignacion.bus?.capacidadTotal; as capacidad) {
                    · {{ capacidad }} asientos
                  }
                </mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <p class="inicio__detalle">
                  Desde {{ asignacion.fechaInicio | fechaCorta: false }}
                  @if (asignacion.ruta?.tarifa; as tarifa) {
                    · Tarifa RD$ {{ tarifa }}
                  }
                </p>
              </mat-card-content>
              <mat-card-actions>
                <button
                  mat-flat-button
                  type="button"
                  [disabled]="viajeActivo() !== null || iniciando() !== null"
                  (click)="iniciarViaje(asignacion)"
                >
                  @if (iniciando() === asignacion.id) {
                    <mat-spinner diameter="20" />
                  } @else {
                    Iniciar viaje
                  }
                </button>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 600px;
        margin: 0 auto;
      }
      .inicio__titulo {
        margin: 0 0 16px;
      }
      .inicio__centrado {
        display: grid;
        place-items: center;
        padding: 48px 0;
      }
      .inicio__error {
        color: var(--mat-sys-error, #b3261e);
        margin: 0 0 12px;
      }
      .inicio__viaje-activo {
        margin-bottom: 16px;
        border-color: var(--mat-sys-primary, #1976d2);
      }
      .inicio__viaje-activo-fila {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .inicio__detalle {
        margin: 4px 0 0;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
        font-size: 14px;
      }
      .inicio__lista {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      mat-spinner {
        display: inline-block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioConductorComponent implements OnInit {
  private readonly flotaApi = inject(FlotaApi);
  private readonly viajesApi = inject(ViajesApi);
  private readonly router = inject(Router);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly viajeActivo = signal<Viaje | null>(null);
  protected readonly asignaciones = signal<AsignacionBusRuta[]>([]);
  /** Id de la asignación cuyo inicio de viaje está en vuelo (null = ninguno). */
  protected readonly iniciando = signal<string | null>(null);

  ngOnInit(): void {
    forkJoin({
      asignaciones: this.flotaApi.listarMisAsignaciones(),
      viajeActivo: this.viajesApi.obtenerMiActivo(),
    }).subscribe({
      next: ({ asignaciones, viajeActivo }) => {
        this.asignaciones.set(asignaciones);
        this.viajeActivo.set(viajeActivo);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.error.set(
          extraerMensajeError(err, 'No se pudieron cargar tus asignaciones'),
        );
      },
    });
  }

  iniciarViaje(asignacion: AsignacionBusRuta): void {
    if (this.iniciando() !== null || this.viajeActivo() !== null) return;
    this.iniciando.set(asignacion.id);
    this.error.set(null);

    this.viajesApi.iniciar(asignacion.id).subscribe({
      next: () => void this.router.navigateByUrl('/conductor/viaje'),
      error: (err: unknown) => {
        this.iniciando.set(null);
        this.error.set(extraerMensajeError(err, 'No se pudo iniciar el viaje'));
      },
    });
  }
}
