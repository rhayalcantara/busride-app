import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';

/** Punto geográfico simple usado por el mapa. */
export interface CoordenadaMapa {
  lat: number;
  lng: number;
}

export type TipoMarcador = 'bus' | 'parada' | 'origen' | 'destino';

/** Marcador tipado del mapa; el `id` permite actualizarlo sin recrearlo. */
export interface MarcadorMapa extends CoordenadaMapa {
  id: string;
  tipo: TipoMarcador;
  tooltip?: string;
}

// Iconos divIcon (sin imágenes): los PNG por defecto de Leaflet no resuelven
// bien sus rutas con el bundler de Angular.
const EMOJI_POR_TIPO: Record<TipoMarcador, string> = {
  bus: '🚌',
  parada: '🚏',
  origen: '🟢',
  destino: '🔴',
};

function crearIcono(tipo: TipoMarcador): L.DivIcon {
  return L.divIcon({
    className: `mapa-marcador mapa-marcador--${tipo}`,
    html: `<span style="font-size:24px;line-height:1;">${EMOJI_POR_TIPO[tipo]}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 26],
    tooltipAnchor: [0, -24],
  });
}

interface MarcadorRegistrado {
  marcador: L.Marker;
  tipo: TipoMarcador;
  tooltip?: string;
}

// Centro por defecto: Santo Domingo, RD.
const CENTRO_DEFECTO: CoordenadaMapa = { lat: 18.4861, lng: -69.9312 };

/**
 * Wrapper reutilizable de Leaflet con tiles de OpenStreetMap.
 *
 * Todos los inputs son reactivos: los effects actualizan el mapa existente
 * (diff de marcadores por `id`, `setLatLngs` de la polilínea, `setView`)
 * sin recrearlo. El mapa vive fuera de la zona de Angular; solo el output
 * `clicMapa` reentra a la zona.
 *
 * El host ocupa el 100% de la altura del contenedor (mínimo 300px):
 * el padre debe darle una altura.
 */
@Component({
  selector: 'app-mapa',
  standalone: true,
  template: `<div #contenedor class="mapa-contenedor"></div>`,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 300px;
      }
      .mapa-contenedor {
        height: 100%;
        width: 100%;
        min-height: inherit;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaComponent {
  /** Centro del mapa (por defecto, Santo Domingo). */
  readonly centro = input<CoordenadaMapa>(CENTRO_DEFECTO);
  readonly zoom = input(13);
  readonly marcadores = input<MarcadorMapa[]>([]);
  /** Puntos de la polilínea de la ruta (vacío = sin polilínea). */
  readonly polyline = input<CoordenadaMapa[]>([]);

  /** Clic del usuario sobre el mapa. */
  readonly clicMapa = output<CoordenadaMapa>();

  private readonly contenedor = viewChild.required<ElementRef<HTMLDivElement>>('contenedor');
  private readonly zone = inject(NgZone);

  private mapa: L.Map | null = null;
  private capaPolyline: L.Polyline | null = null;
  private readonly marcadoresEnMapa = new Map<string, MarcadorRegistrado>();
  private observadorTamano: ResizeObserver | null = null;

  /** Pasa a true cuando Leaflet ya inicializó; dispara los effects. */
  private readonly mapaListo = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Inicialización tras el primer render (el contenedor ya tiene tamaño
    // y nunca corre en servidor).
    afterNextRender(() => this.iniciarMapa());

    effect(() => {
      const centro = this.centro();
      const zoom = this.zoom();
      if (this.mapaListo() && this.mapa) {
        this.zone.runOutsideAngular(() => this.mapa!.setView([centro.lat, centro.lng], zoom));
      }
    });

    effect(() => {
      const marcadores = this.marcadores();
      if (this.mapaListo() && this.mapa) {
        this.zone.runOutsideAngular(() => this.sincronizarMarcadores(marcadores));
      }
    });

    effect(() => {
      const puntos = this.polyline();
      if (this.mapaListo() && this.mapa) {
        this.zone.runOutsideAngular(() => this.sincronizarPolyline(puntos));
      }
    });

    destroyRef.onDestroy(() => {
      this.observadorTamano?.disconnect();
      this.observadorTamano = null;
      this.marcadoresEnMapa.clear();
      this.capaPolyline = null;
      this.mapa?.remove();
      this.mapa = null;
    });
  }

  private iniciarMapa(): void {
    const elemento = this.contenedor().nativeElement;
    const centro = this.centro();

    this.zone.runOutsideAngular(() => {
      this.mapa = L.map(elemento, {
        center: [centro.lat, centro.lng],
        zoom: this.zoom(),
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(this.mapa);

      this.mapa.on('click', (evento: L.LeafletMouseEvent) => {
        this.zone.run(() =>
          this.clicMapa.emit({ lat: evento.latlng.lat, lng: evento.latlng.lng }),
        );
      });

      // El contenedor puede cambiar de tamaño (sidenav, redimensionado):
      // recalcular el viewport de Leaflet.
      this.observadorTamano = new ResizeObserver(() => this.mapa?.invalidateSize());
      this.observadorTamano.observe(elemento);

      // Por si el layout terminó de asentarse después del primer render.
      setTimeout(() => this.mapa?.invalidateSize(), 0);
    });

    // Dentro de la zona: re-ejecuta los effects para aplicar el estado actual
    // de marcadores y polilínea sobre el mapa recién creado.
    this.mapaListo.set(true);
  }

  /** Diff por id: agrega, mueve o elimina marcadores sin recrear el mapa. */
  private sincronizarMarcadores(marcadores: MarcadorMapa[]): void {
    if (!this.mapa) {
      return;
    }

    const idsVigentes = new Set(marcadores.map((m) => m.id));
    for (const [id, registrado] of this.marcadoresEnMapa) {
      if (!idsVigentes.has(id)) {
        registrado.marcador.remove();
        this.marcadoresEnMapa.delete(id);
      }
    }

    for (const dato of marcadores) {
      const existente = this.marcadoresEnMapa.get(dato.id);
      if (existente) {
        existente.marcador.setLatLng([dato.lat, dato.lng]);
        if (existente.tipo !== dato.tipo) {
          existente.marcador.setIcon(crearIcono(dato.tipo));
          existente.tipo = dato.tipo;
        }
        if (existente.tooltip !== dato.tooltip) {
          existente.marcador.unbindTooltip();
          if (dato.tooltip) {
            existente.marcador.bindTooltip(dato.tooltip);
          }
          existente.tooltip = dato.tooltip;
        }
      } else {
        const marcador = L.marker([dato.lat, dato.lng], { icon: crearIcono(dato.tipo) });
        if (dato.tooltip) {
          marcador.bindTooltip(dato.tooltip);
        }
        marcador.addTo(this.mapa);
        this.marcadoresEnMapa.set(dato.id, {
          marcador,
          tipo: dato.tipo,
          tooltip: dato.tooltip,
        });
      }
    }
  }

  private sincronizarPolyline(puntos: CoordenadaMapa[]): void {
    if (!this.mapa) {
      return;
    }

    const latLngs = puntos.map((p) => [p.lat, p.lng] as L.LatLngTuple);

    if (latLngs.length < 2) {
      this.capaPolyline?.remove();
      this.capaPolyline = null;
      return;
    }

    if (this.capaPolyline) {
      this.capaPolyline.setLatLngs(latLngs);
    } else {
      this.capaPolyline = L.polyline(latLngs, { color: '#1976d2', weight: 4 }).addTo(this.mapa);
    }
  }
}
