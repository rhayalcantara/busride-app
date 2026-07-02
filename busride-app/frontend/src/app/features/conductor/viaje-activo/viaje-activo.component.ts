import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  ParadaConUbicacion,
  PasajeroEnParada,
  RutasApi,
  Viaje,
  ViajesApi,
} from '../../../core/api';
import { TrackingSocketService } from '../../../core/socket';
import {
  CoordenadaMapa,
  EstadoVacioComponent,
  extraerMensajeError,
  FechaCortaPipe,
  MapaComponent,
  MarcadorMapa,
  sonUuidsIguales,
} from '../../../shared';

/** Cada cuánto se emite la posición por el socket (throttle del watch). */
const INTERVALO_SOCKET_MS = 5_000;
/** Cada cuánto se persiste la posición vía PATCH /viajes/:id/posicion. */
const INTERVALO_PERSISTENCIA_MS = 15_000;

/**
 * Pantalla principal del conductor durante un viaje EN_CURSO:
 * - Mapa con su posición (Geolocation watchPosition) y las paradas de la ruta.
 * - Emisión de la posición por socket cada ~5 s (con throttle) y persistencia
 *   periódica vía API cada ~15 s.
 * - Lista de paradas con consulta BAJO DEMANDA de pasajeros esperando.
 * - Asientos disponibles en vivo (evento `disponibilidad_actualizada`).
 */
@Component({
  selector: 'app-viaje-activo',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
    MapaComponent,
    EstadoVacioComponent,
    FechaCortaPipe,
  ],
  template: `
    @if (cargando()) {
      <div class="viaje__centrado"><mat-spinner diameter="40" /></div>
    } @else if (!viaje()) {
      <app-estado-vacio
        icono="airport_shuttle"
        mensaje="No tienes ningún viaje en curso."
        textoAccion="Ir a mis asignaciones"
        (accion)="irAInicio()"
      />
    } @else {
      <div class="viaje__encabezado">
        <div>
          <h2 class="viaje__titulo">{{ viaje()!.ruta?.nombre ?? 'Viaje en curso' }}</h2>
          <p class="viaje__subtitulo">
            Inició {{ viaje()!.fechaInicio | fechaCorta }}
          </p>
        </div>
        <div class="viaje__asientos" [class.viaje__asientos--lleno]="asientosDisponibles() === 0">
          <span class="viaje__asientos-numero">{{ asientosDisponibles() }}</span>
          <span class="viaje__asientos-texto">asientos libres</span>
        </div>
      </div>

      @if (error(); as mensaje) {
        <p class="viaje__error" role="alert">{{ mensaje }}</p>
      }
      @if (errorGps(); as mensaje) {
        <p class="viaje__aviso" role="alert">
          <mat-icon inline>gps_off</mat-icon>
          {{ mensaje }}
        </p>
      }

      <div class="viaje__mapa">
        <app-mapa [centro]="centroMapa()" [marcadores]="marcadores()" [polyline]="trazado()" />
      </div>

      <div class="viaje__acciones">
        <a mat-flat-button routerLink="/conductor/abordar">
          <mat-icon>qr_code_scanner</mat-icon>
          Abordar pasajero
        </a>
        <a mat-stroked-button routerLink="/conductor/finalizar">
          <mat-icon>flag</mat-icon>
          Finalizar viaje
        </a>
      </div>

      <h3 class="viaje__seccion">Paradas de la ruta</h3>
      @if (paradas().length === 0) {
        <p class="viaje__subtitulo">Cargando paradas…</p>
      }
      <div class="viaje__paradas">
        @for (parada of paradas(); track parada.id) {
          <mat-card appearance="outlined">
            <mat-card-content>
              <div class="viaje__parada-fila">
                <mat-icon>{{ parada.es_terminal ? 'flag_circle' : 'place' }}</mat-icon>
                <div class="viaje__parada-datos">
                  <strong>{{ parada.orden }}. {{ parada.nombre }}</strong>
                  @if (parada.referencia) {
                    <span class="viaje__subtitulo">{{ parada.referencia }}</span>
                  }
                </div>
                <button
                  mat-stroked-button
                  type="button"
                  [disabled]="paradaCargando() === parada.id"
                  (click)="alternarPasajeros(parada)"
                >
                  @if (paradaCargando() === parada.id) {
                    <mat-spinner diameter="18" />
                  } @else if (paradaAbierta() === parada.id) {
                    Ocultar
                  } @else {
                    Pasajeros
                  }
                </button>
              </div>

              @if (paradaAbierta() === parada.id) {
                @if (pasajerosParada().length === 0) {
                  <p class="viaje__subtitulo viaje__pasajeros-vacio">
                    Nadie espera en esta parada ahora mismo.
                  </p>
                } @else {
                  <mat-list>
                    @for (pasajero of pasajerosParada(); track pasajero.reserva_id) {
                      <mat-list-item>
                        <mat-icon matListItemIcon>person</mat-icon>
                        <span matListItemTitle>{{ pasajero.nombre_pasajero }}</span>
                        <span matListItemLine>
                          Hacia {{ pasajero.parada_destino }} ·
                          reservó {{ pasajero.hora_reserva | fechaCorta }}
                        </span>
                      </mat-list-item>
                    }
                  </mat-list>
                }
              }
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
        max-width: 720px;
        margin: 0 auto;
      }
      .viaje__centrado {
        display: grid;
        place-items: center;
        padding: 48px 0;
      }
      .viaje__encabezado {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }
      .viaje__titulo {
        margin: 0;
      }
      .viaje__subtitulo {
        margin: 2px 0 0;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
        font-size: 14px;
      }
      .viaje__asientos {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 16px;
        border-radius: 12px;
        background: var(--mat-sys-secondary-container, rgba(25, 118, 210, 0.12));
      }
      .viaje__asientos--lleno {
        background: var(--mat-sys-error-container, #fde7e9);
      }
      .viaje__asientos-numero {
        font-size: 28px;
        font-weight: 700;
        line-height: 1;
      }
      .viaje__asientos-texto {
        font-size: 12px;
      }
      .viaje__error {
        color: var(--mat-sys-error, #b3261e);
        margin: 8px 0;
      }
      .viaje__aviso {
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
        margin: 8px 0;
        font-size: 14px;
      }
      .viaje__mapa {
        height: 320px;
        margin: 12px 0;
        border-radius: 12px;
        overflow: hidden;
      }
      .viaje__acciones {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .viaje__acciones a {
        flex: 1 1 160px;
      }
      .viaje__seccion {
        margin: 16px 0 8px;
      }
      .viaje__paradas {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .viaje__parada-fila {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .viaje__parada-datos {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .viaje__pasajeros-vacio {
        margin-top: 12px;
      }
      mat-spinner {
        display: inline-block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViajeActivoComponent implements OnInit {
  private readonly viajesApi = inject(ViajesApi);
  private readonly rutasApi = inject(RutasApi);
  private readonly socket = inject(TrackingSocketService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly viaje = signal<Viaje | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly errorGps = signal<string | null>(null);

  protected readonly paradas = signal<ParadaConUbicacion[]>([]);
  protected readonly miPosicion = signal<CoordenadaMapa | null>(null);
  protected readonly asientosDisponibles = signal(0);

  /** Parada con el panel de pasajeros abierto (consulta bajo demanda). */
  protected readonly paradaAbierta = signal<number | null>(null);
  protected readonly paradaCargando = signal<number | null>(null);
  protected readonly pasajerosParada = signal<PasajeroEnParada[]>([]);

  protected readonly trazado = computed<CoordenadaMapa[]>(() =>
    this.paradas().map((p) => ({ lat: p.lat, lng: p.lng })),
  );

  protected readonly marcadores = computed<MarcadorMapa[]>(() => {
    const marcadores: MarcadorMapa[] = this.paradas().map((p) => ({
      id: `parada-${p.id}`,
      tipo: 'parada',
      lat: p.lat,
      lng: p.lng,
      tooltip: `${p.orden}. ${p.nombre}`,
    }));
    const posicion = this.miPosicion();
    if (posicion) {
      marcadores.push({ id: 'mi-bus', tipo: 'bus', ...posicion, tooltip: 'Mi posición' });
    }
    return marcadores;
  });

  protected readonly centroMapa = computed<CoordenadaMapa>(() => {
    const posicion = this.miPosicion();
    if (posicion) return posicion;
    const primera = this.paradas()[0];
    if (primera) return { lat: primera.lat, lng: primera.lng };
    return { lat: 18.4861, lng: -69.9312 }; // Santo Domingo por defecto
  });

  private watchId: number | null = null;
  private ultimaEmisionSocket = 0;
  private ultimaPersistencia = 0;

  constructor() {
    this.destroyRef.onDestroy(() => this.detenerGps());
  }

  ngOnInit(): void {
    this.viajesApi.obtenerMiActivo().subscribe({
      next: (viaje) => {
        this.cargando.set(false);
        this.viaje.set(viaje);
        if (!viaje) return;

        this.asientosDisponibles.set(viaje.asientosDisponibles);
        if (viaje.posLat !== null && viaje.posLng !== null) {
          this.miPosicion.set({ lat: viaje.posLat, lng: viaje.posLng });
        }
        this.cargarParadas(viaje.rutaId);
        this.escucharDisponibilidad(viaje.id);
        this.iniciarGps(viaje.id);
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

  /** Abre/cierra el panel de pasajeros de una parada (consulta bajo demanda). */
  alternarPasajeros(parada: ParadaConUbicacion): void {
    if (this.paradaAbierta() === parada.id) {
      this.paradaAbierta.set(null);
      this.pasajerosParada.set([]);
      return;
    }
    const viaje = this.viaje();
    if (!viaje || this.paradaCargando() !== null) return;

    this.paradaCargando.set(parada.id);
    this.viajesApi.pasajerosEnParada(viaje.id, parada.id).subscribe({
      next: (pasajeros) => {
        this.paradaCargando.set(null);
        this.pasajerosParada.set(pasajeros);
        this.paradaAbierta.set(parada.id);
      },
      error: (err: unknown) => {
        this.paradaCargando.set(null);
        this.error.set(extraerMensajeError(err, 'No se pudieron consultar los pasajeros'));
      },
    });
  }

  private cargarParadas(rutaId: string): void {
    this.rutasApi.obtenerParadas(rutaId).subscribe({
      next: (paradas) => this.paradas.set([...paradas].sort((a, b) => a.orden - b.orden)),
      error: (err: unknown) =>
        this.error.set(extraerMensajeError(err, 'No se pudieron cargar las paradas')),
    });
  }

  /** Asientos en vivo: evento global (tras cada abordaje) filtrado por este viaje. */
  private escucharDisponibilidad(viajeId: string): void {
    this.socket
      .escucharDisponibilidad()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((datos) => {
        if (sonUuidsIguales(datos.viajeId, viajeId)) {
          this.asientosDisponibles.set(datos.asientosDisponibles);
        }
      });
  }

  /**
   * Sigue la posición del dispositivo. El mapa se actualiza con cada lectura,
   * pero la emisión por socket se limita a una cada ~5 s y la persistencia
   * por API a una cada ~15 s (throttle manual con marcas de tiempo).
   */
  private iniciarGps(viajeId: string): void {
    if (!('geolocation' in navigator)) {
      this.errorGps.set('Este dispositivo no soporta geolocalización.');
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (lectura) => {
        const lat = lectura.coords.latitude;
        const lng = lectura.coords.longitude;
        this.errorGps.set(null);
        this.miPosicion.set({ lat, lng });

        const ahora = Date.now();
        if (ahora - this.ultimaEmisionSocket >= INTERVALO_SOCKET_MS) {
          this.ultimaEmisionSocket = ahora;
          this.socket.emitirPosicion(viajeId, lat, lng);
        }
        if (ahora - this.ultimaPersistencia >= INTERVALO_PERSISTENCIA_MS) {
          this.ultimaPersistencia = ahora;
          this.viajesApi.actualizarPosicion(viajeId, lat, lng).subscribe({
            // Persistencia best-effort: el socket sigue siendo el canal vivo.
            error: () => undefined,
          });
        }
      },
      (errorGps) => {
        this.errorGps.set(
          errorGps.code === errorGps.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado: activa el GPS para transmitir tu posición.'
            : 'No se pudo obtener tu ubicación (señal GPS débil o no disponible).',
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  }

  private detenerGps(): void {
    if (this.watchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}
