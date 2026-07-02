import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { CrearRutaDto, ParadaRutaDto, RutasApi } from '../../../../core/api';
import { CoordenadaMapa, extraerMensajeError, MapaComponent, MarcadorMapa } from '../../../../shared';
import { AsociacionContextoService } from '../../asociacion-contexto.service';
import { SelectorAsociacionComponent } from '../../selector-asociacion.component';

/** Parada en edición (el orden lo da la posición en el arreglo). */
interface ParadaEnEdicion {
  nombre: string;
  lat: number;
  lng: number;
  esTerminal: boolean;
}

/**
 * Crear ruta (admin y asociación) sobre el mapa: cada clic añade una parada
 * EN ORDEN; la lista permite renombrar, marcar terminal, reordenar y quitar.
 * La polilínea de previsualización une las paradas y, opcionalmente, se envía
 * como LINESTRING WKT (orden `lng lat`, el que espera la columna geography de
 * SQL Server). Espeja CrearRutaDto: mínimo 2 paradas, tarifa ≥ 0; el
 * asociacionId solo lo envía el admin (rol asociacion se deriva del JWT).
 */
@Component({
  selector: 'app-crear-ruta-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MapaComponent,
    SelectorAsociacionComponent,
  ],
  template: `
    <header class="pagina-encabezado">
      <h2>Nueva ruta</h2>
      <a mat-stroked-button routerLink="/panel/rutas">
        <mat-icon>arrow_back</mat-icon>
        Volver al listado
      </a>
    </header>

    <app-selector-asociacion />

    <div class="crear-ruta">
      <!-- ───────── Columna del formulario ───────── -->
      <section class="crear-ruta__form">
        <form [formGroup]="formulario" novalidate>
          <mat-form-field appearance="outline" class="campo-completo">
            <mat-label>Nombre de la ruta</mat-label>
            <input matInput formControlName="nombre" maxlength="200" />
            @if (formulario.controls.nombre.hasError('required')) {
              <mat-error>El nombre es obligatorio</mat-error>
            }
          </mat-form-field>

          <div class="fila-doble">
            <mat-form-field appearance="outline">
              <mat-label>Código (opcional)</mat-label>
              <input matInput formControlName="codigo" maxlength="20" placeholder="R-01" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Tarifa (RD$)</mat-label>
              <input matInput type="number" formControlName="tarifa" min="0" step="5" />
              @if (
                formulario.controls.tarifa.hasError('required') ||
                formulario.controls.tarifa.hasError('min')
              ) {
                <mat-error>Tarifa ≥ 0 obligatoria</mat-error>
              }
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="campo-completo">
            <mat-label>Descripción (opcional)</mat-label>
            <textarea matInput formControlName="descripcion" maxlength="500" rows="2"></textarea>
          </mat-form-field>

          <mat-checkbox [checked]="incluirPolyline()" (change)="incluirPolyline.set($event.checked)">
            Enviar polilínea (LINESTRING) uniendo las paradas
          </mat-checkbox>
        </form>

        <h3 class="paradas-titulo">
          Paradas ({{ paradas().length }}) — clic en el mapa para añadir
        </h3>
        @if (paradas().length < 2) {
          <p class="aviso">Añade al menos 2 paradas haciendo clic sobre el mapa, en orden.</p>
        }

        <ol class="lista-paradas">
          @for (parada of paradas(); track $index) {
            <li class="parada">
              <span class="parada__orden">{{ $index + 1 }}</span>
              <mat-form-field appearance="outline" class="parada__nombre" subscriptSizing="dynamic">
                <mat-label>Nombre</mat-label>
                <input
                  matInput
                  [value]="parada.nombre"
                  maxlength="200"
                  (change)="renombrarParada($index, $event)"
                />
              </mat-form-field>
              <mat-checkbox
                [checked]="parada.esTerminal"
                (change)="marcarTerminal($index, $event.checked)"
              >
                Terminal
              </mat-checkbox>
              <span class="parada__coords">
                {{ parada.lat.toFixed(5) }}, {{ parada.lng.toFixed(5) }}
              </span>
              <span class="parada__acciones">
                <button
                  mat-icon-button
                  type="button"
                  title="Subir"
                  aria-label="Subir parada"
                  [disabled]="$index === 0"
                  (click)="moverParada($index, -1)"
                >
                  <mat-icon>arrow_upward</mat-icon>
                </button>
                <button
                  mat-icon-button
                  type="button"
                  title="Bajar"
                  aria-label="Bajar parada"
                  [disabled]="$index === paradas().length - 1"
                  (click)="moverParada($index, 1)"
                >
                  <mat-icon>arrow_downward</mat-icon>
                </button>
                <button
                  mat-icon-button
                  type="button"
                  title="Quitar"
                  aria-label="Quitar parada"
                  (click)="quitarParada($index)"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </span>
            </li>
          }
        </ol>

        @if (errorBackend(); as mensaje) {
          <p class="error-envio" role="alert">{{ mensaje }}</p>
        }

        <button
          mat-flat-button
          class="boton-crear"
          type="button"
          [disabled]="cargando()"
          (click)="crear()"
        >
          @if (cargando()) {
            <mat-spinner diameter="20" />
          } @else {
            Crear ruta
          }
        </button>
      </section>

      <!-- ───────── Columna del mapa ───────── -->
      <section class="crear-ruta__mapa">
        <app-mapa
          [marcadores]="marcadores()"
          [polyline]="puntosPolyline()"
          (clicMapa)="agregarParada($event)"
        />
      </section>
    </div>
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
      .crear-ruta {
        display: grid;
        grid-template-columns: minmax(320px, 480px) 1fr;
        gap: 16px;
        align-items: start;
      }
      @media (max-width: 900px) {
        .crear-ruta {
          grid-template-columns: 1fr;
        }
      }
      .crear-ruta__form form {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .campo-completo {
        width: 100%;
      }
      .fila-doble {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .fila-doble mat-form-field {
        flex: 1 1 140px;
      }
      .crear-ruta__mapa {
        height: 560px;
        min-height: 400px;
      }
      .paradas-titulo {
        margin: 16px 0 4px;
      }
      .aviso {
        margin: 4px 0;
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
      .lista-paradas {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .parada {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 8px;
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 8px;
      }
      .parada__orden {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--mat-sys-primary, #1976d2);
        color: #fff;
        font-size: 13px;
        flex-shrink: 0;
      }
      .parada__nombre {
        flex: 1 1 160px;
      }
      .parada__coords {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
        white-space: nowrap;
      }
      .parada__acciones {
        display: inline-flex;
      }
      .error-envio {
        color: var(--mat-sys-error, #b3261e);
        font-size: 14px;
        margin: 12px 0 0;
      }
      .boton-crear {
        margin-top: 16px;
        width: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrearRutaPageComponent {
  private readonly rutasApi = inject(RutasApi);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly contexto = inject(AsociacionContextoService);

  protected readonly paradas = signal<ParadaEnEdicion[]>([]);
  protected readonly incluirPolyline = signal(false);
  protected readonly cargando = signal(false);
  protected readonly errorBackend = signal<string | null>(null);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    nombre: ['', Validators.required],
    codigo: [''],
    descripcion: [''],
    tarifa: [50, [Validators.required, Validators.min(0)]],
  });

  protected readonly marcadores = computed<MarcadorMapa[]>(() =>
    this.paradas().map((parada, indice) => ({
      id: `parada-${indice}`,
      lat: parada.lat,
      lng: parada.lng,
      tipo: 'parada',
      tooltip: `${indice + 1}. ${parada.nombre}${parada.esTerminal ? ' (terminal)' : ''}`,
    })),
  );

  protected readonly puntosPolyline = computed<CoordenadaMapa[]>(() =>
    this.paradas().map(({ lat, lng }) => ({ lat, lng })),
  );

  agregarParada(coordenada: CoordenadaMapa): void {
    this.paradas.update((lista) => [
      ...lista,
      {
        nombre: `Parada ${lista.length + 1}`,
        lat: coordenada.lat,
        lng: coordenada.lng,
        // Por comodidad, la primera parada nace como terminal de origen
        esTerminal: lista.length === 0,
      },
    ]);
  }

  renombrarParada(indice: number, evento: Event): void {
    const nombre = (evento.target as HTMLInputElement).value.trim();
    this.paradas.update((lista) =>
      lista.map((parada, i) => (i === indice ? { ...parada, nombre } : parada)),
    );
  }

  marcarTerminal(indice: number, esTerminal: boolean): void {
    this.paradas.update((lista) =>
      lista.map((parada, i) => (i === indice ? { ...parada, esTerminal } : parada)),
    );
  }

  moverParada(indice: number, delta: -1 | 1): void {
    this.paradas.update((lista) => {
      const destino = indice + delta;
      if (destino < 0 || destino >= lista.length) return lista;
      const copia = [...lista];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  }

  quitarParada(indice: number): void {
    this.paradas.update((lista) => lista.filter((_, i) => i !== indice));
  }

  crear(): void {
    this.errorBackend.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const paradas = this.paradas();
    if (paradas.length < 2) {
      this.errorBackend.set('La ruta necesita al menos 2 paradas: haz clic en el mapa para añadirlas.');
      return;
    }
    if (paradas.some((p) => !p.nombre.trim())) {
      this.errorBackend.set('Todas las paradas deben tener nombre.');
      return;
    }
    const esAdmin = this.contexto.esAdmin();
    const asociacionId = this.contexto.seleccionadaId();
    if (esAdmin && !asociacionId) {
      this.errorBackend.set('Selecciona la asociación dueña de la ruta.');
      return;
    }
    if (this.cargando()) return;

    const valores = this.formulario.getRawValue();
    const paradasDto: ParadaRutaDto[] = paradas.map((parada, indice) => ({
      nombre: parada.nombre.trim(),
      orden: indice + 1,
      lat: parada.lat,
      lng: parada.lng,
      esTerminal: parada.esTerminal,
    }));

    const dto: CrearRutaDto = {
      nombre: valores.nombre.trim(),
      tarifa: valores.tarifa,
      paradas: paradasDto,
      ...(valores.codigo.trim() ? { codigo: valores.codigo.trim() } : {}),
      ...(valores.descripcion.trim() ? { descripcion: valores.descripcion.trim() } : {}),
      // El rol asociacion NO envía asociacionId: el backend lo deriva del JWT
      ...(esAdmin && asociacionId ? { asociacionId } : {}),
      ...(this.incluirPolyline() ? { polylineWkt: this.construirLinestring(paradas) } : {}),
    };

    this.cargando.set(true);
    this.rutasApi.crear(dto).subscribe({
      next: (ruta) => {
        this.snackBar.open(`Ruta «${ruta.nombre}» creada con ${paradasDto.length} paradas`, 'OK', {
          duration: 4000,
        });
        void this.router.navigateByUrl('/panel/rutas');
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.errorBackend.set(extraerMensajeError(error, 'No se pudo crear la ruta'));
      },
    });
  }

  /** WKT geography de SQL Server: puntos en orden `lng lat` (x y). */
  private construirLinestring(paradas: ParadaEnEdicion[]): string {
    const puntos = paradas.map((p) => `${p.lng} ${p.lat}`).join(', ');
    return `LINESTRING(${puntos})`;
  }
}
