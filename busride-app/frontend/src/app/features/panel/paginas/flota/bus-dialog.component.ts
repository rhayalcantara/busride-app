import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ActualizarBusDto, Bus, CrearBusDto, FlotaApi } from '../../../../core/api';
import { extraerMensajeError } from '../../mensaje-error.util';

export interface DatosBusDialog {
  asociacionId: string;
  /** Si viene, el diálogo edita; si no, crea. */
  bus?: Bus;
}

/**
 * Crear/editar bus (POST /flota/buses, PATCH /flota/buses/:id).
 * Espeja CrearBusDto: placa (única → 409 si se repite), capacidadTotal ≥ 1,
 * opcionales marca/modelo/año(1950-2100)/fotoUrl; en edición permite
 * activar/desactivar.
 */
@Component({
  selector: 'app-bus-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ esEdicion ? 'Editar bus' : 'Registrar bus' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="formulario" class="form-dialogo" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>Placa</mat-label>
          <input matInput formControlName="placa" maxlength="20" />
          @if (formulario.controls.placa.hasError('required')) {
            <mat-error>La placa es obligatoria</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Capacidad total (asientos)</mat-label>
          <input matInput type="number" formControlName="capacidadTotal" min="1" />
          @if (
            formulario.controls.capacidadTotal.hasError('required') ||
            formulario.controls.capacidadTotal.hasError('min')
          ) {
            <mat-error>Debe ser al menos 1</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Marca (opcional)</mat-label>
          <input matInput formControlName="marca" maxlength="100" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Modelo (opcional)</mat-label>
          <input matInput formControlName="modelo" maxlength="100" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Año (opcional)</mat-label>
          <input matInput type="number" formControlName="anno" min="1950" max="2100" />
          @if (formulario.controls.anno.hasError('min') || formulario.controls.anno.hasError('max')) {
            <mat-error>Debe estar entre 1950 y 2100</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>URL de foto (opcional)</mat-label>
          <input matInput formControlName="fotoUrl" maxlength="500" />
        </mat-form-field>

        @if (esEdicion) {
          <mat-slide-toggle formControlName="activo">Bus activo</mat-slide-toggle>
        }

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
          {{ esEdicion ? 'Guardar cambios' : 'Registrar' }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .form-dialogo {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: min(400px, 80vw);
        padding-top: 8px;
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
export class BusDialogComponent {
  protected readonly dialogRef = inject<MatDialogRef<BusDialogComponent, Bus>>(MatDialogRef);
  private readonly datos = inject<DatosBusDialog>(MAT_DIALOG_DATA);
  private readonly flotaApi = inject(FlotaApi);

  protected readonly esEdicion = !!this.datos.bus;
  protected readonly cargando = signal(false);
  protected readonly errorBackend = signal<string | null>(null);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    placa: [this.datos.bus?.placa ?? '', Validators.required],
    capacidadTotal: [
      this.datos.bus?.capacidadTotal ?? 30,
      [Validators.required, Validators.min(1)],
    ],
    marca: [this.datos.bus?.marca ?? ''],
    modelo: [this.datos.bus?.modelo ?? ''],
    anno: [this.datos.bus?.anno ?? 0, [Validators.min(0), Validators.max(2100)]],
    fotoUrl: [this.datos.bus?.fotoUrl ?? ''],
    activo: [this.datos.bus?.activo ?? true],
  });

  guardar(): void {
    if (this.formulario.invalid || this.cargando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.errorBackend.set(null);

    const valores = this.formulario.getRawValue();
    const camposComunes = {
      placa: valores.placa.trim(),
      capacidadTotal: valores.capacidadTotal,
      ...(valores.marca.trim() ? { marca: valores.marca.trim() } : {}),
      ...(valores.modelo.trim() ? { modelo: valores.modelo.trim() } : {}),
      ...(valores.anno >= 1950 ? { anno: valores.anno } : {}),
      ...(valores.fotoUrl.trim() ? { fotoUrl: valores.fotoUrl.trim() } : {}),
    };

    const peticion = this.esEdicion
      ? this.flotaApi.actualizarBus(this.datos.bus!.id, {
          ...camposComunes,
          activo: valores.activo,
        } satisfies ActualizarBusDto)
      : this.flotaApi.crearBus({
          asociacionId: this.datos.asociacionId,
          ...camposComunes,
        } satisfies CrearBusDto);

    peticion.subscribe({
      next: (bus) => this.dialogRef.close(bus),
      error: (error: unknown) => {
        this.cargando.set(false);
        // 409: placa duplicada — el backend manda el detalle en `message`
        this.errorBackend.set(extraerMensajeError(error, 'No se pudo guardar el bus'));
      },
    });
  }
}
