import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import {
  AsignacionBusRuta,
  Bus,
  ConductorDeAsociacion,
  ConductoresApi,
  FlotaApi,
  Horario,
  Ruta,
  RutasApi,
} from '../../../../core/api';
import {
  CeldaTablaDirective,
  ColumnaTabla,
  ConfirmDialogComponent,
  EstadoVacioComponent,
  FechaCortaPipe,
  TablaPaginadaComponent,
} from '../../../../shared';
import { AsociacionContextoService } from '../../asociacion-contexto.service';
import { extraerMensajeError } from '../../mensaje-error.util';
import { SelectorAsociacionComponent } from '../../selector-asociacion.component';
import { AsignacionDialogComponent } from './asignacion-dialog.component';
import { BusDialogComponent } from './bus-dialog.component';
import { HorarioDialogComponent } from './horario-dialog.component';

/**
 * Flota (admin y asociación), en tres pestañas sobre la asociación
 * seleccionada:
 *  1. Buses: listado + crear + editar (PATCH con activo).
 *  2. Horarios: por ruta (selector) + crear.
 *  3. Asignaciones bus-ruta-conductor: por conductor (selector) + crear +
 *     desactivar. Los 409 del backend (solapamientos/duplicados) se muestran
 *     con su `mensaje` dentro de los diálogos.
 */
@Component({
  selector: 'app-flota-page',
  imports: [
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    TablaPaginadaComponent,
    CeldaTablaDirective,
    EstadoVacioComponent,
    FechaCortaPipe,
    SelectorAsociacionComponent,
  ],
  template: `
    <header class="pagina-encabezado">
      <h2>Flota</h2>
    </header>

    <app-selector-asociacion />

    @if (cargando()) {
      <mat-progress-bar mode="indeterminate" />
    }

    @if (!contexto.seleccionada() && !contexto.cargando()) {
      <app-estado-vacio mensaje="Selecciona una asociación para gestionar su flota." />
    } @else {
      <mat-tab-group>
        <!-- ─────────────── Buses ─────────────── -->
        <mat-tab label="Buses">
          <div class="tab-contenido">
            <div class="tab-acciones">
              <button mat-flat-button type="button" (click)="abrirCrearBus()">
                <mat-icon>add</mat-icon>
                Registrar bus
              </button>
            </div>

            @if (buses().length === 0 && !cargando()) {
              <app-estado-vacio mensaje="Esta asociación no tiene buses registrados." />
            } @else if (buses().length > 0) {
              <app-tabla-paginada [columnas]="columnasBuses" [datos]="buses()">
                <ng-template appCeldaTabla="activo" let-fila>
                  <span class="chip" [class.chip--ok]="fila.activo" [class.chip--off]="!fila.activo">
                    {{ fila.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </ng-template>
                <ng-template appCeldaTabla="acciones" let-fila>
                  <button
                    mat-icon-button
                    type="button"
                    title="Editar bus"
                    aria-label="Editar bus"
                    (click)="abrirEditarBus(fila)"
                  >
                    <mat-icon>edit</mat-icon>
                  </button>
                </ng-template>
              </app-tabla-paginada>
            }
          </div>
        </mat-tab>

        <!-- ─────────────── Horarios ─────────────── -->
        <mat-tab label="Horarios">
          <div class="tab-contenido">
            <div class="tab-acciones">
              <mat-form-field appearance="outline" class="campo-selector">
                <mat-label>Ruta</mat-label>
                <mat-select
                  [value]="rutaHorariosId()"
                  (selectionChange)="seleccionarRutaHorarios($event.value)"
                >
                  @for (ruta of rutas(); track ruta.id) {
                    <mat-option [value]="ruta.id">
                      {{ ruta.nombre }}@if (ruta.codigo) { ({{ ruta.codigo }}) }
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <button
                mat-flat-button
                type="button"
                [disabled]="!rutaHorariosId()"
                (click)="abrirCrearHorario()"
              >
                <mat-icon>add</mat-icon>
                Crear horario
              </button>
            </div>

            @if (rutas().length === 0 && !cargando()) {
              <app-estado-vacio
                mensaje="Esta asociación no tiene rutas: crea una en la página «Rutas» para definir horarios."
              />
            } @else if (!rutaHorariosId()) {
              <app-estado-vacio mensaje="Selecciona una ruta para ver sus horarios." />
            } @else if (horarios().length === 0 && !cargandoHorarios()) {
              <app-estado-vacio mensaje="La ruta no tiene horarios definidos." />
            } @else if (horarios().length > 0) {
              <app-tabla-paginada [columnas]="columnasHorarios" [datos]="horarios()" />
            }
          </div>
        </mat-tab>

        <!-- ─────────────── Asignaciones ─────────────── -->
        <mat-tab label="Asignaciones">
          <div class="tab-contenido">
            <div class="tab-acciones">
              <mat-form-field appearance="outline" class="campo-selector">
                <mat-label>Conductor</mat-label>
                <mat-select
                  [value]="conductorAsignacionesId()"
                  (selectionChange)="seleccionarConductorAsignaciones($event.value)"
                >
                  @for (conductor of conductores(); track conductor.id) {
                    <mat-option [value]="conductor.id">
                      {{ nombreConductor(conductor) }}
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <button mat-flat-button type="button" (click)="abrirCrearAsignacion()">
                <mat-icon>add_link</mat-icon>
                Crear asignación
              </button>
            </div>

            @if (conductores().length === 0 && !cargando()) {
              <app-estado-vacio
                mensaje="Esta asociación no tiene conductores: regístralos en la página «Conductores»."
              />
            } @else if (!conductorAsignacionesId()) {
              <app-estado-vacio
                mensaje="Selecciona un conductor para ver sus asignaciones bus-ruta."
              />
            } @else if (asignaciones().length === 0 && !cargandoAsignaciones()) {
              <app-estado-vacio mensaje="El conductor no tiene asignaciones." />
            } @else if (asignaciones().length > 0) {
              <app-tabla-paginada [columnas]="columnasAsignaciones" [datos]="asignaciones()">
                <ng-template appCeldaTabla="fechaInicio" let-fila>
                  {{ fila.fechaInicio | fechaCorta: false }}
                </ng-template>
                <ng-template appCeldaTabla="fechaFin" let-fila>
                  {{ fila.fechaFin ? (fila.fechaFin | fechaCorta: false) : 'Indefinida' }}
                </ng-template>
                <ng-template appCeldaTabla="activa" let-fila>
                  <span class="chip" [class.chip--ok]="fila.activa" [class.chip--off]="!fila.activa">
                    {{ fila.activa ? 'Activa' : 'Inactiva' }}
                  </span>
                </ng-template>
                <ng-template appCeldaTabla="acciones" let-fila>
                  @if (fila.activa) {
                    <button
                      mat-icon-button
                      type="button"
                      title="Desactivar asignación"
                      aria-label="Desactivar asignación"
                      (click)="desactivarAsignacion(fila)"
                    >
                      <mat-icon>link_off</mat-icon>
                    </button>
                  }
                </ng-template>
              </app-tabla-paginada>
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    }
  `,
  styles: [
    `
      .pagina-encabezado {
        margin-bottom: 12px;
      }
      .pagina-encabezado h2 {
        margin: 0;
      }
      .tab-contenido {
        padding: 16px 0;
      }
      .tab-acciones {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
      .campo-selector {
        min-width: 240px;
      }
      .chip {
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 12px;
        white-space: nowrap;
      }
      .chip--ok {
        background: #e6f4ea;
        color: #1e7d32;
      }
      .chip--off {
        background: #fdecea;
        color: #b3261e;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlotaPageComponent {
  private readonly flotaApi = inject(FlotaApi);
  private readonly rutasApi = inject(RutasApi);
  private readonly conductoresApi = inject(ConductoresApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly contexto = inject(AsociacionContextoService);

  protected readonly buses = signal<Bus[]>([]);
  protected readonly rutas = signal<Ruta[]>([]);
  protected readonly conductores = signal<ConductorDeAsociacion[]>([]);
  protected readonly horarios = signal<Horario[]>([]);
  protected readonly asignaciones = signal<AsignacionBusRuta[]>([]);

  protected readonly rutaHorariosId = signal<string | null>(null);
  protected readonly conductorAsignacionesId = signal<string | null>(null);

  protected readonly cargando = signal(false);
  protected readonly cargandoHorarios = signal(false);
  protected readonly cargandoAsignaciones = signal(false);

  protected readonly columnasBuses: ColumnaTabla<Bus>[] = [
    { clave: 'placa', encabezado: 'Placa' },
    { clave: 'marca', encabezado: 'Marca' },
    { clave: 'modelo', encabezado: 'Modelo' },
    { clave: 'anno', encabezado: 'Año' },
    { clave: 'capacidadTotal', encabezado: 'Capacidad' },
    { clave: 'activo', encabezado: 'Estado' },
    { clave: 'acciones', encabezado: 'Acciones' },
  ];

  protected readonly columnasHorarios: ColumnaTabla<Horario>[] = [
    { clave: 'diasSemana', encabezado: 'Días (LMXJVSD)' },
    { clave: 'horaInicio', encabezado: 'Inicio' },
    { clave: 'horaFin', encabezado: 'Fin' },
    { clave: 'frecuenciaMin', encabezado: 'Frecuencia (min)', valor: (h) => `${h.frecuenciaMin}` },
  ];

  protected readonly columnasAsignaciones: ColumnaTabla<AsignacionBusRuta>[] = [
    { clave: 'bus', encabezado: 'Bus', valor: (a) => a.bus?.placa ?? a.busId },
    { clave: 'ruta', encabezado: 'Ruta', valor: (a) => a.ruta?.nombre ?? a.rutaId },
    { clave: 'fechaInicio', encabezado: 'Desde' },
    { clave: 'fechaFin', encabezado: 'Hasta' },
    { clave: 'activa', encabezado: 'Estado' },
    { clave: 'acciones', encabezado: 'Acciones' },
  ];

  constructor() {
    effect(() => {
      const asociacionId = this.contexto.seleccionadaId();
      // Al cambiar de asociación se recargan las bases y se limpian los detalles
      this.rutaHorariosId.set(null);
      this.conductorAsignacionesId.set(null);
      this.horarios.set([]);
      this.asignaciones.set([]);
      if (asociacionId) {
        this.cargarBase(asociacionId);
      } else {
        this.buses.set([]);
        this.rutas.set([]);
        this.conductores.set([]);
      }
    });
  }

  protected nombreConductor(conductor: ConductorDeAsociacion): string {
    const nombre = `${conductor.nombre ?? ''} ${conductor.apellido ?? ''}`.trim();
    return nombre || conductor.email || conductor.licenciaNumero;
  }

  private cargarBase(asociacionId: string): void {
    this.cargando.set(true);
    let pendientes = 3;
    const finalizar = () => {
      pendientes -= 1;
      if (pendientes === 0) this.cargando.set(false);
    };
    const errorSnack = (recurso: string) => (error: unknown) => {
      this.snackBar.open(extraerMensajeError(error, `No se pudieron cargar ${recurso}`), 'OK', {
        duration: 5000,
      });
      finalizar();
    };

    this.flotaApi.listarBusesPorAsociacion(asociacionId).subscribe({
      next: (lista) => {
        this.buses.set(lista);
        finalizar();
      },
      error: errorSnack('los buses'),
    });
    this.rutasApi.listarPorAsociacion(asociacionId).subscribe({
      next: (lista) => {
        this.rutas.set(lista);
        finalizar();
      },
      error: errorSnack('las rutas'),
    });
    this.conductoresApi.listarPorAsociacion(asociacionId).subscribe({
      next: (lista) => {
        this.conductores.set(lista);
        finalizar();
      },
      error: errorSnack('los conductores'),
    });
  }

  // ─────────────── Buses ───────────────

  abrirCrearBus(): void {
    const asociacionId = this.contexto.seleccionadaId();
    if (!asociacionId) return;
    this.dialog
      .open(BusDialogComponent, { data: { asociacionId }, width: '460px', autoFocus: false })
      .afterClosed()
      .subscribe((bus?: Bus) => {
        if (bus) {
          this.snackBar.open(`Bus ${bus.placa} registrado`, 'OK', { duration: 4000 });
          this.recargarBuses();
        }
      });
  }

  abrirEditarBus(bus: Bus): void {
    const asociacionId = this.contexto.seleccionadaId();
    if (!asociacionId) return;
    this.dialog
      .open(BusDialogComponent, { data: { asociacionId, bus }, width: '460px', autoFocus: false })
      .afterClosed()
      .subscribe((actualizado?: Bus) => {
        if (actualizado) {
          this.snackBar.open(`Bus ${actualizado.placa} actualizado`, 'OK', { duration: 4000 });
          this.recargarBuses();
        }
      });
  }

  private recargarBuses(): void {
    const asociacionId = this.contexto.seleccionadaId();
    if (!asociacionId) return;
    this.flotaApi.listarBusesPorAsociacion(asociacionId).subscribe({
      next: (lista) => this.buses.set(lista),
      error: () => undefined, // el interceptor global ya avisa de 5xx
    });
  }

  // ─────────────── Horarios ───────────────

  seleccionarRutaHorarios(rutaId: string): void {
    this.rutaHorariosId.set(rutaId);
    this.cargarHorarios(rutaId);
  }

  private cargarHorarios(rutaId: string): void {
    this.cargandoHorarios.set(true);
    this.flotaApi.listarHorariosPorRuta(rutaId).subscribe({
      next: (lista) => {
        this.horarios.set(lista);
        this.cargandoHorarios.set(false);
      },
      error: (error: unknown) => {
        this.cargandoHorarios.set(false);
        this.snackBar.open(extraerMensajeError(error, 'No se pudieron cargar los horarios'), 'OK', {
          duration: 5000,
        });
      },
    });
  }

  abrirCrearHorario(): void {
    const rutaId = this.rutaHorariosId();
    if (!rutaId) return;
    const ruta = this.rutas().find((r) => r.id === rutaId);
    this.dialog
      .open(HorarioDialogComponent, {
        data: { rutaId, rutaNombre: ruta?.nombre ?? rutaId },
        width: '480px',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((horario?: Horario) => {
        if (horario) {
          this.snackBar.open('Horario creado', 'OK', { duration: 4000 });
          this.cargarHorarios(rutaId);
        }
      });
  }

  // ─────────────── Asignaciones ───────────────

  seleccionarConductorAsignaciones(conductorId: string): void {
    this.conductorAsignacionesId.set(conductorId);
    this.cargarAsignaciones(conductorId);
  }

  private cargarAsignaciones(conductorId: string): void {
    this.cargandoAsignaciones.set(true);
    this.flotaApi.listarAsignacionesPorConductor(conductorId).subscribe({
      next: (lista) => {
        this.asignaciones.set(lista);
        this.cargandoAsignaciones.set(false);
      },
      error: (error: unknown) => {
        this.cargandoAsignaciones.set(false);
        this.snackBar.open(
          extraerMensajeError(error, 'No se pudieron cargar las asignaciones'),
          'OK',
          { duration: 5000 },
        );
      },
    });
  }

  abrirCrearAsignacion(): void {
    this.dialog
      .open(AsignacionDialogComponent, {
        data: {
          buses: this.buses().filter((b) => b.activo),
          rutas: this.rutas(),
          conductores: this.conductores().filter((c) => c.activo),
        },
        width: '480px',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((asignacion?: AsignacionBusRuta) => {
        if (asignacion) {
          this.snackBar.open('Asignación creada', 'OK', { duration: 4000 });
          // Mostrar el detalle del conductor recién asignado
          this.conductorAsignacionesId.set(asignacion.conductorId);
          this.cargarAsignaciones(asignacion.conductorId);
        }
      });
  }

  desactivarAsignacion(asignacion: AsignacionBusRuta): void {
    ConfirmDialogComponent.abrir(this.dialog, {
      titulo: 'Desactivar asignación',
      mensaje: '¿Desactivar esta asignación bus-ruta-conductor? El conductor dejará de operar la ruta con este bus.',
      textoConfirmar: 'Desactivar',
    }).subscribe((confirmado) => {
      if (!confirmado) return;
      this.flotaApi.desactivarAsignacion(asignacion.id).subscribe({
        next: () => {
          this.snackBar.open('Asignación desactivada', 'OK', { duration: 4000 });
          const conductorId = this.conductorAsignacionesId();
          if (conductorId) this.cargarAsignaciones(conductorId);
        },
        error: (error: unknown) => {
          this.snackBar.open(
            extraerMensajeError(error, 'No se pudo desactivar la asignación'),
            'OK',
            { duration: 5000 },
          );
        },
      });
    });
  }
}
