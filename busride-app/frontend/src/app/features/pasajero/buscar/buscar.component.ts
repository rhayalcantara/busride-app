import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ParadaConUbicacion, RutaDisponible, RutasApi } from '../../../core/api';
import {
  CoordenadaMapa,
  EstadoVacioComponent,
  MapaComponent,
  MarcadorMapa,
  MonedaDopPipe,
} from '../../../shared';
import { extraerMensajeError } from '../../auth/mensaje-error.util';

// Centro por defecto si el usuario deniega la geolocalización: Santo Domingo.
const CENTRO_DEFECTO: CoordenadaMapa = { lat: 18.4861, lng: -69.9312 };

/** Radios de búsqueda permitidos por el backend (50-5000 m, default 500). */
const RADIOS_METROS = [250, 500, 1000, 2000, 5000];

type ModoClic = 'origen' | 'destino';

/**
 * Home del pasajero: buscar rutas disponibles cerca de un origen (mi
 * ubicación por Geolocation, con fallback) y un destino (clic en el mapa),
 * con radio configurable. Resultados de sp_buscar_rutas_disponibles
 * (snake_case) como cards; al seleccionar uno se dibujan las paradas de la
 * ruta y se puede pasar a reservar.
 */
@Component({
  selector: 'app-pasajero-buscar',
  imports: [
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MapaComponent,
    EstadoVacioComponent,
    MonedaDopPipe,
  ],
  template: `
    <section class="buscar">
      <div class="buscar__mapa">
        <app-mapa
          [centro]="centro()"
          [zoom]="14"
          [marcadores]="marcadores()"
          [polyline]="polyline()"
          (clicMapa)="alClicEnMapa($event)"
        />
      </div>

      <div class="buscar__controles">
        @if (avisoUbicacion(); as aviso) {
          <p class="buscar__aviso">
            <mat-icon inline>info</mat-icon>
            {{ aviso }}
          </p>
        }

        <div class="buscar__fila">
          <mat-button-toggle-group
            [(ngModel)]="modoClic"
            aria-label="Qué punto fija el clic en el mapa"
            hideSingleSelectionIndicator
          >
            <mat-button-toggle value="destino">Fijar destino</mat-button-toggle>
            <mat-button-toggle value="origen">Fijar origen</mat-button-toggle>
          </mat-button-toggle-group>

          <button
            mat-stroked-button
            type="button"
            (click)="usarMiUbicacion()"
            [disabled]="buscandoUbicacion()"
          >
            <mat-icon>my_location</mat-icon>
            Mi ubicación
          </button>
        </div>

        <div class="buscar__fila">
          <mat-form-field appearance="outline" class="buscar__radio">
            <mat-label>Radio de búsqueda</mat-label>
            <mat-select [(ngModel)]="radioMetros">
              @for (radio of radios; track radio) {
                <mat-option [value]="radio">{{ radio }} m</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <button
            mat-flat-button
            class="buscar__boton"
            type="button"
            (click)="buscar()"
            [disabled]="!destino() || buscando()"
          >
            @if (buscando()) {
              <mat-progress-spinner diameter="20" mode="indeterminate" />
            } @else {
              <ng-container><mat-icon>search</mat-icon> Buscar rutas</ng-container>
            }
          </button>
        </div>

        @if (!destino()) {
          <p class="buscar__hint">Toca el mapa para fijar tu destino 🔴 y luego pulsa Buscar.</p>
        }
        @if (error(); as mensaje) {
          <p class="buscar__error">{{ mensaje }}</p>
        }
      </div>

      @if (seleccionada(); as ruta) {
        <mat-card class="buscar__detalle">
          <mat-card-header>
            <mat-card-title>{{ ruta.ruta_nombre }}</mat-card-title>
            <mat-card-subtitle>
              {{ ruta.asociacion_nombre }} · Bus {{ ruta.bus_placa }} ·
              {{ ruta.conductor_nombre }}
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p class="buscar__detalle-dato">
              <mat-icon inline>trip_origin</mat-icon>
              Subes en <strong>{{ ruta.parada_origen_nombre }}</strong> (a
              {{ ruta.distancia_origen_metros | number: '1.0-0' }} m)
            </p>
            <p class="buscar__detalle-dato">
              <mat-icon inline>flag</mat-icon>
              Bajas en <strong>{{ ruta.parada_destino_nombre }}</strong> (a
              {{ ruta.distancia_destino_metros | number: '1.0-0' }} m)
            </p>
            <p class="buscar__detalle-dato">
              <mat-icon inline>payments</mat-icon>
              Tarifa: <strong>{{ ruta.tarifa | monedaDop }}</strong> ·
              {{ ruta.asientos_disponibles }} asientos disponibles
            </p>
            @if (cargandoParadas()) {
              <p class="buscar__hint">Cargando paradas de la ruta…</p>
            }
          </mat-card-content>
          <mat-card-actions align="end">
            <button mat-button type="button" (click)="cerrarDetalle()">Volver</button>
            <button mat-flat-button type="button" (click)="irAReservar(ruta)">
              <mat-icon>confirmation_number</mat-icon>
              Reservar
            </button>
          </mat-card-actions>
        </mat-card>
      } @else if (resultados(); as rutas) {
        @if (rutas.length === 0) {
          <app-estado-vacio
            icono="search_off"
            mensaje="No hay rutas con viajes en curso cerca de esos puntos. Prueba con un radio mayor."
          />
        } @else {
          <h2 class="buscar__subtitulo">{{ rutas.length }} ruta(s) disponible(s)</h2>
          <div class="buscar__resultados">
            @for (ruta of rutas; track ruta.viaje_id) {
              <mat-card class="buscar__card" (click)="seleccionar(ruta)">
                <mat-card-header>
                  <mat-card-title>{{ ruta.ruta_nombre }}</mat-card-title>
                  <mat-card-subtitle>{{ ruta.asociacion_nombre }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <p class="buscar__card-tarifa">{{ ruta.tarifa | monedaDop }}</p>
                  <p>
                    <mat-icon inline>airline_seat_recline_normal</mat-icon>
                    {{ ruta.asientos_disponibles }} asientos ·
                    <mat-icon inline>directions_bus</mat-icon>
                    {{ ruta.bus_placa }}
                  </p>
                  <p class="buscar__card-paradas">
                    {{ ruta.parada_origen_nombre }} → {{ ruta.parada_destino_nombre }}
                  </p>
                </mat-card-content>
              </mat-card>
            }
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      .buscar {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 720px;
        margin: 0 auto;
      }
      .buscar__mapa {
        height: 42vh;
        min-height: 300px;
        border-radius: 12px;
        overflow: hidden;
      }
      .buscar__controles {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .buscar__fila {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .buscar__radio {
        flex: 1 1 140px;
      }
      .buscar__boton {
        flex: 1 1 auto;
        height: 48px;
      }
      .buscar__aviso,
      .buscar__hint {
        margin: 0;
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
      .buscar__error {
        margin: 0;
        color: var(--mat-sys-error, #b00020);
      }
      .buscar__subtitulo {
        margin: 4px 0 0;
        font-size: 16px;
        font-weight: 500;
      }
      .buscar__resultados {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }
      @media (min-width: 600px) {
        .buscar__resultados {
          grid-template-columns: 1fr 1fr;
        }
      }
      .buscar__card {
        cursor: pointer;
      }
      .buscar__card-tarifa {
        font-size: 20px;
        font-weight: 600;
        margin: 4px 0;
      }
      .buscar__card-paradas {
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
      .buscar__detalle-dato {
        margin: 4px 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarComponent {
  private readonly rutasApi = inject(RutasApi);
  private readonly router = inject(Router);

  protected readonly radios = RADIOS_METROS;

  // Estado de la búsqueda
  protected readonly origen = signal<CoordenadaMapa>(CENTRO_DEFECTO);
  protected readonly destino = signal<CoordenadaMapa | null>(null);
  protected readonly centro = signal<CoordenadaMapa>(CENTRO_DEFECTO);
  protected modoClic: ModoClic = 'destino';
  protected radioMetros = 500;

  protected readonly buscando = signal(false);
  protected readonly buscandoUbicacion = signal(false);
  protected readonly avisoUbicacion = signal('');
  protected readonly error = signal('');
  protected readonly resultados = signal<RutaDisponible[] | null>(null);

  // Detalle de la ruta seleccionada
  protected readonly seleccionada = signal<RutaDisponible | null>(null);
  protected readonly paradas = signal<ParadaConUbicacion[]>([]);
  protected readonly cargandoParadas = signal(false);

  protected readonly marcadores = computed<MarcadorMapa[]>(() => {
    const lista: MarcadorMapa[] = [
      { id: 'origen', tipo: 'origen', ...this.origen(), tooltip: 'Origen' },
    ];
    const destino = this.destino();
    if (destino) {
      lista.push({ id: 'destino', tipo: 'destino', ...destino, tooltip: 'Destino' });
    }
    for (const parada of this.paradas()) {
      lista.push({
        id: `parada-${parada.id}`,
        tipo: 'parada',
        lat: parada.lat,
        lng: parada.lng,
        tooltip: `${parada.orden}. ${parada.nombre}`,
      });
    }
    const ruta = this.seleccionada();
    if (ruta && ruta.bus_lat !== null && ruta.bus_lng !== null) {
      lista.push({
        id: 'bus',
        tipo: 'bus',
        lat: ruta.bus_lat,
        lng: ruta.bus_lng,
        tooltip: `Bus ${ruta.bus_placa}`,
      });
    }
    return lista;
  });

  /** Polilínea de la ruta seleccionada: sus paradas en orden. */
  protected readonly polyline = computed<CoordenadaMapa[]>(() =>
    [...this.paradas()]
      .sort((a, b) => a.orden - b.orden)
      .map((p) => ({ lat: p.lat, lng: p.lng })),
  );

  constructor() {
    this.usarMiUbicacion();
  }

  /** Geolocation API con fallback al centro por defecto si se deniega. */
  usarMiUbicacion(): void {
    if (!('geolocation' in navigator)) {
      this.avisoUbicacion.set('Tu navegador no soporta geolocalización; origen en Santo Domingo.');
      return;
    }
    this.buscandoUbicacion.set(true);
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        const coordenada: CoordenadaMapa = {
          lat: posicion.coords.latitude,
          lng: posicion.coords.longitude,
        };
        this.origen.set(coordenada);
        this.centro.set(coordenada);
        this.avisoUbicacion.set('');
        this.buscandoUbicacion.set(false);
      },
      () => {
        this.avisoUbicacion.set(
          'No pudimos obtener tu ubicación: usa "Fijar origen" y toca el mapa.',
        );
        this.buscandoUbicacion.set(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  alClicEnMapa(coordenada: CoordenadaMapa): void {
    if (this.modoClic === 'origen') {
      this.origen.set(coordenada);
    } else {
      this.destino.set(coordenada);
    }
  }

  buscar(): void {
    const destino = this.destino();
    if (!destino || this.buscando()) return;
    const origen = this.origen();

    this.buscando.set(true);
    this.error.set('');
    this.cerrarDetalle();

    this.rutasApi
      .buscar({
        latOrigen: origen.lat,
        lngOrigen: origen.lng,
        latDestino: destino.lat,
        lngDestino: destino.lng,
        radioMetros: this.radioMetros,
      })
      .subscribe({
        next: (rutas) => {
          this.resultados.set(rutas);
          this.buscando.set(false);
        },
        error: (err: unknown) => {
          this.error.set(extraerMensajeError(err, 'No se pudo realizar la búsqueda'));
          this.buscando.set(false);
        },
      });
  }

  /** Selecciona un resultado y dibuja sus paradas (GET /rutas/:id/paradas). */
  seleccionar(ruta: RutaDisponible): void {
    this.seleccionada.set(ruta);
    this.paradas.set([]);
    this.cargandoParadas.set(true);
    this.rutasApi.obtenerParadas(ruta.ruta_id).subscribe({
      next: (paradas) => {
        this.paradas.set(paradas);
        this.cargandoParadas.set(false);
        if (paradas.length > 0) {
          this.centro.set({ lat: paradas[0].lat, lng: paradas[0].lng });
        }
      },
      error: (err: unknown) => {
        this.cargandoParadas.set(false);
        this.error.set(extraerMensajeError(err, 'No se pudieron cargar las paradas de la ruta'));
      },
    });
  }

  cerrarDetalle(): void {
    this.seleccionada.set(null);
    this.paradas.set([]);
  }

  /** Pasa a la página de reserva con el contexto del viaje elegido. */
  irAReservar(ruta: RutaDisponible): void {
    const origen = this.origen();
    void this.router.navigate(['/pasajero/reservar'], {
      queryParams: {
        viajeId: ruta.viaje_id,
        rutaId: ruta.ruta_id,
        rutaNombre: ruta.ruta_nombre,
        origenId: ruta.parada_origen_id,
        destinoId: ruta.parada_destino_id,
        lat: origen.lat,
        lng: origen.lng,
      },
    });
  }
}
