import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  AsignacionBusRuta,
  Bus,
  ConductorDeAsociacion,
  CrearAsignacionDto,
  FlotaApi,
  Ruta,
} from '../../../../core/api';
import { extraerMensajeError } from '../../mensaje-error.util';

export interface DatosAsignacionDialog {
  buses: Bus[];
  rutas: Ruta[];
  conductores: ConductorDeAsociacion[];
}

/**
 * Crear asignación bus-ruta-conductor (POST /flota/asignaciones).
 * El backend responde 409 si el bus o el conductor ya tienen una asignación
 * activa solapada: el `mensaje` se muestra tal cual en el diálogo.
 */
@Component({
  selector: 'app-asignacion-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Crear asignación</h2>
    <mat-dialog-content>
      <form [formGroup]="formulario" class="form-dialogo" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>Bus</mat-label>
          <mat-select formControlName="busId">
            @for (bus of datos.buses; track bus.id) {
              <mat-option [value]="bus.id">
                {{ bus.placa }}@if (bus.modelo) { — {{ bus.modelo }} }
              </mat-option>
            }
          </mat-select>
          @if (formulario.controls.busId.hasError('required')) {
            <mat-error>Selecciona un bus</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Ruta</mat-label>
          <mat-select formControlName="rutaId">
            @for (ruta of datos.rutas; track ruta.id) {
              <mat-option [value]="ruta.id">
                {{ ruta.nombre }}@if (ruta.codigo) { ({{ ruta.codigo }}) }
              </mat-option>
            }
          </mat-select>
          @if (formulario.controls.rutaId.hasError('required')) {
            <mat-error>Selecciona una ruta</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Conductor</mat-label>
          <mat-select formControlName="conductorId">
            @for (conductor of datos.conductores; track conductor.id) {
              <mat-option [value]="conductor.id">
                {{ nombreConductor(conductor) }}
              </mat-option>
            }
          </mat-select>
          @if (formulario.controls.conductorId.hasError('required')) {
            <mat-error>Selecciona un conductor</mat-error>
          }
        </mat-form-field>

        <div class="fechas">
          <mat-form-field appearance="outline">
            <mat-label>Fecha de inicio (opcional)</mat-label>
            <input matInput type="date" formControlName="fechaInicio" />
            <mat-hint>Por defecto, hoy</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha de fin (opcional)</mat-label>
            <input matInput type="date" formControlName="fechaFin" />
          </mat-form-field>
        </div>

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
          Crear asignación
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .form-dialogo {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: min(420px, 80vw);
        padding-top: 8px;
      }
      .fechas {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .fechas mat-form-field {
        flex: 1 1 160px;
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
export class AsignacionDialogComponent {
  protected readonly dialogRef =
    inject<MatDialogRef<AsignacionDialogComponent, AsignacionBusRuta>>(MatDialogRef);
  protected readonly datos = inject<DatosAsignacionDialog>(MAT_DIALOG_DATA);
  private readonly flotaApi = inject(FlotaApi);

  protected readonly cargando = signal(false);
  protected readonly errorBackend = signal<string | null>(null);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    busId: ['', Validators.required],
    rutaId: ['', Validators.required],
    conductorId: ['', Validators.required],
    fechaInicio: [''],
    fechaFin: [''],
  });

  protected nombreConductor(conductor: ConductorDeAsociacion): string {
    const nombre = `${conductor.nombre ?? ''} ${conductor.apellido ?? ''}`.trim();
    return nombre || conductor.email || conductor.licenciaNumero;
  }

  guardar(): void {
    if (this.formulario.invalid || this.cargando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.errorBackend.set(null);

    const valores = this.formulario.getRawValue();
    const dto: CrearAsignacionDto = {
      busId: valores.busId,
      rutaId: valores.rutaId,
      conductorId: valores.conductorId,
      ...(valores.fechaInicio ? { fechaInicio: valores.fechaInicio } : {}),
      ...(valores.fechaFin ? { fechaFin: valores.fechaFin } : {}),
    };

    this.flotaApi.crearAsignacion(dto).subscribe({
      next: (asignacion) => this.dialogRef.close(asignacion),
      error: (error: unknown) => {
        this.cargando.set(false);
        // 409: bus/conductor ya asignados en el período — mensaje del backend
        this.errorBackend.set(extraerMensajeError(error, 'No se pudo crear la asignación'));
      },
    });
  }
}
