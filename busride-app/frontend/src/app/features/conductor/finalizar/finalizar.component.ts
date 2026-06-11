import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Viaje, ViajeFinalizado, ViajesApi } from '../../../core/api';
import {
  ConfirmDialogComponent,
  EstadoVacioComponent,
  FechaCortaPipe,
  MonedaDopPipe,
} from '../../../shared';
import { extraerMensajeError } from '../../auth/mensaje-error.util';

/**
 * Finalización del viaje activo: confirmación explícita (confirm-dialog) →
 * POST /viajes/:id/finalizar → muestra la liquidación que genera
 * sp_liquidar_viaje (fila snake_case: bruto, comisiones y neto).
 */
@Component({
  selector: 'app-finalizar-viaje',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    EstadoVacioComponent,
    FechaCortaPipe,
    MonedaDopPipe,
  ],
  template: `
    <h2 class="finalizar__titulo">Finalizar viaje</h2>

    @if (cargando()) {
      <div class="finalizar__centrado"><mat-spinner diameter="40" /></div>
    } @else if (liquidacion(); as resumen) {
      <!-- Viaje finalizado: liquidación generada por sp_liquidar_viaje -->
      <mat-card class="finalizar__exito" appearance="outlined">
        <mat-card-content>
          <mat-icon class="finalizar__exito-icono">flag_circle</mat-icon>
          <h3>Viaje finalizado</h3>
          <dl class="finalizar__detalle">
            <div>
              <dt>Pasajeros transportados</dt>
              <dd>{{ resumen.total_pasajeros }}</dd>
            </div>
            <div>
              <dt>Ingreso bruto</dt>
              <dd>{{ resumen.ingreso_bruto | monedaDop }}</dd>
            </div>
            <div>
              <dt>Comisión plataforma</dt>
              <dd>− {{ resumen.comision_plataforma | monedaDop }}</dd>
            </div>
            <div>
              <dt>Comisión asociación</dt>
              <dd>− {{ resumen.comision_asociacion | monedaDop }}</dd>
            </div>
            <div class="finalizar__neto">
              <dt>Neto para ti</dt>
              <dd>{{ resumen.monto_neto_conductor | monedaDop }}</dd>
            </div>
          </dl>
        </mat-card-content>
        <mat-card-actions class="finalizar__acciones">
          <a mat-flat-button routerLink="/conductor/liquidaciones">
            <mat-icon>payments</mat-icon>
            Ver mis liquidaciones
          </a>
          <a mat-stroked-button routerLink="/conductor">Ir al inicio</a>
        </mat-card-actions>
      </mat-card>
    } @else if (!viaje()) {
      <app-estado-vacio
        icono="airport_shuttle"
        mensaje="No tienes ningún viaje en curso que finalizar."
        textoAccion="Ir a mis asignaciones"
        (accion)="irAInicio()"
      />
    } @else {
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>{{ viaje()!.ruta?.nombre ?? 'Viaje en curso' }}</mat-card-title>
          <mat-card-subtitle>Inició {{ viaje()!.fechaInicio | fechaCorta }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p class="finalizar__dato">
            <mat-icon inline>event_seat</mat-icon>
            {{ viaje()!.asientosDisponibles }} asientos libres
          </p>
          <p class="finalizar__dato">
            <mat-icon inline>attach_money</mat-icon>
            Ingreso acumulado: {{ viaje()!.ingresoTotal | monedaDop }}
          </p>

          @if (error(); as mensaje) {
            <p class="finalizar__error" role="alert">{{ mensaje }}</p>
          }
        </mat-card-content>
        <mat-card-actions>
          <button
            mat-flat-button
            class="finalizar__boton"
            type="button"
            [disabled]="finalizando()"
            (click)="finalizar()"
          >
            @if (finalizando()) {
              <mat-spinner diameter="20" />
            } @else {
              Finalizar viaje
            }
          </button>
        </mat-card-actions>
      </mat-card>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 480px;
        margin: 0 auto;
      }
      .finalizar__titulo {
        margin: 0 0 16px;
      }
      .finalizar__centrado {
        display: grid;
        place-items: center;
        padding: 48px 0;
      }
      .finalizar__dato {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 8px 0;
      }
      .finalizar__error {
        color: var(--mat-sys-error, #b3261e);
        margin: 12px 0 0;
      }
      .finalizar__boton {
        width: 100%;
      }
      .finalizar__exito mat-card-content {
        text-align: center;
      }
      .finalizar__exito-icono {
        font-size: 56px;
        width: 56px;
        height: 56px;
        color: #2e7d32;
      }
      .finalizar__detalle {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 16px 0 0;
        text-align: left;
      }
      .finalizar__detalle div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .finalizar__detalle dt {
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
      .finalizar__detalle dd {
        margin: 0;
        font-weight: 600;
      }
      .finalizar__neto {
        padding-top: 10px;
        border-top: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12));
        font-size: 18px;
      }
      .finalizar__acciones {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      mat-spinner {
        display: inline-block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinalizarViajeComponent implements OnInit {
  private readonly viajesApi = inject(ViajesApi);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly cargando = signal(true);
  protected readonly viaje = signal<Viaje | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly finalizando = signal(false);
  protected readonly liquidacion = signal<ViajeFinalizado | null>(null);

  ngOnInit(): void {
    this.viajesApi.obtenerMiActivo().subscribe({
      next: (viaje) => {
        this.viaje.set(viaje);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudo cargar el viaje activo'));
      },
    });
  }

  irAInicio(): void {
    void this.router.navigateByUrl('/conductor');
  }

  finalizar(): void {
    const viaje = this.viaje();
    if (!viaje || this.finalizando()) return;

    ConfirmDialogComponent.abrir(this.dialog, {
      titulo: 'Finalizar viaje',
      mensaje:
        '¿Seguro que quieres finalizar el viaje? Se generará la liquidación y dejarás de recibir pasajeros.',
      textoConfirmar: 'Finalizar',
    }).subscribe((confirmado) => {
      if (!confirmado) return;

      this.finalizando.set(true);
      this.error.set(null);

      this.viajesApi.finalizar(viaje.id).subscribe({
        next: (resumen) => {
          this.finalizando.set(false);
          this.liquidacion.set(resumen);
        },
        error: (err: unknown) => {
          this.finalizando.set(false);
          this.error.set(extraerMensajeError(err, 'No se pudo finalizar el viaje'));
        },
      });
    });
  }
}
