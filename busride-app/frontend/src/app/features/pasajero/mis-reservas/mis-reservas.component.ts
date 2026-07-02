import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EstadoReserva, Reserva, ReservasApi } from '../../../core/api';
import { EstadoVacioComponent, extraerMensajeError, FechaCortaPipe } from '../../../shared';
import {
  CalificarConductorDialogComponent,
  DatosCalificarDialog,
} from './calificar-conductor-dialog.component';

const ETIQUETA_ESTADO: Record<EstadoReserva, string> = {
  PROVISIONAL: 'Provisional',
  CONFIRMADA: 'Confirmada',
  ABORDADA: 'Abordada',
  EXPIRADA: 'Expirada',
  CANCELADA: 'Cancelada',
};

/**
 * Mis reservas: historial del pasajero (GET /reservas/mias, ordenado por
 * fecha desc en el backend) con chip de estado. Desde una reserva ABORDADA
 * aún sin calificar (flag `calificada` del backend, F-09a) abre el diálogo de
 * calificar conductor; desde una reserva activa con viaje EN_CURSO permite
 * seguir el bus en vivo. 404 (sin perfil de pasajero) → estado vacío claro.
 */
@Component({
  selector: 'app-pasajero-mis-reservas',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    EstadoVacioComponent,
    FechaCortaPipe,
  ],
  template: `
    @if (sinPerfil()) {
      <app-estado-vacio
        icono="person_off"
        mensaje="Tu usuario no tiene un perfil de pasajero asociado, por lo que no hay reservas que mostrar. Contacta a soporte de BusRide."
      />
    } @else if (cargando()) {
      <div class="reservas__cargando">
        <mat-progress-spinner diameter="40" mode="indeterminate" />
      </div>
    } @else if (error(); as mensaje) {
      <app-estado-vacio
        icono="error_outline"
        [mensaje]="mensaje"
        textoAccion="Reintentar"
        (accion)="cargar()"
      />
    } @else if (reservas().length === 0) {
      <app-estado-vacio
        icono="confirmation_number"
        mensaje="Aún no tienes reservas. Busca una ruta y reserva tu asiento."
        textoAccion="Buscar ruta"
        (accion)="irABuscar()"
      />
    } @else {
      <section class="reservas">
        <h2 class="reservas__titulo">Mis reservas</h2>
        @for (reserva of reservas(); track reserva.id) {
          <mat-card class="reservas__card">
            <mat-card-content>
              <div class="reservas__encabezado">
                <span class="reservas__ruta">
                  {{ reserva.viaje?.ruta?.nombre || 'Ruta' }}
                </span>
                <mat-chip class="reservas__chip" [class]="claseEstado(reserva.estado)" disabled>
                  {{ etiquetaEstado(reserva.estado) }}
                </mat-chip>
              </div>
              <p class="reservas__detalle">
                <mat-icon inline>swap_calls</mat-icon>
                {{ reserva.paradaOrigen?.nombre || 'Parada ' + reserva.paradaOrigenId }} →
                {{ reserva.paradaDestino?.nombre || 'Parada ' + reserva.paradaDestinoId }}
              </p>
              <p class="reservas__detalle">
                <mat-icon inline>schedule</mat-icon>
                Reservada: {{ reserva.fechaCreacion | fechaCorta }}
                @if (reserva.fechaAbordaje) {
                  · Abordada: {{ reserva.fechaAbordaje | fechaCorta }}
                }
                @if (reserva.numeroAsiento !== null) {
                  · Asiento {{ reserva.numeroAsiento }}
                }
              </p>
            </mat-card-content>
            @if (puedeVerEnVivo(reserva) || puedeCalificar(reserva)) {
              <mat-card-actions align="end">
                @if (puedeVerEnVivo(reserva)) {
                  <button mat-stroked-button type="button" (click)="verEnVivo(reserva)">
                    <mat-icon>directions_bus</mat-icon>
                    Ver en vivo
                  </button>
                }
                @if (puedeCalificar(reserva)) {
                  <button mat-flat-button type="button" (click)="calificar(reserva)">
                    <mat-icon>star_rate</mat-icon>
                    Calificar conductor
                  </button>
                }
              </mat-card-actions>
            }
          </mat-card>
        }
      </section>
    }
  `,
  styles: [
    `
      .reservas {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 640px;
        margin: 0 auto;
      }
      .reservas__titulo {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
      }
      .reservas__cargando {
        display: flex;
        justify-content: center;
        padding: 48px 0;
      }
      .reservas__encabezado {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .reservas__ruta {
        font-weight: 600;
        font-size: 15px;
      }
      .reservas__detalle {
        margin: 6px 0 0;
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
      /* Chips de estado: colores fijos legibles, sin depender del tema */
      .reservas__chip {
        pointer-events: none;
      }
      .reservas__chip--provisional {
        --mdc-chip-elevated-disabled-container-color: #fff8e1;
        --mdc-chip-disabled-label-text-color: #8d6e00;
      }
      .reservas__chip--confirmada {
        --mdc-chip-elevated-disabled-container-color: #e3f2fd;
        --mdc-chip-disabled-label-text-color: #1565c0;
      }
      .reservas__chip--abordada {
        --mdc-chip-elevated-disabled-container-color: #e8f5e9;
        --mdc-chip-disabled-label-text-color: #2e7d32;
      }
      .reservas__chip--expirada,
      .reservas__chip--cancelada {
        --mdc-chip-elevated-disabled-container-color: #eceff1;
        --mdc-chip-disabled-label-text-color: #546e7a;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisReservasComponent {
  private readonly reservasApi = inject(ReservasApi);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly reservas = signal<Reserva[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly sinPerfil = signal(false);

  /** Viajes ya calificados en esta sesión (para ocultar el botón sin recargar). */
  private readonly viajesCalificados = signal<ReadonlySet<string>>(new Set());

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.reservasApi.listarMias().subscribe({
      next: (reservas) => {
        this.reservas.set(reservas);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.sinPerfil.set(true);
          return;
        }
        this.error.set(extraerMensajeError(err, 'No se pudieron cargar tus reservas'));
      },
    });
  }

  protected etiquetaEstado(estado: EstadoReserva): string {
    return ETIQUETA_ESTADO[estado] ?? estado;
  }

  protected claseEstado(estado: EstadoReserva): string {
    return `reservas__chip reservas__chip--${estado.toLowerCase()}`;
  }

  /** Reserva activa de un viaje EN_CURSO: se puede seguir el bus en vivo. */
  protected puedeVerEnVivo(reserva: Reserva): boolean {
    return (
      reserva.viaje?.estado === 'EN_CURSO' &&
      (reserva.estado === 'PROVISIONAL' ||
        reserva.estado === 'CONFIRMADA' ||
        reserva.estado === 'ABORDADA')
    );
  }

  /** ABORDADA con conductor conocido y aún sin calificar (flag del backend). */
  protected puedeCalificar(reserva: Reserva): boolean {
    if (reserva.estado !== 'ABORDADA' || reserva.calificada) return false;
    if (!reserva.viaje?.conductorId) return false;
    // Calificadas en esta sesión: se ocultan sin esperar al refetch.
    return !this.viajesCalificados().has(reserva.viajeId);
  }

  verEnVivo(reserva: Reserva): void {
    void this.router.navigate(['/pasajero/viaje', reserva.viajeId], {
      queryParams: {
        rutaId: reserva.viaje?.rutaId ?? null,
        rutaNombre: reserva.viaje?.ruta?.nombre ?? null,
      },
    });
  }

  calificar(reserva: Reserva): void {
    const conductorId = reserva.viaje?.conductorId;
    if (!conductorId) return;

    const datos: DatosCalificarDialog = {
      conductorId,
      viajeId: reserva.viajeId,
      nombreRuta: reserva.viaje?.ruta?.nombre,
    };

    this.dialog
      .open(CalificarConductorDialogComponent, { data: datos, autoFocus: false })
      .afterClosed()
      .subscribe((respuesta) => {
        if (!respuesta) return;
        this.viajesCalificados.update((previos) => new Set(previos).add(reserva.viajeId));
        this.snackBar.open(respuesta.mensaje || 'Calificación registrada', 'OK', {
          duration: 5000,
        });
      });
  }

  irABuscar(): void {
    void this.router.navigateByUrl('/pasajero');
  }
}
