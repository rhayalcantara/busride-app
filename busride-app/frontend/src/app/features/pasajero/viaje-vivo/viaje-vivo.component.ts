import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ParadaConUbicacion, RutasApi, ViajeDetalle, ViajesApi } from '../../../core/api';
import { PosicionBus, TrackingSocketService } from '../../../core/socket';
import {
  CoordenadaMapa,
  EstadoVacioComponent,
  FechaCortaPipe,
  MapaComponent,
  MarcadorMapa,
} from '../../../shared';

const CENTRO_DEFECTO: CoordenadaMapa = { lat: 18.4861, lng: -69.9312 };

const ETIQUETA_ESTADO_VIAJE: Record<string, string> = {
  PROGRAMADO: 'Programado',
  EN_CURSO: 'En curso',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};

/**
 * Viaje en vivo: carga el estado inicial con `GET /viajes/:id` (F-09a:
 * estado, nombre de ruta y última posición conocida — ya no depende solo de
 * query params) y luego se suscribe por Socket.IO a la sala del viaje
 * (`suscribir_viaje`) para pintar el bus moviéndose con cada `posicion_bus`.
 * Se desuscribe al salir de la página.
 *
 * Ruta: /pasajero/viaje/:viajeId (query params rutaId/rutaNombre opcionales,
 * solo como datos preliminares mientras llega el detalle).
 */
@Component({
  selector: 'app-pasajero-viaje-vivo',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MapaComponent, EstadoVacioComponent, FechaCortaPipe],
  template: `
    @if (!viajeId) {
      <app-estado-vacio
        icono="directions_bus"
        mensaje="No se indicó un viaje para seguir en vivo."
        textoAccion="Buscar ruta"
        (accion)="irABuscar()"
      />
    } @else {
      <section class="vivo">
        <mat-card class="vivo__estado">
          <mat-card-content class="vivo__estado-contenido">
            @if (posicion(); as pos) {
              <mat-icon class="vivo__icono vivo__icono--activo">directions_bus</mat-icon>
              <div>
                <p class="vivo__titulo">{{ rutaNombre() }}</p>
                <p class="vivo__detalle">
                  {{ etiquetaEstado() }} · última posición: {{ pos.timestamp | fechaCorta }}
                </p>
              </div>
            } @else {
              <mat-icon class="vivo__icono">satellite_alt</mat-icon>
              <div>
                <p class="vivo__titulo">{{ rutaNombre() }}</p>
                <p class="vivo__detalle">
                  @if (viajeFinalizado()) {
                    Este viaje ya finalizó.
                  } @else {
                    Esperando la posición del bus… (el conductor la emite cada ~5 s)
                  }
                </p>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <div class="vivo__mapa">
          <app-mapa
            [centro]="centro()"
            [zoom]="15"
            [marcadores]="marcadores()"
            [polyline]="polyline()"
          />
        </div>

        <div class="vivo__acciones">
          <button mat-stroked-button type="button" (click)="irAMisReservas()">
            <mat-icon>confirmation_number</mat-icon>
            Mis reservas
          </button>
          <button mat-button type="button" (click)="irABuscar()">Buscar otra ruta</button>
        </div>
      </section>
    }
  `,
  styles: [
    `
      .vivo {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 720px;
        margin: 0 auto;
      }
      .vivo__estado-contenido {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .vivo__icono {
        font-size: 36px;
        width: 36px;
        height: 36px;
        opacity: 0.5;
      }
      .vivo__icono--activo {
        opacity: 1;
        color: var(--mat-sys-primary, #1976d2);
      }
      .vivo__titulo {
        margin: 0;
        font-weight: 600;
      }
      .vivo__detalle {
        margin: 0;
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
      .vivo__mapa {
        height: 55vh;
        min-height: 320px;
        border-radius: 12px;
        overflow: hidden;
      }
      .vivo__acciones {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViajeVivoComponent {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly rutasApi = inject(RutasApi);
  private readonly viajesApi = inject(ViajesApi);
  private readonly tracking = inject(TrackingSocketService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly viajeId: string;

  protected readonly detalle = signal<ViajeDetalle | null>(null);
  protected readonly posicion = signal<PosicionBus | null>(null);
  protected readonly paradas = signal<ParadaConUbicacion[]>([]);

  /** Nombre preliminar de la ruta (query param) hasta que llega el detalle. */
  private readonly nombrePreliminar: string;

  protected readonly rutaNombre = computed(
    () => this.detalle()?.ruta.nombre ?? this.nombrePreliminar,
  );

  protected readonly etiquetaEstado = computed(() => {
    const estado = this.detalle()?.estado;
    return (estado && ETIQUETA_ESTADO_VIAJE[estado]) || 'Bus en movimiento';
  });

  protected readonly viajeFinalizado = computed(() => {
    const estado = this.detalle()?.estado;
    return estado === 'FINALIZADO' || estado === 'CANCELADO';
  });

  /** El mapa sigue al bus; antes de la primera posición, primera parada o centro por defecto. */
  protected readonly centro = computed<CoordenadaMapa>(() => {
    const pos = this.posicion();
    if (pos) return { lat: pos.lat, lng: pos.lng };
    const paradas = this.paradas();
    if (paradas.length > 0) return { lat: paradas[0].lat, lng: paradas[0].lng };
    return CENTRO_DEFECTO;
  });

  protected readonly marcadores = computed<MarcadorMapa[]>(() => {
    const lista: MarcadorMapa[] = this.paradas().map((parada) => ({
      id: `parada-${parada.id}`,
      tipo: 'parada' as const,
      lat: parada.lat,
      lng: parada.lng,
      tooltip: `${parada.orden}. ${parada.nombre}`,
    }));
    const pos = this.posicion();
    if (pos) {
      lista.push({ id: 'bus', tipo: 'bus', lat: pos.lat, lng: pos.lng, tooltip: 'Bus en vivo' });
    }
    return lista;
  });

  protected readonly polyline = computed<CoordenadaMapa[]>(() =>
    [...this.paradas()]
      .sort((a, b) => a.orden - b.orden)
      .map((p) => ({ lat: p.lat, lng: p.lng })),
  );

  /** Ruta cuyas paradas ya se pidieron (evita la doble carga query param + detalle). */
  private rutaCargadaId: string | null = null;

  constructor() {
    this.viajeId = this.ruta.snapshot.paramMap.get('viajeId') ?? '';
    this.nombrePreliminar = this.ruta.snapshot.queryParamMap.get('rutaNombre') ?? 'Viaje en vivo';
    const rutaIdPreliminar = this.ruta.snapshot.queryParamMap.get('rutaId');

    if (this.viajeId) {
      // Estado inicial real (estado, ruta, última posición) vía API (F-09a).
      this.viajesApi.obtenerDetalle(this.viajeId).subscribe({
        next: (detalle) => {
          this.detalle.set(detalle);
          // Última posición conocida: el mapa no queda vacío hasta el primer evento.
          if (detalle.posicion && this.posicion() === null) {
            this.posicion.set({
              viajeId: detalle.id,
              lat: detalle.posicion.lat,
              lng: detalle.posicion.lng,
              timestamp: detalle.posicion.timestamp ?? '',
            });
          }
          this.cargarParadas(detalle.ruta.id);
        },
        // Sin detalle la página sigue funcionando con socket + query params.
        error: () => undefined,
      });

      // Suscripción a la sala del viaje; al destruir la página se abandona.
      this.tracking
        .suscribirViaje(this.viajeId)
        .pipe(takeUntilDestroyed())
        .subscribe((posicion) => this.posicion.set(posicion));
      this.destroyRef.onDestroy(() => this.tracking.desuscribirViaje(this.viajeId));
    }

    if (rutaIdPreliminar) {
      this.cargarParadas(rutaIdPreliminar);
    }
  }

  private cargarParadas(rutaId: string): void {
    if (this.rutaCargadaId?.toLowerCase() === rutaId.toLowerCase()) return;
    this.rutaCargadaId = rutaId;
    this.rutasApi.obtenerParadas(rutaId).subscribe({
      next: (paradas) => this.paradas.set(paradas),
      error: () => undefined, // sin paradas el mapa sigue mostrando el bus
    });
  }

  irABuscar(): void {
    void this.router.navigateByUrl('/pasajero');
  }

  irAMisReservas(): void {
    void this.router.navigateByUrl('/pasajero/reservas');
  }
}
