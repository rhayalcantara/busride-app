import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CrearHorarioDto, FlotaApi, Horario } from '../../../../core/api';
import { extraerMensajeError } from '../../mensaje-error.util';

export interface DatosHorarioDialog {
  rutaId: string;
  rutaNombre: string;
}

/** Días en el orden canónico que valida el backend (L,M,X,J,V,S,D). */
const DIAS = [
  { letra: 'L', label: 'Lun' },
  { letra: 'M', label: 'Mar' },
  { letra: 'X', label: 'Mié' },
  { letra: 'J', label: 'Jue' },
  { letra: 'V', label: 'Vie' },
  { letra: 'S', label: 'Sáb' },
  { letra: 'D', label: 'Dom' },
] as const;

/**
 * Crear horario de una ruta (POST /flota/horarios). Espeja CrearHorarioDto:
 * diasSemana (caracteres LMXJVSD), horaInicio/horaFin HH:mm (fin posterior a
 * inicio — el backend responde 400/409 si no), frecuenciaMin ≥ 1.
 */
@Component({
  selector: 'app-horario-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Crear horario</h2>
    <mat-dialog-content>
      <p class="dialogo-contexto">
        Ruta: <strong>{{ datos.rutaNombre }}</strong>
      </p>
      <form [formGroup]="formulario" class="form-dialogo" novalidate>
        <div class="dias">
          <span class="dias__label">Días de la semana</span>
          <mat-button-toggle-group
            multiple
            [value]="diasSeleccionados()"
            (change)="diasSeleccionados.set($event.value)"
            aria-label="Días de la semana"
          >
            @for (dia of dias; track dia.letra) {
              <mat-button-toggle [value]="dia.letra">{{ dia.label }}</mat-button-toggle>
            }
          </mat-button-toggle-group>
          @if (sinDias()) {
            <p class="error-dialogo">Selecciona al menos un día</p>
          }
        </div>

        <div class="horas">
          <mat-form-field appearance="outline">
            <mat-label>Hora de inicio</mat-label>
            <input matInput type="time" formControlName="horaInicio" />
            @if (formulario.controls.horaInicio.hasError('required')) {
              <mat-error>Obligatoria</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Hora de fin</mat-label>
            <input matInput type="time" formControlName="horaFin" />
            @if (formulario.controls.horaFin.hasError('required')) {
              <mat-error>Obligatoria</mat-error>
            }
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Frecuencia (minutos)</mat-label>
          <input matInput type="number" formControlName="frecuenciaMin" min="1" />
          @if (formulario.controls.frecuenciaMin.hasError('min')) {
            <mat-error>Mínimo 1 minuto</mat-error>
          }
        </mat-form-field>

        @if (errorBackend(); as mensaje) {
          <p class="error-dialogo" role="alert">{{ mensaje }}</p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [disabled]="cargando()" (click)="dialogRef.close()">
        Cancelar
      </button>
      <button mat-flat-button type="button" [disabled]="cargando()" (click)="guardar()">
        @if (cargando()) {
          <mat-spinner diameter="20" />
        } @else {
          Crear horario
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialogo-contexto {
        margin: 0 0 12px;
      }
      .form-dialogo {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: min(420px, 80vw);
      }
      .dias {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .dias__label {
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
      .horas {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .horas mat-form-field {
        flex: 1 1 140px;
      }
      .error-dialogo {
        color: var(--mat-sys-error, #b3261e);
        font-size: 14px;
        margin: 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HorarioDialogComponent {
  protected readonly dialogRef =
    inject<MatDialogRef<HorarioDialogComponent, Horario>>(MatDialogRef);
  protected readonly datos = inject<DatosHorarioDialog>(MAT_DIALOG_DATA);
  private readonly flotaApi = inject(FlotaApi);

  protected readonly dias = DIAS;
  protected readonly diasSeleccionados = signal<string[]>(['L', 'M', 'X', 'J', 'V']);
  protected readonly sinDias = signal(false);
  protected readonly cargando = signal(false);
  protected readonly errorBackend = signal<string | null>(null);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    horaInicio: ['06:00', Validators.required],
    horaFin: ['20:00', Validators.required],
    frecuenciaMin: [30, [Validators.min(1)]],
  });

  guardar(): void {
    // Normaliza la selección al orden canónico LMXJVSD del backend
    const diasOrdenados = DIAS.map((d) => d.letra).filter((letra) =>
      this.diasSeleccionados().includes(letra),
    );
    this.sinDias.set(diasOrdenados.length === 0);

    if (this.formulario.invalid || diasOrdenados.length === 0 || this.cargando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.errorBackend.set(null);

    const valores = this.formulario.getRawValue();
    const dto: CrearHorarioDto = {
      rutaId: this.datos.rutaId,
      diasSemana: diasOrdenados.join(''),
      horaInicio: valores.horaInicio,
      horaFin: valores.horaFin,
      frecuenciaMin: valores.frecuenciaMin,
    };

    this.flotaApi.crearHorario(dto).subscribe({
      next: (horario) => this.dialogRef.close(horario),
      error: (error: unknown) => {
        this.cargando.set(false);
        // 409: solapamiento de horarios — el backend manda el detalle
        this.errorBackend.set(extraerMensajeError(error, 'No se pudo crear el horario'));
      },
    });
  }
}
