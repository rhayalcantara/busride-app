import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  ParadaConUbicacion,
  ReservaCreada,
  ReservasApi,
  RutasApi,
} from '../../../core/api';
import { EstadoVacioComponent } from '../../../shared';
import { extraerMensajeError } from '../../auth/mensaje-error.util';

/**
 * Reservar asiento: elegir parada de origen y destino entre las paradas de la
 * ruta (precargadas desde la búsqueda) → POST /reservas → pantalla de QR con
 * countdown de 5:00 desde `expiraEn`; al expirar ofrece regenerar (crea una
 * reserva nueva). Los 400 del SP (saldo insuficiente, etc.) se muestran con
 * el `mensaje` del backend.
 *
 * Llega con query params desde la página de búsqueda:
 * viajeId, rutaId, rutaNombre, origenId, destinoId, lat, lng (posición del pasajero).
 */
@Component({
  selector: 'app-pasajero-reservar',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    EstadoVacioComponent,
  ],
  template: `
    @if (!contextoValido) {
      <app-estado-vacio
        icono="travel_explore"
        mensaje="Primero busca una ruta y elige un viaje para reservar."
        textoAccion="Buscar ruta"
        (accion)="irABuscar()"
      />
    } @else if (reserva(); as datos) {
      <section class="reservar reservar--qr">
        <mat-card class="reservar__card">
          <mat-card-header>
            <mat-card-title>Tu QR de abordaje</mat-card-title>
            <mat-card-subtitle>{{ rutaNombre }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content class="reservar__qr-contenido">
            <img
              class="reservar__qr"
              [class.reservar__qr--expirado]="expirado()"
              [src]="datos.qrImagen"
              alt="Código QR de abordaje"
            />
            @if (expirado()) {
              <p class="reservar__expirado">
                <mat-icon inline>timer_off</mat-icon>
                El QR expiró. Genera una reserva nueva para abordar.
              </p>
            } @else {
              <p class="reservar__countdown" [class.reservar__countdown--alerta]="restante() <= 60">
                {{ cuentaRegresiva() }}
              </p>
              <p class="reservar__hint">
                Muestra este código al conductor antes de que expire.
              </p>
            }
            <p class="reservar__mensaje-ok">{{ datos.mensaje }}</p>
          </mat-card-content>
          <mat-card-actions align="end">
            @if (expirado()) {
              <button mat-flat-button type="button" (click)="reservarAsiento()" [disabled]="creando()">
                <mat-icon>refresh</mat-icon>
                Regenerar QR
              </button>
            }
            <button mat-stroked-button type="button" (click)="verViajeEnVivo()">
              <mat-icon>directions_bus</mat-icon>
              Ver viaje en vivo
            </button>
            <button mat-button type="button" (click)="irAMisReservas()">Mis reservas</button>
          </mat-card-actions>
        </mat-card>
        @if (error(); as mensaje) {
          <p class="reservar__error">{{ mensaje }}</p>
        }
      </section>
    } @else {
      <section class="reservar">
        <mat-card class="reservar__card">
          <mat-card-header>
            <mat-card-title>Reservar asiento</mat-card-title>
            <mat-card-subtitle>{{ rutaNombre }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            @if (cargandoParadas()) {
              <div class="reservar__cargando">
                <mat-progress-spinner diameter="32" mode="indeterminate" />
                <span>Cargando paradas…</span>
              </div>
            } @else {
              <mat-form-field appearance="outline" class="reservar__campo">
                <mat-label>Parada de origen (subes)</mat-label>
                <mat-select [(ngModel)]="origenId">
                  @for (parada of paradas(); track parada.id) {
                    <mat-option [value]="parada.id">
                      {{ parada.orden }}. {{ parada.nombre }}
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="reservar__campo">
                <mat-label>Parada de destino (bajas)</mat-label>
                <mat-select [(ngModel)]="destinoId">
                  @for (parada of paradas(); track parada.id) {
                    <mat-option [value]="parada.id">
                      {{ parada.orden }}. {{ parada.nombre }}
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              @if (origenId !== null && origenId === destinoId) {
                <p class="reservar__error">La parada de origen y destino no pueden ser la misma.</p>
              }
            }
            @if (error(); as mensaje) {
              <p class="reservar__error">{{ mensaje }}</p>
            }
          </mat-card-content>
          <mat-card-actions align="end">
            <button mat-button type="button" (click)="irABuscar()">Volver</button>
            <button
              mat-flat-button
              type="button"
              (click)="reservarAsiento()"
              [disabled]="creando() || cargandoParadas() || origenId === null || destinoId === null || origenId === destinoId"
            >
              @if (creando()) {
                <mat-progress-spinner diameter="20" mode="indeterminate" />
              } @else {
                <ng-container><mat-icon>qr_code_2</mat-icon> Reservar y generar QR</ng-container>
              }
            </button>
          </mat-card-actions>
        </mat-card>
      </section>
    }
  `,
  styles: [
    `
      .reservar {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 480px;
        margin: 0 auto;
      }
      .reservar__card {
        width: 100%;
      }
      .reservar__campo {
        width: 100%;
      }
      .reservar__cargando {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 0;
      }
      .reservar__qr-contenido {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-align: center;
      }
      .reservar__qr {
        width: min(280px, 70vw);
        height: auto;
        image-rendering: pixelated;
      }
      .reservar__qr--expirado {
        opacity: 0.25;
        filter: grayscale(1);
      }
      .reservar__countdown {
        margin: 0;
        font-size: 40px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .reservar__countdown--alerta {
        color: var(--mat-sys-error, #b00020);
      }
      .reservar__hint,
      .reservar__mensaje-ok {
        margin: 0;
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
      .reservar__expirado {
        margin: 0;
        font-weight: 500;
        color: var(--mat-sys-error, #b00020);
      }
      .reservar__error {
        margin: 8px 0 0;
        color: var(--mat-sys-error, #b00020);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservarComponent {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly rutasApi = inject(RutasApi);
  private readonly reservasApi = inject(ReservasApi);
  private readonly destroyRef = inject(DestroyRef);

  // Contexto recibido por query params desde la búsqueda
  protected readonly viajeId: string;
  protected readonly rutaId: string;
  protected readonly rutaNombre: string;
  private readonly latPasajero: number;
  private readonly lngPasajero: number;
  protected readonly contextoValido: boolean;

  protected readonly paradas = signal<ParadaConUbicacion[]>([]);
  protected readonly cargandoParadas = signal(false);
  protected origenId: number | null = null;
  protected destinoId: number | null = null;

  protected readonly creando = signal(false);
  protected readonly error = signal('');
  protected readonly reserva = signal<ReservaCreada | null>(null);

  /** Segundos restantes del QR (recalculados cada segundo desde expiraEn). */
  protected readonly restante = signal(0);
  protected readonly expirado = computed(() => this.reserva() !== null && this.restante() <= 0);
  protected readonly cuentaRegresiva = computed(() => {
    const total = Math.max(0, this.restante());
    const minutos = Math.floor(total / 60);
    const segundos = total % 60;
    return `${minutos}:${segundos.toString().padStart(2, '0')}`;
  });

  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const params = this.ruta.snapshot.queryParamMap;
    this.viajeId = params.get('viajeId') ?? '';
    this.rutaId = params.get('rutaId') ?? '';
    this.rutaNombre = params.get('rutaNombre') ?? 'Ruta seleccionada';
    this.latPasajero = Number(params.get('lat'));
    this.lngPasajero = Number(params.get('lng'));
    const origenParam = Number(params.get('origenId'));
    const destinoParam = Number(params.get('destinoId'));
    if (Number.isInteger(origenParam) && origenParam > 0) this.origenId = origenParam;
    if (Number.isInteger(destinoParam) && destinoParam > 0) this.destinoId = destinoParam;

    this.contextoValido =
      this.viajeId !== '' &&
      this.rutaId !== '' &&
      Number.isFinite(this.latPasajero) &&
      Number.isFinite(this.lngPasajero);

    if (this.contextoValido) {
      this.cargarParadas();
    }

    this.destroyRef.onDestroy(() => this.detenerTemporizador());
  }

  private cargarParadas(): void {
    this.cargandoParadas.set(true);
    this.rutasApi.obtenerParadas(this.rutaId).subscribe({
      next: (paradas) => {
        this.paradas.set([...paradas].sort((a, b) => a.orden - b.orden));
        this.cargandoParadas.set(false);
      },
      error: (err: unknown) => {
        this.cargandoParadas.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudieron cargar las paradas de la ruta'));
      },
    });
  }

  /** Crea la reserva (también sirve para regenerar el QR expirado). */
  reservarAsiento(): void {
    if (
      this.creando() ||
      this.origenId === null ||
      this.destinoId === null ||
      this.origenId === this.destinoId
    ) {
      return;
    }

    this.creando.set(true);
    this.error.set('');

    this.reservasApi
      .crear({
        viajeId: this.viajeId,
        paradaOrigenId: this.origenId,
        paradaDestinoId: this.destinoId,
        latPasajero: this.latPasajero,
        lngPasajero: this.lngPasajero,
      })
      .subscribe({
        next: (creada) => {
          this.creando.set(false);
          this.reserva.set(creada);
          this.iniciarTemporizador(creada.expiraEn);
        },
        error: (err: unknown) => {
          this.creando.set(false);
          // 400 del SP: saldo insuficiente, viaje no disponible, etc.
          this.error.set(extraerMensajeError(err, 'No se pudo crear la reserva'));
        },
      });
  }

  private iniciarTemporizador(expiraEn: string): void {
    this.detenerTemporizador();
    const expira = new Date(expiraEn).getTime();
    const calcular = () =>
      this.restante.set(Math.max(0, Math.floor((expira - Date.now()) / 1000)));
    calcular();
    this.temporizador = setInterval(() => {
      calcular();
      if (this.restante() <= 0) {
        this.detenerTemporizador();
      }
    }, 1000);
  }

  private detenerTemporizador(): void {
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  verViajeEnVivo(): void {
    void this.router.navigate(['/pasajero/viaje', this.viajeId], {
      queryParams: { rutaId: this.rutaId, rutaNombre: this.rutaNombre },
    });
  }

  irABuscar(): void {
    void this.router.navigateByUrl('/pasajero');
  }

  irAMisReservas(): void {
    void this.router.navigateByUrl('/pasajero/reservas');
  }
}
